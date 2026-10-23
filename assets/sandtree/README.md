# Sandtree listing data

## `activity.json` — cumulative views/saves (permanent rule)

**Displayed Views / Saves are always cumulative.** Never show Active-only portal numbers after the Coming Soon → Active flip.

- **`preLaunch`** — Coming Soon portal baseline (frozen Oct 22, 2026, 8:02 PM ET: Zillow 231/36, Redfin 47/3, Homes.com 199). **Never delete, zero, or overwrite on refresh.**
- **`sources`** — current Active portal scrapes only. Safe to overwrite on each refresh.
- **Displayed total** = `sum(sources)` + `sum(preLaunch)` + live site visits (Abacus). The Listing activity ticker in `listings.html` computes this. `totals` in JSON is reference only and must also stay cumulative (Active + preLaunch).

### Refresh checklist (every views/saves update)

1. Scrape live Active counts into `sources.*` and set `updated` / `*_as_of`.
2. Leave `preLaunch` untouched.
3. Recompute `totals.views` / `totals.saves_favorites` as Active portals + preLaunch portals (not Active alone).
4. Do not invent numbers; do not replace cumulative with reset-only portal figures.

### Ticker `items`

Status label is **"Just listed"** (was "Coming Soon" before Active).
