# Landing Page Brief - v3

Project: HomeNest real-estate platform (working name)
Page: Public home page
Status: Draft v3 (implemented; see §14 for where the build differs from this brief)

---

## 1. Purpose

The landing page gets a visitor into a relevant property search quickly, and gives them reasons to trust the platform. It is the front door for the public website.

Scope for the property detail page, results page, Post Property form, login/signup UI, and anything in the platform PRD's Future scope section (map search, saved-search alerts, multi-language, the mobile app) is defined there, not here. This brief covers only the home page.

---

## 2. Audience

| Visitor | What they want from this page |
|---|---|
| Buyer | Find properties for sale in a chosen area and budget |
| Renter | Find rentals in a chosen area and budget |
| Owner or agent | Post a property and reach seekers |
| Casual browser | No fixed intent yet, browsing popular locations, categories, or new launches before committing to a search |
| Returning visitor | Resume a previous search via a recent-searches strip (see §4), or check saved/favourited properties |

---

## 3. Goals

Start a search within two interactions.
Send owners and agents to Post Property.
Show that listings are reviewed and information is clear.

### How we will know it works

| Goal | Event to track |
|---|---|
| Start a search within two interactions | `hero_search_submit` (intent, location, whether it came from a recent-search chip) |
| Send owners and agents to Post Property | `post_property_click` (source: navbar, Sell tab, or footer) |
| Show reviewed, clear listings | `featured_card_click`, `category_tile_click`, `location_tile_click` |

No numeric targets are set for these events yet. A pre-launch project has no traffic to baseline against, so any percentage here would be invented. Set targets once there's a few weeks of real sessions to measure against, and treat the events as directional in the meantime.

**Event contract**: every event above also carries `page: "home"`, `viewport: mobile|tablet|desktop`, and a session id, so funnels can be split by device without a separate tracking plan later. The analytics tool is GA4, loaded only after the visitor accepts the consent notice and only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set. All events fire through a single `trackEvent()` wrapper (`frontend/src/lib/trackEvent.js`), not the vendor SDK directly, so swapping providers doesn't touch component code. The wrapper adds `page`, `viewport` and a per-tab session id, and strips keys that could carry personal data (keyword, email, phone, name).

Because the two-interaction goal assumes a location is entered (search is not submittable without one, see §5), the natural reading is: select a tab (interaction 1), enter a location (interaction 2), submit. A recent-search chip collapses that to one interaction plus submit.

---

## 4. Page structure

| # | Section | Purpose | Content | Build order |
|---|---|---|---|---|
| 1 | Navbar | Navigation | Logo, Buy, Rent, Sell, Commercial, New Projects, Login or Sign up, Post Property button | 1 |
| 2 | Hero | Start a search | Headline, one line of support text, Buy / Rent / Sell tabs, search bar, recent-searches strip for returning visitors | 2 |
| 3 | Featured properties | Show real inventory | Up to 8 property cards (built as a single showcase panel of up to 5, see §14) | 3 |
| 4 | Popular locations | Quick entry by area | 8 to 12 location tiles with listing counts | 5 |
| 5 | Property categories | Quick entry by type | Apartments, Villas, Independent Houses, Plots, PG/Hostels, Commercial | 4 |
| 6 | New projects | Show launches | Up to 4 project cards | 6 |
| 7 | Why choose us | Build trust | 4 short benefits | 8 |
| 8 | Insights | Useful content | 3 latest articles | 7 |
| 9 | App promotion | Set expectations | Short note that a mobile app is planned | 9 |
| 10 | Footer | Links and legal | Company, property links, support, contact, legal, social | 1 |

The build also includes a **Sell banner** under the hero and a **Builders promo** between New projects and Why choose us (links to the builders directory). Neither is part of this brief's original scope.

**Recent searches strip (Hero, §2 persona)**: for a returning visitor, show up to 5 recent searches as quick-entry chips, sourced from the search history the platform already persists (last 5, per §9.2). Hidden entirely for a first-time visitor rather than shown empty.

**Selection logic** (needed once more than the display cap is flagged, otherwise ordering is undefined and looks random on every refresh):
- **Featured properties**: ordered by the admin-defined feature order (FR-013) first. If order is unset for some listings, fall back to most-recently-published for those, appended after the ordered ones.
- **Popular locations**: admin-flagged list, in the admin-defined order; a location needs a minimum of 5 active listings to qualify, so a sparse city doesn't appear with a near-empty results page behind it.
- **New projects**: 4 most recently published, regardless of category.
- **Insights**: 3 most recently published articles.


---

## 5. Hero search

| Field | Control | Notes |
|---|---|---|
| Intent | Tabs: Buy, Rent, Sell | Buy is the default. Sell shows a Post Property panel instead of search fields. |
| Location | Text input with suggestions | Suggest cities and localities after two characters |
| Property type | Dropdown | Options change with the tab |
| Budget | Dropdown with presets | Separate presets for Buy and Rent |
| Search | Button | Opens the results page with choices in the URL |

**Sell tab panel**: replaces the four search fields with one line of supporting copy ("List your property and reach interested buyers and tenants"), the same Post Property CTA button used elsewhere, and, if the visitor is not logged in, a note that posting requires an account rather than a hard redirect. Any city and property type already entered on the tab before switching to Sell carry into the Post Property form as prefilled values (FR-012), rather than being dropped.

**Location autocomplete contract**:
- Trigger after 2 characters, 300 ms debounce.
- Show up to 6 suggestions, grouped by City then Locality.
- Empty result: show "No matches, try a nearby city" rather than an empty dropdown.
- Keyboard: arrow keys move selection, Enter selects, Escape closes.

**Budget presets**: defined once in the platform requirements spec, separately for Buy and Rent. This page reads that single source; do not restate the bracket values here, to avoid two lists drifting apart when a preset changes.

**Search submission and required fields**: location is required. The search button stays disabled until a location is chosen, consistent with §3's two-interaction goal. Property type, if left unset, defaults to "All types" rather than blocking submission. *As built:* the button is not disabled for an empty location; typed text that was not picked from the suggestions is resolved to the first suggestion, or submitted as a keyword (`q`) search (see §14).

**Results routing**: search submits to `/search` with intent, city, locality, and a numeric price range (min/max), not a preset id, so a shared results link still resolves correctly if the presets are edited later. Exact query-parameter names follow the platform's existing routing spec rather than being redefined here. As built, the parameters are `intent`, `city`, `locality`, `q`, `propertyType`, `bhk`, `minPrice`, `maxPrice`, `sort` and `page`; the hero also offers a BHK select (1, 2, 3, 4+).

---

## 6. Property card

Image, price, property type and BHK, area, location, up to three amenities, Verified or Featured badge, save icon, "View details" button.

**Field precedence and states**:
- Amenities: show the 3 highest-priority amenities present (priority order defined by ops/content, e.g. Parking, Lift, Power Backup ranked above Garden, Clubhouse), not just the first 3 in the data.
- Badge: a listing can be both Verified and Featured. Show Featured (commercial priority) with a small "Verified" checkmark beside it rather than two stacked badges.
- **Verified** means the listing passed the admin review checklist (details, photos, and address match what's listed). It does not confirm ownership or title, and no ownership documents are stored, so copy and tooltips must not imply either. **Featured** means an admin chose to promote the listing; there is no payment flow in scope, so it is never described as "paid placement."
- Save icon: if the visitor is not logged in, clicking it opens the login prompt instead of silently failing; on successful login the property is saved automatically.
- Image: single hero image per card, no gallery on the card. Only the hero section's image is preloaded/eager-loaded; Featured properties sit below the hero and are typically below the fold on first paint, so they lazy-load like the rest of the page, in line with the LCP target in §11.
- **Phone-number protection**: cards and the eventual detail page must not render an owner/agent's raw phone number in page HTML. The number is fetched via an authenticated API call after login (FR-035), not exposed to anonymous page markup and not routed through any telephony/proxy-number system.

---

## 7. Content and tone

Plain and factual. No exaggerated claims or fake urgency.
Only state benefits the platform actually delivers.

Suggested headline: "Find the right place, without the noise."
Suggested support line: "Search reviewed listings for sale and rent, and contact owners and agents directly."

**Why choose us**: each of the 4 benefits must map to something the platform actually does operationally, and must stay consistent with the Verified/Featured definitions in §6, for example "Every listing passes an admin review" rather than any claim about ownership or title checks. Do not write trust copy ahead of the process it describes.

**Microcopy inventory**: small strings the visual design will otherwise invent ad hoc, causing inconsistency between sections: empty search state, no-suggestions state, "Saved" confirmation toast, login-required prompt copy, section empty-states (§11). Worth a single copy doc so these aren't each written differently by whoever builds that section.

---

## 8. Design direction

| Item | Direction |
|---|---|
| Feel | Clean, modern, trustworthy, calm |
| Colour | Deep teal primary (#0E7C7B), warm amber accent (#F2A541), light grey background |
| Type | Plus Jakarta Sans for headings, Inter for body |
| Layout | 12-column grid, max width 1280 px, generous spacing |
| Imagery | Bright, natural photos with a proper licence |
| Originality | Do not reuse any competitor's branding, layout, copy or images |

**Colour contrast check**: amber (#F2A541) as body or small text on the light-grey background is unlikely to clear the 4.5:1 target in §11, so reserve it for accents, icons, and large/bold text on that background. Where amber is used as a solid background (buttons, badges), pair it with dark, near-black text (roughly 8:1 contrast); white text on amber is around 2:1 and fails outright. Verify both brand colours against WCAG AA before locking the palette.

**Dark mode**: not required for v1. Stating this now keeps the component library from carrying theming overhead the page doesn't need yet.

**Font loading**: load Plus Jakarta Sans and Inter via `next/font` rather than a Google Fonts `<link>`, with `font-display: swap`. An external font request on the critical path works against the LCP target in §11.

---

## 9. Responsive behaviour

| Device | Behaviour | Breakpoint |
|---|---|---|
| Mobile | Single column, hamburger menu, stacked search fields, carousels for cards | < 640px |
| Tablet | Two columns, condensed navigation | 640-1023px |
| Desktop | Horizontal search bar, 3 to 4 card columns, full navigation | >= 1024px |

Breakpoints match Tailwind's defaults (`sm`/`md`/`lg`) since §10 already commits to Tailwind.

---

## 10. Data and technical notes

| Section | Source |
|---|---|
| Featured properties | API: published listings flagged Featured |
| Popular locations | API: locations flagged Popular, with counts |
| Categories | API: category list with counts |
| New projects | API: published projects |
| Insights | API: latest published articles |
| Static content | Hero copy, Why choose us, footer |

Prices come from the API as whole-rupee numbers. The interface formats them (for example ₹85 L, ₹1.2 Cr).

**Framework choice**: use Next.js, not React with Vite. The SEO requirement in §11 (server-rendered or pre-rendered, unique meta per page, OG image) is native to Next.js and would otherwise need a separate SSR/prerender solution bolted onto Vite.

**Mock data contract**: originally this brief asked for one TypeScript type per API section above before writing mock data. *As built:* the project is plain JSX, mock data has been removed, and every section reads the real API through `frontend/src/lib/dataSource.js`, which normalizes each response into the shape the components use.

**Price formatting edge cases**: values under ₹1L (e.g. rent ₹18,000) render as ₹18,000, not ₹0.18L. The Lakh/Crore formatter needs a threshold, not a blanket conversion.

---

## 11. Quality targets

| Area | Target |
|---|---|
| Performance | Largest Contentful Paint under 2.5 s on a mid-range phone over 4G. Compress and preload the hero image. Lazy load images below the fold. |
| Accessibility | Text contrast of at least 4.5 to 1. Every control reachable by keyboard with a visible focus outline. Alt text on meaningful images. One H1 per page. |
| SEO | Unique title and meta description, semantic headings, Open Graph image, server-rendered or pre-rendered page. Links from the page point to readable URLs, for example /property/2-bhk-apartment-for-rent-koramangala-bengaluru-x7k2. |
| Loading state | Skeleton cards while data loads. |
| Empty state | Hide a section when it has no data (for example no featured properties) instead of leaving a gap. |
| Error state | Short message with a retry button. Never a blank area. |

**Additions**:

- **Performance**: budget Cumulative Layout Shift (CLS) under 0.1 by reserving image/card dimensions up front, and a JS bundle budget for the home page (for example under 200KB gzipped initial load), since 6 API-backed sections plus carousels can grow quickly.
- **Accessibility**: icon-only controls (save icon, hamburger, carousel arrows) need an `aria-label`, not just a visible icon. Carousels must be operable by keyboard and respect `prefers-reduced-motion` (no auto-advancing). Add a skip-to-content link before the navbar.
- **SEO**: add `Organization` and `WebSite` JSON-LD structured data to the home page, plus a canonical URL tag and a robots.txt/sitemap entry. `RealEstateListing` structured data belongs on the property detail page (FR-171), not here.
- **Abuse protection**: rate-limit the search/autocomplete endpoint against scraping. No CAPTCHA on autocomplete; it would get in the way of a feature meant to speed up search.
- **Privacy**: add a lightweight analytics-consent notice if any analytics cookies are set. The home page itself doesn't collect phone numbers or other PII directly, so this stays to one line rather than a broader compliance section.
- **Error-state detail**: the retry button re-fetches only the failed section, not the whole page. With 6 independent API sections, one failure shouldn't force-retry the 5 that already succeeded.

---

## 12. Before building

Review the three reference sites (structure only, no copying) and note section order, hero fields, card fields and footer groups.
Confirm final name, logo and colours.
Collect licensed images.
Wireframe mobile and desktop.
Prepare mock data for the cards.

**Add to this list**:
- Confirm the analytics tool for the events in §3, so `trackEvent()` is wired to something real instead of a stub.
- Confirm this page's budget dropdown reads from the single platform-wide preset source (§5) rather than a separate hard-coded list.
- Confirm the amenity priority order referenced in §6 with ops/content.
- Decide the analytics-consent approach before writing any tracking code (§11).

---

## 13. Related, out of scope here

Map view, saved-search alerts, an app waitlist, and multi-language support are already tracked in the platform PRD's Future scope section; not restated here to avoid two scope lists drifting apart. An agent/owner "My listings" dashboard entry point is already specified (a Dashboard link in the user menu), so it isn't an open question for this page.

---

## 14. Current implementation status

Reviewed against the code on 2026-10-13. The home page is built in Next.js 16 with Tailwind and reads only live APIs.

**Matches this brief**

- Hero tabs Buy (default) / Rent / Sell, with the Sell panel (CTA, login note, city and type carried into Post Property).
- Location autocomplete: two characters, 300 ms debounce, up to six suggestions (cities, then localities), the "No matches, try a nearby city" message and full keyboard handling.
- Numeric min/max price in the search URL, budget presets from one source (`budgetPresets.js`), and recent-search chips (up to five, hidden when empty).
- Categories, Why choose us (four items), Insights (three latest articles) and the App promotion note.
- Skeletons while loading, sections hidden when empty, and a retry that re-fetches only the failed section.
- Events `hero_search_submit`, `post_property_click`, `featured_card_click`, `category_tile_click` and `location_tile_click` through `trackEvent()`, plus `sell_banner_click`, builders-promo clicks and `search_submitted`.
- Colour tokens `#0E7C7B` and `#F2A541` (near-black text on amber), Plus Jakarta Sans and Inter via `next/font` with `swap`, visible focus outlines, `aria-label` on icon controls, reduced-motion support.
- Property card: top three amenities by priority, Featured badge with a Verified check, login-gated save that completes after login, and contact numbers fetched only through the authenticated API.
- Organization and WebSite JSON-LD, `robots.txt` and a sitemap of static routes plus published properties, projects and articles; opt-in analytics consent notice.

**Differs from this brief**

- **Featured properties** are a single showcase (large panel, thumbnail rail, pause button) limited to five listings, not a grid of up to eight. It uses the navbar city and falls back to a nationwide list with a notice. The admin UI still mentions "up to 8", which is the backend limit on how many listings can be featured at once.
- **Popular locations** have no 8 to 12 cap; the tile count is whatever the API returns after the five-active-listing rule is applied in the client.
- **Search button** is not disabled without a location (see §5).
- **Hero background** is a slider of four placeholder images that auto-advances every six seconds with dots and arrows but no pause control (it does stop under `prefers-reduced-motion`). Licensed imagery is still to be sourced.
- **Skip-to-content link** is not implemented (the `main-content` anchor target exists); dark mode is not implemented, as intended for v1.
- **Structured data**: Organization and WebSite JSON-LD are emitted site-wide from the root layout, not only on the home page, and property pages have Open Graph and Twitter metadata but no `RealEstateListing` JSON-LD yet. The default Open Graph image is the starter `next.svg`.
- **Footer** social links point to the generic network home pages, and contact addresses use `@homenest.example` placeholders.
- **New projects** shows what the API returns (the backend returns the four newest published projects) and filters to the selected city when it can.
