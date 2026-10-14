# Scraper Import Contract

**Status: FINAL.** The endpoint is live once the final import report says all tests pass.
For whoever writes the scraper. You send JSON; we validate it
and save each listing as a **draft** that an admin reviews before it appears on
the website.

## 1. Request

| | |
|---|---|
| Method and URL | `POST /api/v1/admin/import/properties` |
| `x-api-key` header | Shared secret from the backend owner. Missing or wrong gives `401`. |
| `Content-Type` header | `application/json` |
| Body | `{ "properties": [ ...items... ] }` |
| Max items | **100** per request (more gives `400`). Split big runs into batches. |
| Max size | **5 MB** (larger gives `413`). |

Send real JSON numbers (`25000`, not `"25,000"`). Text is trimmed for you.

## 2. Fields

### Required (an item missing or failing any of these is `failed`)

| Field | Rule |
|---|---|
| `source` | Site name, spelled the same every time (e.g. `"99acres"`). Max 100 chars. |
| `sourceUrl` | Original listing URL, `http`/`https`, max 2048 chars. **The unique key.** |
| `title` | 5 to 200 chars. |
| `intent` | `"buy"` or `"rent"`. |
| `propertyType` | `apartment`, `villa`, `independent-house`, `plot`, `pg-hostel`, `commercial`, `studio`, `penthouse`. |
| `areaSqft` | Number in sq ft, **greater than 0**. |
| `priceInRupees` | Plain number in rupees, **greater than 0**. Monthly amount for rent. |
| `city` | e.g. `"Pune"`. |
| `contactNumber` | 10-digit Indian mobile starting 6 to 9. `+91`, a leading `0`, spaces and dashes are cleaned for you; we save the 10 digits. Never shown publicly. |
| `imageUrls` | Array of `http`/`https` image URLs, each max 2048 chars. After removing duplicates there must be **5 to 20**. See "Photos" below. |

We never guess or default a required field.

### Optional (omit or send `null` when unknown)

| Field | Rule |
|---|---|
| `locality` | Max 100 chars. |
| `description` | `""`, or 20 to 2000 chars (shorten long ones first). |
| `bhk`, `bathrooms`, `balconies` | Number, 0 or more. |
| `floor` | Number. `0` = ground, `-1` = basement. |
| `furnished` | `furnished`, `semi-furnished`, `unfurnished`. |
| `facing` | `north`, `south`, `east`, `west`, `north-east`, `north-west`, `south-east`, `south-west`. |
| `yearOfConstruction` | Whole number, 1800 to this year + 5. |
| `ownership` | Free text. |
| `isLuxury` | `true`/`false`, default `false`. |
| `amenities` | Array of strings. |

### Do NOT send

- `images` (use `imageUrls`).
- Server-controlled: `_id`/`id`, `slug`, `ownerId`, `status`, `verified`, `featured`, `featuredRank`, `publishedAt`, `cityLower`, `imageFile`, `createdAt`, `updatedAt`.
- Unknown fields or typos.

Ignored fields never fail the item; their names come back in that item's `warnings`.

## 3. Re-imports

The cleaned `sourceUrl` is matched against existing listings:

| Existing listing is... | Result |
|---|---|
| still a **draft** | `updated`: every scraped field is overwritten. Anything you omit resets to empty/default, so **always send the full data**. |
| published or archived | `skipped`: nothing changes (an admin owns it). |
| not found | `created` as a draft. |

Import never changes `status`, `verified`, `featured` or `slug`. The same title on
different URLs is fine; both are saved.

**URL cleaning** (done for you): lowercases scheme and host, removes `#fragment`,
`user:pass@`, tracking params (`utm_*`, `gclid`, `fbclid`, `msclkid`, `dclid`,
`yclid`, `mc_cid`, `mc_eid`, `_ga`, `igshid`) and trailing slashes, and sorts the
remaining params. Params like `?id=42` are kept; path case is kept. The cleaned
URL comes back in `results[].sourceUrl`.

## 4. Photos

`imageUrls` are **not** saved as links. After the response is sent, we download
each image in the background and re-upload it to our own storage, one listing and
one image at a time. This is why the import answers quickly even when photo hosts
are slow.

- Only public `http`/`https` hosts work (private and internal addresses are refused). Max 5 redirects, 10 seconds and 10 MB per image, and the response must be an image (SVG is refused).
- An image that fails is skipped; the rest still attach.
- A draft has an internal `imageImportStatus` (never returned by any API): `pending` (queued), `done` (every URL attached), `partial` (some failed), `failed` (none could be fetched). `partial` and `pending` listings are retried by an operator with `npm run import:retry-images`.
- Re-importing a draft only adds URLs not already saved. Existing photos, including ones an admin added, are never deleted or reordered.
- A draft with fewer than 5 photos is fine. An admin adds photos by hand; publishing still needs 5.

## 5. Response

`200` whenever the request itself is valid, even if some items fail.

```json
{
  "created": 1, "updated": 1, "skipped": 1, "failed": 1,
  "results": [
    { "index": 0, "sourceUrl": "https://example.com/a", "status": "created", "errors": [], "warnings": [] },
    { "index": 1, "sourceUrl": "https://example.com/b", "status": "updated", "errors": [], "warnings": ["agentName"] },
    { "index": 2, "sourceUrl": "https://example.com/c", "status": "skipped", "errors": [], "warnings": [],
      "reason": "Listing is no longer a draft (status: published), so it was not updated." },
    { "index": 3, "sourceUrl": "https://example.com/d", "status": "failed",
      "errors": ["intent must be one of: buy, rent", "areaSqft must be a non-negative number"], "warnings": [] }
  ]
}
```

- `index` = position in your array (from 0). The four counts add up to items sent.
- The same cleaned `sourceUrl` twice in one request: the first valid item is imported; each later one is `failed` with `Duplicate sourceUrl in this request (same as index N)`.
- A failed item lists **all** its errors. `warnings` is filled for any status.
- `reason` appears only on `skipped`. `sourceUrl` is `null` if missing or invalid.

Whole-request errors: `{ "error": { "message": "...", "details": [...] } }`

| Code | Cause |
|---|---|
| 401 | Bad or missing `x-api-key`. |
| 400 | Bad JSON, or `properties` missing / not an array / empty / over 100. |
| 413 | Body over 5 MB. |

## 6. Example item

```json
{
  "source": "99acres",
  "sourceUrl": "https://www.99acres.com/2-bhk-apartment-for-rent-in-koregaon-park-pune-spid-A12345",
  "title": "2 BHK Apartment for Rent in Koregaon Park",
  "intent": "rent",
  "propertyType": "apartment",
  "areaSqft": 1100,
  "priceInRupees": 42000,
  "city": "Pune",
  "contactNumber": "9876543210",
  "imageUrls": [
    "https://cdn.example.com/a12345/1.jpg",
    "https://cdn.example.com/a12345/2.jpg",
    "https://cdn.example.com/a12345/3.jpg",
    "https://cdn.example.com/a12345/4.jpg",
    "https://cdn.example.com/a12345/5.jpg"
  ],
  "locality": "Koregaon Park",
  "description": "Spacious, well-lit 2 BHK close to restaurants and the metro, with covered parking.",
  "bhk": 2,
  "bathrooms": 2,
  "balconies": 1,
  "floor": 4,
  "furnished": "semi-furnished",
  "facing": "east",
  "yearOfConstruction": 2018,
  "isLuxury": false,
  "amenities": ["Parking", "Lift", "Power Backup"]
}
```

## 7. Rules the scraper must apply itself

We will not guess these.

**`intent`**: check URL and breadcrumbs first (`for-sale`/`buy`/`resale` = buy,
`for-rent`/`rent`/`lease` = rent), then the headline or a Rent/Sale tag. Never infer
from price. If unsure, skip the listing or let it fail.

**`areaSqft`**: sq yd/gaj x 9, sq m x 10.764, acres x 43,560. Skip regional units
(bigha, kanal, marla, cent, guntha). Pick one area type (carpet, built-up or super
built-up) and use it for every listing from a site. For ranges use the lower
number or skip. Never send `0`.

**`priceInRupees`**: Lakh/Lac = 100,000, Crore/Cr = 10,000,000, K = 1,000. Skip
"Price on request". For rent, send the per-month amount.

**`propertyType`**:

| Site wording | Send |
|---|---|
| flat, apartment, builder floor | `apartment` |
| independent house, kothi, bungalow | `independent-house` |
| villa | `villa` |
| plot, land | `plot` |
| PG, hostel | `pg-hostel` |
| shop, office, showroom, warehouse | `commercial` |
| 1 RK, studio | `studio` |
| penthouse | `penthouse` |

If nothing fits, omit it so the item fails visibly.

**`bhk`**: read it from the title ("2 BHK"); omit if not stated.
