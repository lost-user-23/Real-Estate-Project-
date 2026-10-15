# Property Finder assistant

A guided chat that matches visitors to real, published HomeNest listings.
Express + MongoDB only; no separate service.

- API: `POST /api/v1/assistant/chat` (public, rate limited: 40 turns / 10 min / IP)
- UI: floating "Find my home" button on every public page, and a full page at `/property-finder`
- Code: `backend/src/services/assistant/`, `frontend/src/components/assistant/`

## AI provider credentials (optional)

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic API key. **Empty = no AI**; the rule-based reader is used and every feature still works. |
| `ASSISTANT_AI_MODEL` | Model for preference extraction. Default `claude-haiku-5-5`. |
| `ASSISTANT_AI_TIMEOUT_MS` | Provider timeout before falling back to rules. Default `8000`. |

Server-side only (`backend/.env`). Never expose it to the frontend. Each chat turn with a key set costs
one small API call, which is why the endpoint has its own rate limit.

## How it works

1. **State.** The client sends back `{ prefs, skipped, expecting, searched, lastStats }` each turn. The server
   rebuilds it through `sanitizeState` every time, so tampered state is reduced to supported fields and values.
2. **Understanding.** `ruleExtractor.js` reads the message deterministically (Indian budget units, BHK,
   sq ft / sq yd / acre, cities and localities from the inventory, "cheaper", "another locality", ...). If a key is
   configured the model also proposes preferences through one forced tool call. Rules win key by key.
3. **Validation.** Everything (message, model output, button actions) goes through `sanitizePatch`: unknown
   fields (`status`, `$where`, `ownerId`, ...), bad types, out-of-range values, unsupported enums, and cities or
   localities with no published listings are dropped or turned into a clarifying question. Model output is never
   used in a query.
4. **Search.** `search.js` builds the filter itself: `status: 'published'` always, plus intent, type, budget,
   city. Locality, BHK, area, furnishing, possession and amenities decide *exact* vs *approximate*. Budget, type,
   intent and city are never relaxed unless the user taps a broadening option, and those options are only offered
   when a real count shows they would produce listings.
5. **Replies.** All wording is templated from validated state and database rows. The model writes nothing the
   visitor reads, so availability, prices and features cannot be invented.

## Behaviour notes

- Question order: buy/rent, type, budget, city, then locality and BHK/size. Any question can be skipped, and
  anything already stated is not asked again. A message that carries three or more preferences skips the optional
  questions and searches immediately.
- Plots are sale-only and PG/hostels rent-only (same as the site's search); a conflicting request gets a clear
  explanation and a choice.
- **Possession:** listings have no possession-status field. "Ready to move" / "under construction" is derived
  from `yearOfConstruction` (on or before / after the current year). Listings without a year are shown as
  approximate with "Possession status not listed".
- Cards show only public serializer output (no contact numbers, owner ids or status). Callback requests post to
  the existing `/api/v1/contact-messages` endpoint, only after the visitor ticks an explicit consent box; the
  assistant API never receives those details. EMI and loan buttons link to the existing calculator and loan
  enquiry form with the amount and property prefilled (purchases only).
- Conversation state lives in the browser's `sessionStorage` so it survives navigating to a listing and back.

## Tests

`cd backend && npx jest tests/assistant.test.js` (needs a local mongod; the suite refuses Atlas) covers: buying a
plot, flat with budget, renting a house, a complete first message, missing/ambiguous budget and location, no
matches, changing preferences after results, and invalid or malicious model/client input.
`cd frontend && npm test` covers the loan/EMI link helpers.

## Two modes: rule-based (default) and AI-enhanced (optional)

- **Rule-based mode** (`ANTHROPIC_API_KEY` empty or absent): `ruleExtractor.js` reads every message. No outbound
  calls are made, nothing is logged or shown about a missing key, and search, refinement, comparison, EMI/loan links
  and callbacks all work. This is the mode covered by the automated tests, and the one the live site runs in until a
  key is added.
- **AI-enhanced mode** (key set): the model additionally proposes preferences for phrasing the rules miss. Rules
  still win key by key, the output is validated like any other input, and any provider failure (timeout, network,
  non-200, malformed output) silently falls back to rule-based for that turn.
- Not yet verified: the AI-enhanced mode against the live Anthropic API. Tests use a mocked provider and a mocked
  failing `fetch`. Try it once with a real key before relying on it.

## Chat layout

The conversation is a single scrolling region. Follow-up actions ("Search all of Jaipur", "Raise budget", "Change
city", ...) are rendered inside the assistant message they belong to, below its property cards, and are shown only
on the latest assistant message. The composer sits outside the scrolling region. The view follows new messages only
when the reader is already near the bottom or has just sent something.
