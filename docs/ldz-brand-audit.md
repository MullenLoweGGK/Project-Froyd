# Liga za duševné zdravie — brand audit

Reference sites inspected on 2026-07-28:

- https://dusevnezdravie.sk
- https://dusevnezdravie.sk/stranka/prva-pomoc/

Source of truth: live CSS (`/_nuxt/entry.*.css`), computed styles via DevTools, and public assets. Values marked **verified** were read from CSS or computed style. Values marked **observed** come from visual inspection.

## Colour palette (verified)

| Token | Hex / value | Usage |
|-------|-------------|--------|
| Primary blue | `#005d8c` | Body text, headings default, outlined buttons, links |
| Accent blue | `#008ec6` | Logo wordmark accents, secondary brand blue |
| Warm yellow / gold | `#f9b122` | Secondary (filled) CTA background |
| Warm orange | `#f39313` | Secondary CTA hover; orange section headings (h2) |
| Footer / soft blue | `#ebf6fa` | Footer background |
| Soft blue tint | `#d8eaf1` | Light surfaces |
| Soft blue tint 2 | `#008ec614` | Subtle fills |
| White | `#ffffff` | Page background, primary button fill on dark heroes |
| Near-black | `#212529` | Bootstrap body fallback (rarely dominant) |
| Danger | `#dc3545` | Error states (Bootstrap) |

Hero intro uses a warm gold photographic/pattern background (`intro-bg_2x`) with **white** headline and body text (**observed** / CSS `.intro__headline{color:#fff}`).

## Typography (verified)

Site self-hosts Poppins under custom family names:

| Site family | Weight | Mapping |
|-------------|--------|---------|
| PoppinsLight | 300 | Poppins 300 |
| PoppinsRegular | 400 | Poppins 400 |
| PoppinsMedium | 500 | Poppins 500 |
| PoppinsBold | 700 | Poppins 700 |

**Font licensing note:** Proprietary `.woff2` files from the LDZ Nuxt build were **not** copied. Microsite uses Google Fonts **Poppins** via `next/font/google` (same typeface, permitted web distribution).

### Scale (verified from CSS)

| Element | Desktop | Mobile |
|---------|---------|--------|
| h1 | 56px / 72px line-height | 32px / 42px |
| h2 | 28px / 40px | 22px / 34px |
| h3 | 22px / 34px | 16px / 24px |
| Body | 16px, PoppinsRegular, colour `#005d8c` | same |
| Button | 16px PoppinsMedium; intro CTA 18px PoppinsBold | full-width / reduced padding |

Headings: `PoppinsBold`, colour `#005d8c` by default; many marketing h2/h3 use `#f39313` (**verified** computed style).

## Buttons (verified)

Base `.button`:

- Transparent background
- `border: 2px solid rgba(0,93,140,.2)`
- `border-radius: 100px` (pill)
- Colour `#005d8c`
- `min-height: 56px`
- `padding: 14px 38px`
- PoppinsMedium 16px / 24px
- Transition ~0.22s

Variants:

- `.button--primary` — outlined; hover `background #005d8c0d`
- `.button--secondary` — filled `#f9b122`, text white; hover `#f39313`
- `.button--tertiary` — white fill; hover border `#005d8ccc`
- Solid blue CTAs also appear (e.g. `.outro.btn-blue a` → `#005d8ccc`, hover `#005d8c`)

## Layout & spacing (verified / observed)

| Token | Value | Notes |
|-------|-------|-------|
| Container max-width | `1224px` (also Bootstrap up to `1320px`) | `.container` override |
| Header padding | 36px 80px → 24px 15px mobile | |
| Footer padding | 96px 0 12px → 40px 0 12px mobile | bg `#ebf6fa` |
| Card / panel radius | `24px` common; pills `100px` | |
| Soft shadow | `0 12px 32px #0000000f` | `.logo-panel` |
| Header logo height | 48px | |

## Navigation & chrome (observed)

- White header, subtle bottom border `rgba(0,93,140,.04)`
- Logo left; text nav; helpline pills; full-width “Darujte teraz” bar under nav on homepage
- Footer: soft blue, multi-column links in primary blue; hover orange `#f39313`
- Legal: Ochrana osobných údajov → `/ochrana-osobnych-udajov`

## Assets downloaded to `/public/ldz/`

| File | Source |
|------|--------|
| `logo.svg` | `https://dusevnezdravie.sk/_nuxt/logo.CtlokTJc.svg` |
| `icon.svg` | same logo (site icon) |
| `favicon.ico` | `https://dusevnezdravie.sk/favicon.ico` |
| `intro-bg.jpg` | Nuxt `intro-bg_2x` (resized for web) |
| `hero-illustration.png` | WP `banner-1.png` hero artwork (resized) |
| `icon-arrow.svg` | Recreated from LDZ arrow SVG markup in CSS |

## Responsive observations

- Breakpoints around 575 / 767 / 991 / 1199 / 1399 (Bootstrap-like)
- Buttons widen toward full width on small screens
- Header compresses padding; logo remains visible
- Hero min-height ~544px desktop / ~480px smaller (**verified** CSS)

## Approximations

- Exact hero gold hex from the JPEG texture was not sampled as a single flat swatch; CSS uses the image. Microsite may use `#f9b122` / `#f39313` as solid fallbacks when not using the image.
- Exact letter-spacing on nav links not exhaustively measured; default Poppins metrics used.
