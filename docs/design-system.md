# TinyLink visual system

A quiet, typography-led workspace. Signal Violet identifies the main action and recorded activity; neutral surfaces keep the interface focused. The supplied reference is the design source.

## Palette

| Token         | Value     | Use                                 |
| ------------- | --------- | ----------------------------------- |
| Signal Violet | `#af50ff` | Primary actions, mark, chart line   |
| Lavender Mist | `#e1bdff` | Accessible dark-theme accents       |
| Near Black    | `#090909` | Dark canvas and primary-button text |
| Iron          | `#423738` | Dark artwork separators             |
| Graphite      | `#474747` | Strong dark borders                 |
| Soft White    | `#f0f0f0` | Light inset surfaces                |
| Almost White  | `#f7f9fa` | Light canvas and dark foreground    |

Semantic tokens in `app/globals.css` cover backgrounds, text, borders, overlays and states. Secondary text is adjusted for readable contrast; the reference's Ash and Steel are not used for small, low-contrast body copy. Status labels remain explicit instead of relying on color alone. Destructive actions use a separate functional danger color.

## Typography

The reference names Whyte Inktrap and Whyte Inktrap Mono. Licensed webfont files were not supplied. This release therefore bundles the reference's fallback fonts: **Inter Variable** and **IBM Plex Mono**, under their included SIL Open Font Licenses. It does not bundle or claim to render Whyte. Add licensed webfonts through `@font-face` to activate the existing first-choice family names.

Display type uses regular or light weights, tight spacing, fluid 36–64 px headings and restrained 49 px metrics on desktop. Monospaced section labels use 0.18 em tracking. Mobile form fields remain at least 16 px to avoid input zoom. The full 88–146 px reference scale is reserved for artwork rather than squeezing it into a working dashboard.

## Themes and interaction

The header offers **System**, **Light** and **Dark**. System follows the device preference. An explicit preference is applied before first paint and persists in local storage; storage failure still permits a current-page change. Storage events synchronize open tabs. All workspace surfaces, menus, dialogs, forms, charts, sample states and errors share the same tokens.

Motion is limited to short entries, control feedback and the chart trace. `prefers-reduced-motion` disables motion. Focus remains visible, mobile navigation respects the safe area, and sample records remain clearly labeled and read-only.

## Brand assets

- [Vector favicon](../public/favicon.svg), [32 px PNG](../public/favicon-32.png), [180 px touch icon](../public/apple-touch-icon.png)
- [Dark social preview](../public/brand/social-dark.png) and [light social preview](../public/brand/social-light.png), each 1200 × 630
- Editable, font-independent [dark SVG](../public/brand/social-dark.svg) and [light SVG](../public/brand/social-light.svg)

Open Graph and Twitter metadata use the dark card with absolute URLs, dimensions and alternative text. Social crawlers do not receive a visitor's theme preference; the light variant is supplied for manual use. Conversion-oriented copy emphasizes the product's real capabilities; no conversion uplift is claimed without measurement.

Rebuild artwork with `python scripts/render-brand.py` after installing `fonttools[woff]` in a Python environment and the pinned project dependencies. The script uses the installed sharp package to rasterize outlined SVGs. Generated files are checked in; production does not execute this script or request external font services.

## Release validation

The redesign passed the existing 40-test suite, lint, formatting, TypeScript and production build. Browser checks covered light/dark workspace and analytics views, dark dialogs, persistence after reload, mobile draft preservation across navigation, search and inactive filtering. The initial 320 px check found a small header overflow; the final stylesheet reduces spacing at that width. Reduced motion is handled by the existing media-query contract.

Core small-text and primary-button pairs were calculated at 5.13:1 or above. This is a bounded contrast check, not a complete accessibility certification. Open Graph and Twitter tags were inspected in rendered HTML, and both PNG cards were verified at 1200 × 630.

[Dark mobile workspace](assets/theme-dark-mobile.png) · [Light mobile workspace](assets/theme-light-mobile.png). These captures use labeled sample data; they contain no private destination records. The earlier release screenshots are retained as historical evidence.
