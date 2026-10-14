# scripts

One-off database setup scripts: index creation, backfills, audits, the CSV seed, and admin bootstrap (see docs/backend-architecture.md; MongoDB has no SQL migrations, so schema changes go through explicit, repeatable scripts here instead).

- `setup-db.js` — run via `npm run db:setup` (see `../README.md` → "Setting
  up database indexes"). Syncs every model's indexes in the model registry; never drops a
  collection or deletes data.
- `backfill-city-lower.js` - run via `npm run backfill:city-lower`. Fills `cityLower` on properties, projects and locations (and `localityLower` on locations) for documents created before those fields existed. Idempotent: it only writes documents whose value differs, prints counts only, and is safe to run twice. Run it after deploying the code and before relying on city filters, then run `npm run db:setup` to build the new indexes.
- `backfill-email-verified.js` - run via `npm run backfill:email-verified`. Sets `emailVerified: true` on users that have no `emailVerified` field (accounts created before email verification existed). Idempotent.
- `create-admin.js` - run via `npm run admin:create`. Needs `ADMIN_EMAIL` and `ADMIN_PASSWORD` (min 8 characters) in the environment; `ADMIN_NAME` is optional. Creates a verified admin, or promotes an existing user (without changing their password or verification). Safe to rerun.
- `audit-image-urls.js` - run via `npm run audit:image-urls`. Read-only: lists article, location, project and property-image URLs that are not own-Cloudinary URLs (the seed's picsum placeholders show up here).
- `migrate-legacy-image-urls.js` - run with `node scripts/migrate-legacy-image-urls.js [--apply]`. Re-hosts non-Cloudinary property-image and project-image URLs on the project's Cloudinary account. A dry run by default; `--apply` needs the Cloudinary credentials and writes.
- `seed.js` — run via `npm run seed [-- file.csv] [-- --replace-seeded] [-- --full-mumbai]`. Imports the CSVs in `../DataSet/` (see `seedData/transformDataset.js` for the column mapping). Upserts by slug, so reruns update in place. Imports only every 2nd Mumbai row (pass `--full-mumbai` for all) and creates 5 picsum.photos placeholder images per listing. It derives locations and categories from the listings and creates demo builder projects; it creates no users. `--replace-seeded` first deletes ownerless properties and all locations, categories, projects and articles.
- `seed-featured.js` - run with `node scripts/seed-featured.js`. Upserts a few featured demo listings by slug; aborts if it would push the number of featured published listings past 8.
- `seedData/builders.js` — popular developers per city, turned into published Projects by the seed (the builders directory is derived from Projects). Project names/prices are demo data.
- `seedData/generateCityDatasets.js` — `node scripts/seedData/generateCityDatasets.js` regenerates the synthetic per-city CSVs (Delhi NCR, Bengaluru, Pune, Hyderabad, Chennai, Kolkata, Ahmedabad, Kochi, Coimbatore, Nagpur, Jaipur, Chandigarh; 600 rows each) in `../DataSet/`. It overwrites those files.
- `seedData/` — `parseCsv.js` and `transformDataset.js`, unit-tested in `../tests/seedDataset.test.js`.

No general migration suite exists beyond the scripts above; schema changes are applied by running `db:setup` and, where needed, a backfill.
