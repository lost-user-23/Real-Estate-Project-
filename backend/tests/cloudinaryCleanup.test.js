process.env.MONGODB_DB_NAME = 'homenest_test_cloudinary_cleanup';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';
process.env.CLOUDINARY_API_KEY = '123456789012345';
process.env.CLOUDINARY_API_SECRET = 'cleanup-test-secret';
process.env.CLOUDINARY_FOLDER = 'property-images';
const { tokenFromResponse, registerVerified } = require('./helpers/auth');

jest.mock('../src/config/cloudinary', () => ({
  v2: { api: { delete_resources: jest.fn() } },
  utils: { api_sign_request: jest.fn() },
}));

const request = require('supertest');
const mongoose = require('mongoose');
const cloudinary = require('../src/config/cloudinary');
const createApp = require('../src/app');
const { connectToDatabase, disconnectFromDatabase } = require('../src/db/connection');
const { resolvePublicId, DELETE_BATCH_SIZE } = require('../src/services/cloudinaryAssets.service');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const PropertyImage = require('../src/models/PropertyImage');

const app = createApp();
const deleteResources = cloudinary.v2.api.delete_resources;
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const ownUrl = (id, ext = 'jpg', version = 'v1700000000') =>
  `https://res.cloudinary.com/demo/image/upload/${version}/${id}.${ext}`;
const idFor = (user, name) => `property-images/${user}/${name}`;
const sentIds = () => deleteResources.mock.calls.flatMap(([ids]) => ids).sort();

async function registerUser(email) {
  const res = await registerVerified(app, { email, password: 'password123' });
  return { token: tokenFromResponse(res), id: res.body.user.id };
}

async function makeAdmin(id) {
  await User.updateOne({ _id: id }, { role: 'admin' });
}

let counter = 0;
async function createListing(ownerId, images = []) {
  counter += 1;
  const property = await Property.create({
    ownerId,
    slug: `cleanup-${counter}`,
    title: `Cleanup ${counter}`,
    intent: 'buy',
    propertyType: 'apartment',
    areaSqft: 900,
    priceInRupees: 5000000,
    city: 'Delhi',
    status: 'published',
  });
  if (images.length > 0) {
    await PropertyImage.insertMany(images.map((image, i) => ({ propertyId: property._id, displayOrder: i, ...image })));
  }
  return property;
}

beforeAll(async () => {
  await connectToDatabase();
});

beforeEach(() => {
  deleteResources.mockReset();
  deleteResources.mockResolvedValue({ deleted: {} });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([User.deleteMany({}), Property.deleteMany({}), PropertyImage.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectFromDatabase();
});

describe('resolvePublicId', () => {
  const id = idFor('u1', 'abc123');

  it('derives the id from our own URL when no publicId is stored', () => {
    expect(resolvePublicId({ url: ownUrl(id) })).toBe(id);
    expect(resolvePublicId({ url: ownUrl(id, 'webp'), publicId: null })).toBe(id);
  });

  it('uses a stored publicId when our URL confirms it', () => {
    expect(resolvePublicId({ url: ownUrl(id), publicId: id })).toBe(id);
  });

  it('refuses a stored publicId the URL does not confirm', () => {
    const victim = idFor('someone-else', 'theirs');
    expect(resolvePublicId({ url: ownUrl(id), publicId: victim })).toBeNull();
    expect(resolvePublicId({ url: ownUrl(id), publicId: 'property-images/u1/abc' })).toBeNull();
  });

  it('refuses publicIds outside the upload folder or with path tricks', () => {
    expect(resolvePublicId({ url: ownUrl('other-folder/x'), publicId: 'other-folder/x' })).toBeNull();
    expect(resolvePublicId({ url: ownUrl('property-images/../secret'), publicId: 'property-images/../secret' })).toBeNull();
    expect(resolvePublicId({ url: ownUrl('property-images/u1//x') })).toBeNull();
  });

  it('never resolves seed, local, foreign-cloud, non-https or transformed URLs', () => {
    expect(resolvePublicId({ url: 'https://picsum.photos/seed/p1/800/600' })).toBeNull();
    expect(resolvePublicId({ url: '/uploads/property-images/u1/a.jpg' })).toBeNull();
    expect(resolvePublicId({ url: 'https://res.cloudinary.com/other/image/upload/v1/property-images/u1/a.jpg' })).toBeNull();
    expect(resolvePublicId({ url: 'http://res.cloudinary.com/demo/image/upload/v1/property-images/u1/a.jpg' })).toBeNull();
    expect(resolvePublicId({ url: 'https://evil.example.com/demo/image/upload/v1/property-images/u1/a.jpg' })).toBeNull();
    expect(resolvePublicId({ url: 'https://res.cloudinary.com/demo/image/upload/c_fill,w_300/property-images/u1/a.jpg' })).toBeNull();
    expect(resolvePublicId({ url: null })).toBeNull();
    expect(resolvePublicId(null)).toBeNull();
  });
});

describe('create and update accept publicId', () => {
  it('stores publicId on create and returns it', async () => {
    const { token, id } = await registerUser('create@example.com');
    const publicId = idFor(id, 'created');
    const images = Array.from({ length: 5 }, (_, i) => ({ url: ownUrl(`${publicId}${i}`), publicId: `${publicId}${i}` }));

    const res = await request(app)
      .post('/api/v1/properties')
      .set(auth(token))
      .send({
        title: 'With ids',
        intent: 'buy',
        propertyType: 'apartment',
        areaSqft: 500,
        priceInRupees: 100,
        city: 'Pune',
        images,
      });

    expect(res.status).toBe(201);
    expect(res.body.property.images.map((i) => i.publicId)).toEqual(images.map((i) => i.publicId));
    expect((await PropertyImage.find({}).lean()).every((row) => row.publicId)).toBe(true);
  });

  it('rejects a non-string or blank publicId with 400', async () => {
    const { token, id } = await registerUser('invalid@example.com');
    const property = await createListing(id);

    for (const publicId of [123, '', '   ', {}]) {
      const res = await request(app)
        .patch(`/api/v1/properties/${property._id}`)
        .set(auth(token))
        .send({ images: [{ url: ownUrl('x'), publicId }] });
      expect(res.status).toBe(400);
    }
    expect(deleteResources).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/properties/:id', () => {
  it('deletes only this property\'s own assets after the rows are gone', async () => {
    const { token, id } = await registerUser('owner@example.com');
    const a = idFor(id, 'a');
    const b = idFor(id, 'b');
    const keep = idFor(id, 'keep');
    const property = await createListing(id, [{ url: ownUrl(a) }, { url: ownUrl(b), publicId: b }]);
    const other = await createListing(id, [{ url: ownUrl(keep) }]);

    // Assertions inside the mock would be swallowed by the best-effort catch, so record instead.
    const rowsWhenCalled = [];
    deleteResources.mockImplementation(async () => {
      rowsWhenCalled.push(await PropertyImage.countDocuments({ propertyId: property._id }));
      return { deleted: {} };
    });

    const res = await request(app).delete(`/api/v1/properties/${property._id}`).set(auth(token));

    expect(res.status).toBe(204);
    expect(sentIds()).toEqual([a, b]);
    expect(rowsWhenCalled).toEqual([0]);
    expect(deleteResources).toHaveBeenCalledWith(expect.any(Array), { resource_type: 'image', type: 'upload' });
    expect(await PropertyImage.countDocuments({ propertyId: other._id })).toBe(1);
  });

  it('does not call Cloudinary when the caller may not delete', async () => {
    const owner = await registerUser('owner2@example.com');
    const stranger = await registerUser('stranger@example.com');
    const property = await createListing(owner.id, [{ url: ownUrl(idFor(owner.id, 'a')) }]);

    const res = await request(app).delete(`/api/v1/properties/${property._id}`).set(auth(stranger.token));

    expect(res.status).toBe(403);
    expect(deleteResources).not.toHaveBeenCalled();
    expect(await PropertyImage.countDocuments({ propertyId: property._id })).toBe(1);
  });

  it('does not call Cloudinary when the property does not exist', async () => {
    const { token } = await registerUser('missing@example.com');

    const res = await request(app).delete(`/api/v1/properties/${new mongoose.Types.ObjectId()}`).set(auth(token));

    expect(res.status).toBe(404);
    expect(deleteResources).not.toHaveBeenCalled();
  });

  it('still succeeds, and logs the public ids without credentials, when Cloudinary throws', async () => {
    const { token, id } = await registerUser('fails@example.com');
    const a = idFor(id, 'a');
    const property = await createListing(id, [{ url: ownUrl(a) }]);
    deleteResources.mockRejectedValue(new Error('cloudinary is down'));

    const res = await request(app).delete(`/api/v1/properties/${property._id}`).set(auth(token));

    expect(res.status).toBe(204);
    expect(await Property.findById(property._id)).toBeNull();
    expect(await PropertyImage.countDocuments({ propertyId: property._id })).toBe(0);
    const logged = console.error.mock.calls.flat().join(' ');
    expect(logged).toContain(a);
    expect(logged).toContain('cloudinary is down');
    expect(logged).not.toContain('cleanup-test-secret');
    expect(logged).not.toContain('123456789012345');
  });

  it('never sends seed, local or foreign URLs, only our own', async () => {
    const { token, id } = await registerUser('mixed@example.com');
    const mine = idFor(id, 'mine');
    const property = await createListing(id, [
      { url: 'https://picsum.photos/seed/p1/800/600' },
      { url: '/uploads/local.jpg' },
      { url: 'https://res.cloudinary.com/other/image/upload/v1/property-images/x/y.jpg' },
      { url: ownUrl('other-folder/z') },
      { url: ownUrl(mine) },
    ]);

    await request(app).delete(`/api/v1/properties/${property._id}`).set(auth(token));

    expect(sentIds()).toEqual([mine]);
  });

  it('never deletes an asset another listing still uses', async () => {
    const { token, id } = await registerUser('shared@example.com');
    const shared = idFor(id, 'shared');
    const own = idFor(id, 'own');
    const property = await createListing(id, [{ url: ownUrl(shared) }, { url: ownUrl(own) }]);
    await createListing(id, [{ url: ownUrl(shared) }]);

    await request(app).delete(`/api/v1/properties/${property._id}`).set(auth(token));

    expect(sentIds()).toEqual([own]);
  });

  it('ignores a spoofed publicId that the URL does not back up', async () => {
    const victim = await registerUser('victim@example.com');
    const { token, id } = await registerUser('spoofer@example.com');
    const victimAsset = idFor(victim.id, 'precious');
    await createListing(victim.id, [{ url: ownUrl(victimAsset) }]);
    const property = await createListing(id, [{ url: ownUrl(idFor(id, 'mine')), publicId: victimAsset }]);

    await request(app).delete(`/api/v1/properties/${property._id}`).set(auth(token));

    expect(deleteResources).not.toHaveBeenCalled();
  });

  it('sends ids in batches', async () => {
    const { token, id } = await registerUser('batch@example.com');
    const total = DELETE_BATCH_SIZE + 20;
    const images = Array.from({ length: total }, (_, i) => ({ url: ownUrl(idFor(id, `img${i}`)) }));
    const property = await createListing(id, images);

    await request(app).delete(`/api/v1/properties/${property._id}`).set(auth(token));

    expect(deleteResources).toHaveBeenCalledTimes(2);
    expect(deleteResources.mock.calls[0][0]).toHaveLength(DELETE_BATCH_SIZE);
    expect(deleteResources.mock.calls[1][0]).toHaveLength(20);
  });
});

describe('DELETE /api/v1/admin/properties/bulk', () => {
  it('deletes the assets of every deleted property and nothing else', async () => {
    const admin = await registerUser('admin@example.com');
    await makeAdmin(admin.id);
    const a = idFor(admin.id, 'a');
    const b = idFor(admin.id, 'b');
    const survivor = idFor(admin.id, 'survivor');
    const p1 = await createListing(admin.id, [{ url: ownUrl(a) }]);
    const p2 = await createListing(admin.id, [{ url: ownUrl(b) }]);
    const p3 = await createListing(admin.id, [{ url: ownUrl(survivor) }]);

    const res = await request(app)
      .delete('/api/v1/admin/properties/bulk')
      .set(auth(admin.token))
      .send({ ids: [String(p1._id), String(p2._id)] });

    expect(res.status).toBe(200);
    expect(sentIds()).toEqual([a, b]);
    expect(await PropertyImage.countDocuments({ propertyId: p3._id })).toBe(1);
  });

  it('still succeeds when Cloudinary throws', async () => {
    const admin = await registerUser('admin2@example.com');
    await makeAdmin(admin.id);
    const p1 = await createListing(admin.id, [{ url: ownUrl(idFor(admin.id, 'a')) }]);
    deleteResources.mockRejectedValue(new Error('boom'));

    const res = await request(app)
      .delete('/api/v1/admin/properties/bulk')
      .set(auth(admin.token))
      .send({ ids: [String(p1._id)] });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(1);
  });
});

describe('DELETE /api/auth/me', () => {
  it('deletes the assets of the account\'s listings only', async () => {
    const user = await registerUser('leaving@example.com');
    const other = await registerUser('staying@example.com');
    const mine = idFor(user.id, 'mine');
    const theirs = idFor(other.id, 'theirs');
    await createListing(user.id, [{ url: ownUrl(mine) }]);
    const otherListing = await createListing(other.id, [{ url: ownUrl(theirs) }]);

    const res = await request(app).delete('/api/auth/me').set(auth(user.token)).send({ password: 'password123' });

    expect(res.status).toBe(200);
    expect(sentIds()).toEqual([mine]);
    expect(await PropertyImage.countDocuments({ propertyId: otherListing._id })).toBe(1);
  });

  it('does not call Cloudinary when the password is wrong', async () => {
    const user = await registerUser('wrongpw@example.com');
    await createListing(user.id, [{ url: ownUrl(idFor(user.id, 'a')) }]);

    const res = await request(app).delete('/api/auth/me').set(auth(user.token)).send({ password: 'nope-nope-nope' });

    expect(res.status).toBe(400);
    expect(deleteResources).not.toHaveBeenCalled();
  });

  it('still deletes the account when Cloudinary throws', async () => {
    const user = await registerUser('cloudfail@example.com');
    await createListing(user.id, [{ url: ownUrl(idFor(user.id, 'a')) }]);
    deleteResources.mockRejectedValue(new Error('boom'));

    const res = await request(app).delete('/api/auth/me').set(auth(user.token)).send({ password: 'password123' });

    expect(res.status).toBe(200);
    expect(await User.findById(user.id)).toBeNull();
  });

  it('does not call Cloudinary when the image rows could not be deleted', async () => {
    const user = await registerUser('rowsfail@example.com');
    await createListing(user.id, [{ url: ownUrl(idFor(user.id, 'a')) }]);
    jest.spyOn(PropertyImage, 'deleteMany').mockRejectedValueOnce(new Error('row cleanup failed'));

    const res = await request(app).delete('/api/auth/me').set(auth(user.token)).send({ password: 'password123' });

    expect(res.status).toBe(200);
    expect(deleteResources).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/properties/:id image replacement', () => {
  it('deletes only the assets that were removed from the set', async () => {
    const { token, id } = await registerUser('replace@example.com');
    const [a, b, c] = ['a', 'b', 'c'].map((n) => idFor(id, n));
    const added = idFor(id, 'added');
    const property = await createListing(id, [{ url: ownUrl(a) }, { url: ownUrl(b), publicId: b }, { url: ownUrl(c) }]);

    const res = await request(app)
      .patch(`/api/v1/properties/${property._id}`)
      .set(auth(token))
      .send({
        images: [
          { url: ownUrl(a), publicId: a },
          { url: ownUrl(c, 'jpg', 'v1800000000') },
          { url: ownUrl(added), publicId: added },
        ],
      });

    expect(res.status).toBe(200);
    expect(sentIds()).toEqual([b]);
    expect((await PropertyImage.find({ propertyId: property._id }).lean()).map((r) => r.url).sort()).toEqual(
      [ownUrl(a), ownUrl(c, 'jpg', 'v1800000000'), ownUrl(added)].sort()
    );
  });

  it('deletes everything old when the new set is empty', async () => {
    const { token, id } = await registerUser('empty@example.com');
    const a = idFor(id, 'a');
    const property = await createListing(id, [{ url: ownUrl(a) }]);

    const res = await request(app).patch(`/api/v1/properties/${property._id}`).set(auth(token)).send({ images: [] });

    expect(res.status).toBe(200);
    expect(sentIds()).toEqual([a]);
  });

  it('does not touch Cloudinary when images are not part of the update', async () => {
    const { token, id } = await registerUser('noimages@example.com');
    const property = await createListing(id, [{ url: ownUrl(idFor(id, 'a')) }]);

    const res = await request(app).patch(`/api/v1/properties/${property._id}`).set(auth(token)).send({ title: 'New title' });

    expect(res.status).toBe(200);
    expect(deleteResources).not.toHaveBeenCalled();
  });

  it('does not delete anything when the replacement fails, and a forbidden update deletes nothing', async () => {
    const owner = await registerUser('owner3@example.com');
    const stranger = await registerUser('stranger3@example.com');
    const a = idFor(owner.id, 'a');
    const property = await createListing(owner.id, [{ url: ownUrl(a) }]);

    const forbidden = await request(app)
      .patch(`/api/v1/properties/${property._id}`)
      .set(auth(stranger.token))
      .send({ images: [] });
    expect(forbidden.status).toBe(403);

    jest.spyOn(PropertyImage, 'insertMany').mockRejectedValueOnce(new Error('insert failed'));
    const failed = await request(app)
      .patch(`/api/v1/properties/${property._id}`)
      .set(auth(owner.token))
      .send({ images: [{ url: ownUrl(idFor(owner.id, 'new')) }] });
    expect(failed.status).toBe(500);

    expect(deleteResources).not.toHaveBeenCalled();
  });

  it('still succeeds when Cloudinary throws', async () => {
    const { token, id } = await registerUser('replacefail@example.com');
    const property = await createListing(id, [{ url: ownUrl(idFor(id, 'a')) }]);
    deleteResources.mockRejectedValue(new Error('boom'));

    const res = await request(app).patch(`/api/v1/properties/${property._id}`).set(auth(token)).send({ images: [] });

    expect(res.status).toBe(200);
    expect(await PropertyImage.countDocuments({ propertyId: property._id })).toBe(0);
  });
});

describe('owner-folder boundary', () => {
  it('resolvePublicId only accepts ids under the given owner\'s folder', () => {
    const mine = idFor('u1', 'a');
    const theirs = idFor('u2', 'a');
    expect(resolvePublicId({ url: ownUrl(mine) }, 'u1')).toBe(mine);
    expect(resolvePublicId({ url: ownUrl(mine), publicId: mine }, 'u1')).toBe(mine);
    expect(resolvePublicId({ url: ownUrl(theirs) }, 'u1')).toBeNull();
    expect(resolvePublicId({ url: ownUrl(theirs), publicId: theirs }, 'u1')).toBeNull();
    // ownerless: shared-root rule
    expect(resolvePublicId({ url: ownUrl(theirs) }, null)).toBe(theirs);
    expect(resolvePublicId({ url: ownUrl(theirs) })).toBe(theirs);
  });

  it('does not delete an id under another user\'s folder, but deletes the owner\'s own', async () => {
    const { token, id } = await registerUser('boundary@example.com');
    const other = await registerUser('boundary-other@example.com');
    const mine = idFor(id, 'mine');
    const foreign = idFor(other.id, 'foreign');
    const property = await createListing(id, [
      { url: ownUrl(mine) },
      { url: ownUrl(foreign) },
      { url: ownUrl(foreign), publicId: foreign },
    ]);

    await request(app).delete(`/api/v1/properties/${property._id}`).set(auth(token));

    expect(sentIds()).toEqual([mine]);
  });

  it('uses the shared-root rule for a property without an owner', async () => {
    const admin = await registerUser('ownerless-admin@example.com');
    await makeAdmin(admin.id);
    const a = idFor('anyone', 'a');
    const outside = 'other-folder/x';
    const property = await createListing(admin.id, [{ url: ownUrl(a) }, { url: ownUrl(outside) }]);
    await Property.collection.updateOne({ _id: property._id }, { $unset: { ownerId: '' } });

    const res = await request(app).delete(`/api/v1/properties/${property._id}`).set(auth(admin.token));

    expect(res.status).toBe(204);
    expect(sentIds()).toEqual([a]);
  });

  it('bulk delete removes only each property\'s own owner\'s assets', async () => {
    const admin = await registerUser('bulk-admin@example.com');
    await makeAdmin(admin.id);
    const u1 = await registerUser('bulk-u1@example.com');
    const u2 = await registerUser('bulk-u2@example.com');
    const u1Own = idFor(u1.id, 'own');
    const u2Own = idFor(u2.id, 'own');
    const u1TriesU2 = idFor(u2.id, 'stolen-by-u1');
    const u2TriesU1 = idFor(u1.id, 'stolen-by-u2');
    const p1 = await createListing(u1.id, [{ url: ownUrl(u1Own) }, { url: ownUrl(u1TriesU2) }]);
    const p2 = await createListing(u2.id, [{ url: ownUrl(u2Own) }, { url: ownUrl(u2TriesU1) }]);

    const res = await request(app)
      .delete('/api/v1/admin/properties/bulk')
      .set(auth(admin.token))
      .send({ ids: [String(p1._id), String(p2._id)] });

    expect(res.status).toBe(200);
    expect(res.body.deletedCount).toBe(2);
    expect(sentIds()).toEqual([u1Own, u2Own].sort());
    expect(sentIds()).not.toContain(u1TriesU2);
    expect(sentIds()).not.toContain(u2TriesU1);
  });

  it('account deletion only deletes assets under the user\'s own folder', async () => {
    const user = await registerUser('acct-boundary@example.com');
    const other = await registerUser('acct-boundary-other@example.com');
    const mine = idFor(user.id, 'mine');
    const foreign = idFor(other.id, 'foreign');
    await createListing(user.id, [{ url: ownUrl(mine) }, { url: ownUrl(foreign) }]);

    const res = await request(app).delete('/api/auth/me').set(auth(user.token)).send({ password: 'password123' });

    expect(res.status).toBe(200);
    expect(sentIds()).toEqual([mine]);
  });

  it('replace-images only deletes removed assets under the owner\'s folder', async () => {
    const { token, id } = await registerUser('replace-boundary@example.com');
    const other = await registerUser('replace-boundary-other@example.com');
    const mine = idFor(id, 'mine');
    const foreign = idFor(other.id, 'foreign');
    const property = await createListing(id, [{ url: ownUrl(mine) }, { url: ownUrl(foreign) }]);

    const res = await request(app).patch(`/api/v1/properties/${property._id}`).set(auth(token)).send({ images: [] });

    expect(res.status).toBe(200);
    expect(sentIds()).toEqual([mine]);
  });
});
