# UI/UX notes — Spark Study Assistant v0.3.0

This is a **native-inspired**, not Apple-affiliated, interface. It uses system fonts, quiet neutral surfaces, a single blue accent, restrained blur/shadows and generous touch targets. All design assets are local.

## Product principles

1. **One clear flow** — Scan, solve, review, apply. Never auto-submit to Spark.
2. **Context first** — Before a worksheet is found, show a friendly onboarding hero. After scan, compress the hero and bring questions above the fold.
3. **Editable answers** — All detected answers remain editable, with alternative API opinions shown for disputed items. Non-automatable question types say so explicitly.
4. **Honest status** — Separate waiting, success and error states. No guarantee of successful DOM clicks on inaccessible Spark controls.
5. **Progressive disclosure** — Collapsible questions and advanced API output settings reduce cognitive load, but do not hide essential controls.
6. **Controlled data flow** — Preserve endpoint validation and permission request at save. Do not display API keys, access tokens or cookies in the interface.

## UI map

| Surface | Structure |
| --- | --- |
| Popup, no worksheet | Header, introduction, Scan/Auto buttons, progress, status, help |
| Popup, scanned | Compact Scan/Auto bar, progress, status, worksheet summary, collapsible question cards, Solve/Copy, review/Apply |
| Settings | Left navigation, mode cards, active profile (single mode), profile manager/editor, privacy notes, sticky Save |

## Style tokens

- Canvas: `#f5f5f7` (light), `#111114` (dark)
- Text: `#1d1d1f` (light), `#f6f6f8` (dark)
- Accent: `#007aff` (light), `#0a84ff` (dark)
- Card radius: 15–20px; grouped control radius 11–13px
- Motion: 160–200ms for hover/focus only, disabled for `prefers-reduced-motion`
- Font: `-apple-system`, BlinkMacSystemFont, native system fallback

## Accessibility

- Real buttons, labels, fieldsets, radio buttons, `<details>` disclosure controls.
- Keyboard-visible focus styles on buttons, inputs and selections.
- `aria-live="polite"` on status/result text. Controls have accessible labels.
- A reduced-motion mode and OS-controlled dark/light theme.
- Neither the popup nor settings depend on hover-only interactions.

## Scope & limitations

- v0.3.0 is a UI-focused update. `background.js`, `content.js`, `providers.js` and `solver.js` are unchanged.
- The historical **offline rule engine** remains available for compatibility and as the existing fallback. No new offline engine is installed.
- A Chrome MV3 page is still subject to the source site's iframe DOM/access limitations, content scripts and Chrome permissions.
- UI was exercised in a local Chromium mock: 408px popup and 1440px / 390px settings, with provider switching, mode selection, save and answer apply mocked. It has **not** been verified end-to-end against a logged-in NGL Spark account.
- Demo screenshots use invented worksheet content and dummy provider profiles. They are not evidence of live API/Spark success.

## Run tests

```bash
node --test tests/*.test.js
```

Review checklist for manual Chrome testing:

- Install/update the unpacked extension, then **Reload** it in `chrome://extensions/`.
- Open an assigned Spark worksheet; scan, solve with one API, edit one answer, apply to the webpage.
- Test comparison mode including disagreement and a failed API request.
- Open Settings, edit/select profiles, switch provider, change endpoint, save and grant permissions.
- Reopen Settings to confirm persistence; verify error states for no API key, unsupported model and permission rejection.
- Test popup scroll/keyboard navigation and Chrome system dark mode.
