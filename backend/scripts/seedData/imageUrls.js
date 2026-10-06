// The frontend mock data points at picsum.photos placeholders, which the
// Cloudinary-only image validation rejects (so seeded rows could not be edited
// later). The seed swaps them for our own Cloudinary assets, built from
// CLOUDINARY_CLOUD_NAME. These are the project legacy-<id> assets that
// scripts/migrate-legacy-image-urls.js re-hosted from the same picsum seeds.
const PROJECT_ASSET_IDS = {
  'proj-1': '6ab21fb73926f50b4ec78a2b',
  'proj-2': '6ab21fb73926f50b4ec78a2c',
  'proj-3': '6ab21fb73926f50b4ec78a2d',
  'proj-4': '6ab21fb73926f50b4ec78a2e',
  'proj-5': '6ab21fb73926f50b4ec78a2f',
};

// Shared by every seed row without a dedicated project asset: property images,
// locations and articles. It lives in project-images/, outside the property-images/
// cleanup boundary, so deleting a seeded listing can never delete it. Projects
// have no Cloudinary cleanup, so nothing deletes this one.
const SHARED_PLACEHOLDER_PATH = `project-images/legacy/legacy-${PROJECT_ASSET_IDS['proj-1']}.jpg`;

const PICSUM_SEED = /^https:\/\/picsum\.photos\/seed\/([^/]+)\//;

function deliveryUrl(cloudName, assetPath) {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${assetPath}`;
}

function assetPathFor(seedKey) {
  if (PROJECT_ASSET_IDS[seedKey]) return `project-images/legacy/legacy-${PROJECT_ASSET_IDS[seedKey]}.jpg`;
  return SHARED_PLACEHOLDER_PATH;
}

// Non-picsum URLs are returned untouched.
function toOwnImageUrl(url, cloudName) {
  if (typeof url !== 'string') return url;
  const match = PICSUM_SEED.exec(url);
  return match ? deliveryUrl(cloudName, assetPathFor(match[1])) : url;
}

// Rewrites every image URL a transformAll() result would write, in place.
function rewriteImageUrls(transformed, cloudName) {
  for (const { image } of transformed.properties) {
    if (image) image.url = toOwnImageUrl(image.url, cloudName);
  }
  for (const key of ['locations', 'projects', 'articles']) {
    for (const { doc } of transformed[key]) {
      if (doc.imageUrl) doc.imageUrl = toOwnImageUrl(doc.imageUrl, cloudName);
    }
  }
  return transformed;
}

// Every image URL the seed will write, for pre-flight validation.
function collectImageUrls(transformed) {
  const urls = [];
  for (const { image } of transformed.properties) if (image) urls.push(image.url);
  for (const key of ['locations', 'projects', 'articles']) {
    for (const { doc } of transformed[key]) if (doc.imageUrl) urls.push(doc.imageUrl);
  }
  return urls;
}

module.exports = { toOwnImageUrl, rewriteImageUrls, collectImageUrls };
