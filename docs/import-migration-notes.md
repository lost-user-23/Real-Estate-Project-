# Scraper import: database migration notes

What the import feature changes in the database, what happens when indexes are
synced, and how to undo it. Written for whoever deploys or rolls back.

## 1. What changed

Two optional string fields on `Property` and one index. **No existing document
is rewritten.**

| | |
|---|---|
| `source` | Name of the scraped site (e.g. `"99acres"`). Only present on imported listings. |
| `sourceUrl` | The cleaned listing URL; the key a re-import matches on. Only present on imported listings. |
| Index `sourceUrl_1` | `{ sourceUrl: 1 }`, **unique**, **partial**: `partialFilterExpression: { sourceUrl: { $type: "string" } }` |

Neither field has a default, so website and seeded listings have no such field
at all (not `null`).

### Why the index must be partial

A plain unique index treats every document with a missing `sourceUrl` as
`null`, and only one `null` is allowed. On a collection that already has
thousands of listings without the field, building it fails:

```
plain unique index on existing data -> DuplicateKey (Index build failed)
partial unique index on same data   -> built OK, more documents without the field still insert
```

The partial index only contains documents where `sourceUrl` is a string, so
existing listings are not in it. (Checked on a scratch local mongod; the same
rules apply on Atlas.)

## 2. How and when the index gets built

Mongoose `autoIndex` is on and nothing in the code disables it, so **the index
is created the first time any process using the new schema connects** (a dev
server restart, a deploy, or the first test run against that database). The
build is instant: zero documents match the partial filter.

State of the Atlas `homenest` database when last checked (read-only): 18,369
properties, 0 with `source` or `sourceUrl`, and `sourceUrl_1` already present
with the correct unique + partial definition (built by the dev server on restart).

## 3. Known index drift: `status_1` and `city_1`

The live `homenest.properties` collection has two indexes that **the schema does
not declare**:

| Index | In the schema? | Notes |
|---|---|---|
| `status_1` | no | Redundant: the compound indexes `status_1_cityLower_1_publishedAt_-1` and `status_1_featured_1_cityLower_1` already start with `status`. |
| `city_1` | no | Queries filter on `cityLower`, so this is probably unused, but every query has not been audited. |

This drift **predates the import work** and is unrelated to it.

**Consequence:** `Model.syncIndexes()` (which `npm run db:setup` calls) *builds
missing indexes and drops indexes that are not in the schema*. Running it today
would build nothing new and **drop `status_1` and `city_1`**.

**Decision (current): leave them alone and do not run `db:setup`.** Do not run it
against this database until someone decides whether to add the two indexes to
`Property.js` (keeps them) or accept dropping them. Normal app startup is safe:
`autoIndex` only creates indexes, it never drops them.

## 4. Rollback

1. **Revert the code.** The index and any imported documents stay in the
   database. Both are harmless: Mongoose ignores fields that are not in the
   schema, and the index only affects documents that have a `sourceUrl`.
2. **To drop the index**, do it explicitly:
   `db.properties.dropIndex("sourceUrl_1")`.
   Do **not** use `syncIndexes()` / `db:setup` for this: it would also drop
   `status_1` and `city_1` (section 3).
3. **If imported listings exist, deal with them before reverting `seed.js`.**
   The pre-import `--replace-seeded` deleted every property with `ownerId: null`,
   which includes imported ones. With the new filter (`ownerId: null` and no
   `source`) they are safe.
4. Imported listings can be found with `{ source: { $exists: true } }`. Deleting
   them also means deleting their `propertyimages` and `savedproperties` rows.

## 5. Re-import behaviour (data safety)

- Matching is on the cleaned `sourceUrl`.
- A listing that is still a **draft** is fully updated from the new scrape.
- A listing that is **not a draft** (published or archived) is **never changed**;
  it is reported as `skipped`.
- Import never changes `status`, `verified`, `featured`, `featuredRank`,
  `publishedAt`, `ownerId` or `slug`. The check "still a draft" and the write are
  one atomic update, so an admin publishing at the same moment cannot be
  overwritten.
- New listings are always created as `draft`, `ownerId: null`, not verified, not
  featured.
- `npm run seed -- --replace-seeded` only deletes seeded listings (no owner and no
  `source`). Imported listings survive it. It still deletes *all* locations,
  categories, projects and articles (existing behaviour, deliberately unchanged).

## 6. Test databases

Tests run against a **local** mongod (`MONGODB_URI_TEST`, default
`mongodb://127.0.0.1:27017`), never against the app's `MONGODB_URI`. See
"Running the tests" in `backend/README.md`.
