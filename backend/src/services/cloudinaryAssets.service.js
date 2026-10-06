const { URL } = require('url');
const cloudinary = require('../config/cloudinary');
const config = require('../config');
const { PropertyImage } = require('../models');

// Cloudinary's admin API accepts at most 100 public ids per delete call.
const DELETE_BATCH_SIZE = 100;

function ownFolderPrefix() {
  return `${config.cloudinaryFolder.replace(/^\/+|\/+$/g, '')}/`;
}

// With an owner, only that owner's folder is deletable; without one (admin
// created listings) the shared upload root is the boundary.
function allowedPrefix(ownerId) {
  const owner = ownerId === undefined || ownerId === null ? '' : String(ownerId);
  return owner ? `${ownFolderPrefix()}${owner}/` : ownFolderPrefix();
}

// The upload folder is the hard boundary: nothing outside it is ever deletable,
// whatever a client sends.
function isSafePublicId(publicId, ownerId) {
  if (typeof publicId !== 'string' || publicId.length === 0) return false;
  if (!publicId.startsWith(allowedPrefix(ownerId))) return false;
  return publicId.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

// The path part of one of our own delivery URLs (still carrying its file
// extension), or null. Only https://res.cloudinary.com/<our cloud>/image/upload/[v123/]<folder>/...
// is understood; a URL with transformations, another cloud, or a path outside
// the upload folder yields null and is therefore never deleted.
function parseOwnDeliveryPath(url) {
  // Fails closed: without a configured cloud name no URL counts as ours.
  if (typeof url !== 'string' || !config.cloudinaryCloudName) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return null;
  // No user:pass@ tricks and no explicit port (the default 443 parses to '').
  if (parsed.username || parsed.password || parsed.port) return null;

  const base = `/${config.cloudinaryCloudName}/image/upload/`;
  if (!parsed.pathname.startsWith(base)) return null;
  return parsed.pathname.slice(base.length);
}

// Single source of truth for "is this one of our own Cloudinary image URLs",
// used to validate client input and, via parseOwnUrl, to gate deletions.
function isOwnCloudinaryImageUrl(url) {
  const rest = parseOwnDeliveryPath(url);
  if (!rest) return false;
  const segments = rest.split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function parseOwnUrl(url) {
  const path = parseOwnDeliveryPath(url);
  if (path === null) return null;

  let rest = path.replace(/^v\d+\//, '');
  try {
    rest = decodeURIComponent(rest);
  } catch {
    return null;
  }
  return rest.startsWith(ownFolderPrefix()) ? rest : null;
}

const EXTENSION = /\.[A-Za-z0-9]{2,5}$/;

// The public id to delete for an image row, or null when it must not be deleted.
// A stored publicId is client-supplied, so it only counts when our own URL
// confirms it. Otherwise one user could name another user's asset in a listing
// and delete it along with their own. Without a publicId the id is derived from
// the URL, under the same rules.
function resolvePublicId(image, ownerId) {
  if (!image) return null;
  const rest = parseOwnUrl(image.url);
  if (rest === null) return null;

  const { publicId } = image;
  if (typeof publicId === 'string' && publicId.length > 0) {
    const confirmed =
      rest === publicId || (rest.startsWith(publicId) && EXTENSION.test(rest.slice(publicId.length)) && rest.slice(publicId.length).startsWith('.'));
    return confirmed && isSafePublicId(publicId, ownerId) ? publicId : null;
  }

  const derived = rest.replace(EXTENSION, '');
  return isSafePublicId(derived, ownerId) ? derived : null;
}

// Best effort and never throws: callers have already committed their database
// changes, so a Cloudinary outage must not turn into a failed request. Failures
// are logged with the public ids (no credentials) for manual cleanup.
async function deleteAssetsByPublicIds(publicIds, ownerId) {
  const ids = [...new Set((publicIds || []).filter((id) => isSafePublicId(id, ownerId)))];
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    const batch = ids.slice(i, i + DELETE_BATCH_SIZE);
    try {
      await cloudinary.v2.api.delete_resources(batch, { resource_type: 'image', type: 'upload' });
    } catch (err) {
      console.error('[cloudinary] failed to delete assets:', JSON.stringify(batch), err?.message || err);
    }
  }
}

// Deletes the Cloudinary assets behind image rows whose database rows are
// already gone. An asset that another remaining row still points at is kept,
// so sharing a URL between listings can never delete a live listing's photo.
async function deleteAssetsForImages(images, ownerId) {
  try {
    const byId = new Map();
    for (const image of images || []) {
      const id = resolvePublicId(image, ownerId);
      if (id) byId.set(id, image.url);
    }
    if (byId.size === 0) return;

    const stillUsed = await PropertyImage.find({
      $or: [{ publicId: { $in: [...byId.keys()] } }, { url: { $in: [...byId.values()] } }],
    })
      .select('publicId url')
      .lean();
    const referenced = new Set(stillUsed.map((row) => resolvePublicId(row)).filter(Boolean));

    await deleteAssetsByPublicIds([...byId.keys()].filter((id) => !referenced.has(id)), ownerId);
  } catch (err) {
    console.error('[cloudinary] asset cleanup failed:', err?.message || err);
  }
}

module.exports = { isOwnCloudinaryImageUrl, resolvePublicId, deleteAssetsByPublicIds, deleteAssetsForImages, DELETE_BATCH_SIZE };
