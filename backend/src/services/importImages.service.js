const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const config = require('../config');
const { Property, PropertyImage } = require('../models');
const { fetchImage } = require('../utils/safeImageFetch');
const { ALLOWED_IMAGE_FORMATS } = require('../config/uploadConfig');

// Photos of scraped listings are copied to our own Cloudinary account in the
// background, after the import response has been sent. A tiny in-process queue
// runs one listing at a time and one image at a time, so slow image hosts never
// hold up a request. The queue is lost on a restart: `npm run import:retry-images`
// picks up every draft still marked "pending" or "partial".

const queue = [];
const queued = new Set();
let drain = null; // promise of the running drain, or null when idle
const scheduling = new Set(); // lookups that will still add listings to the queue

function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream(
      { folder, public_id: crypto.randomUUID(), resource_type: 'image', allowed_formats: ALLOWED_IMAGE_FORMATS },
      (err, uploaded) => (err ? reject(err) : resolve(uploaded))
    );
    stream.end(buffer);
  });
}

// Downloads one image and saves it as a PropertyImage after the listing's
// existing photos. Throws when the image cannot be fetched or uploaded.
async function attachImage(propertyId, url, displayOrder) {
  const { buffer } = await fetchImage(url);
  const uploaded = await uploadBuffer(buffer, `${config.cloudinaryFolder}/imports`);
  await PropertyImage.create({
    propertyId,
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    sourceUrl: url,
    displayOrder,
  });
}

// Brings one draft listing's photos up to date with its importImageUrls.
// Existing photos (scraped or added by an admin) are never deleted or reordered:
// URLs already saved are skipped, new ones are appended at the end.
async function processListingImages(propertyId) {
  const property = await Property.findById(propertyId).select('status imageImportStatus +importImageUrls').lean();
  if (!property || property.status !== 'draft') return;
  if (property.imageImportStatus !== 'pending' && property.imageImportStatus !== 'partial') return;

  const urls = property.importImageUrls || [];
  const existing = await PropertyImage.find({ propertyId }).select('sourceUrl displayOrder').lean();
  const saved = new Set(existing.map((row) => row.sourceUrl).filter(Boolean));
  let nextOrder = existing.reduce((max, row) => Math.max(max, row.displayOrder ?? 0), -1) + 1;

  let attached = 0;
  let failed = 0;
  for (const url of urls) {
    if (saved.has(url)) {
      attached += 1;
      continue;
    }
    try {
      await attachImage(propertyId, url, nextOrder);
      nextOrder += 1;
      attached += 1;
    } catch (err) {
      failed += 1;
      console.error(`[import-images] skipped an image of listing ${propertyId}: ${err?.message || err}`);
    }
  }

  const status = failed === 0 ? 'done' : attached > 0 ? 'partial' : 'failed';
  // Only write if a re-import has not replaced the URL list meanwhile; that
  // re-import queued its own run, which will finish the job.
  await Property.updateOne(
    { _id: propertyId, status: 'draft', importImageUrls: urls },
    status === 'done'
      ? { $set: { imageImportStatus: 'done' }, $unset: { importImageUrls: '' } }
      : { $set: { imageImportStatus: status } }
  );
}

async function runQueue() {
  while (queue.length > 0) {
    const id = queue.shift();
    queued.delete(id);
    try {
      await processListingImages(id);
    } catch (err) {
      console.error(`[import-images] listing ${id} failed:`, err?.message || err);
    }
  }
}

function startDrain() {
  drain = new Promise((resolve) => setImmediate(resolve))
    .then(runQueue)
    .catch((err) => console.error('[import-images] queue error:', err?.message || err))
    .finally(() => {
      drain = null;
      if (queue.length > 0) startDrain(); // something was queued while finishing
    });
}

// Adds listings to the queue and returns at once; the work starts on the next tick.
function enqueueImageImports(propertyIds) {
  for (const id of propertyIds) {
    const key = String(id);
    if (!queued.has(key)) {
      queued.add(key);
      queue.push(key);
    }
  }
  if (!drain && queue.length > 0) startDrain();
}

// After the response is sent: finds the saved drafts for these cleaned
// sourceUrls and queues their photos. Never throws.
function queueImageImportsBySourceUrl(sourceUrls) {
  if (sourceUrls.length === 0) return;
  const lookup = Property.find({ sourceUrl: { $in: sourceUrls }, status: 'draft' })
    .select('_id')
    .lean()
    .then((rows) => enqueueImageImports(rows.map((row) => row._id)))
    .catch((err) => console.error('[import-images] could not queue photo imports:', err?.message || err))
    .finally(() => scheduling.delete(lookup));
  scheduling.add(lookup);
}

// Resolves when the queue is empty. For tests and the retry script.
async function whenImageQueueIdle() {
  while (drain || scheduling.size > 0) await Promise.all([drain, ...scheduling]);
}

module.exports = { processListingImages, enqueueImageImports, queueImageImportsBySourceUrl, whenImageQueueIdle };
