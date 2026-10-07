# scripts

One-off database setup scripts: versioned index-creation/migration scripts,
and the seed script that loads data derived from
`frontend/src/lib/mockData.js` (see docs/backend-architecture.md, "Today's
Implementation Boundary" and "MongoDB Schema Rules" — MongoDB has no SQL
migrations, so schema changes go through explicit, repeatable scripts here
instead).

- `setup-db.js` — run via `npm run db:setup` (see `../README.md` → "Setting
  up database indexes"). Syncs every model's indexes; never drops a
  collection or deletes data.
- `backfill-city-lower.js` - run via `npm run backfill:city-lower`. Fills `cityLower` on properties, projects and locations (and `localityLower` on locations) for documents created before those fields existed. Idempotent: it only writes documents whose value differs, prints counts only, and is safe to run twice. Run it after deploying the code and before relying on city filters, then run `npm run db:setup` to build the new indexes.
- `seed.js` — run via `npm run seed [-- file.csv] [-- --replace-seeded]`. Imports the CSVs in `../DataSet/` (see `seedData/transformDataset.js` for the column mapping). Upserts by slug, so reruns update in place. Imports only every 2nd Mumbai row (pass `--full-mumbai` for all) and creates 5 picsum.photos placeholder images per listing.
- `seedData/builders.js` — popular developers per city, turned into published Projects by the seed (the builders directory is derived from Projects). Project names/prices are demo data.
- `seedData/generateCityDatasets.js` — `node scripts/seedData/generateCityDatasets.js` regenerates the synthetic per-city CSVs (Delhi NCR, Bengaluru, Pune, Hyderabad, Chennai, Kolkata, Ahmedabad, Kochi, Coimbatore, Nagpur, Jaipur, Chandigarh; 600 rows each) in `../DataSet/`.
- `seedData/` — `parseCsv.js` and `transformDataset.js`, unit-tested in `../tests/seedDataset.test.js`.

No migration scripts exist yet beyond index sync; that remains follow-up work.
