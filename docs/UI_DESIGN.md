# Design system · v0.4.0

**Design intent:** a pocket-sized, review-first study tool. The user is a learner working in a small extension popup, often with an assignment occupying the main browser window. The dominant task is **scan → solve → inspect → fill**. Submission and navigation are explicit, higher-risk secondary actions.

This is an in-place redesign following [Hallmark's](https://github.com/nutlope/hallmark) `SKILL.md`, `references/responsive.md`, `references/interaction-and-states.md` and `references/slop-test.md`. Hallmark's creative principles were applied inside the existing vanilla HTML/CSS/JS architecture, preserving DOM ids and the existing scanning/solver/provider logic. The user explicitly requested Apple/iOS, so that direction took precedence over choosing a Hallmark catalog theme.

## Interface structure

- **Popup:** 376 CSS px. Compact identity → status/mode strip → Scan and Solve & fill → 3-stage progress → scanned exercise → bounded question region → two-row action dock. Higher-risk submission is visually secondary and initially disabled.
- **Settings:** persistent sidebar (two-column nav grid under 760 px) → language and appearance → answer mode → submit workflow → AI profiles → privacy. Persisted save bar stays reachable.
- **Typography:** platform system text stack (SF on Apple devices) as a deliberate iOS design requirement. Clear 10–20 px scale for compact controls and 17–32 px scale for settings.
- **Color:** system-like surfaces with sparing blue interaction accent. Status semantic colors separate successful, pending and failed states. All colours and font stacks use shared CSS tokens.
- **Motion:** microinteraction color/background changes; reduced-motion preference removes transitions. No fake app chrome, decorative gradients, hover scale animations or animated number counters.
- **Accessibility:** native buttons, `fieldset`/radio modes, editable `<select>` and text fields, focus-visible outlines, `aria-live` status, content-based disabled states and no horizontal scrolling at 320/375/390/414/768 px.

## Localization

`i18n.js` is the single UI lexicon for `en`, `vi`, `zh-CN` and `zh-TW`, with English as the first-run default. Static visible strings use `data-i18n`; dynamic content uses `SparkI18n.t`. Saved settings use `uiLanguage` and `uiTheme` in `chrome.storage.local`; `manifest.json` has the corresponding browser-supported locale directories (`en`, `vi`, `zh_CN`, `zh_TW`). Explanations from models are not forcibly translated because they are untrusted content returned by the configured engine.

## Submission safety

`Submit & next` requires a successful fill report for **every item** in the latest frame scan, an explicit user click + browser confirmation dialog, and a visible enabled Check Answers control. The content script locks the action against replays. Navigation requires an observed check-state change and an unambiguous enabled Next learning object control; otherwise it stops. It does not claim to replace the site's final score submission until observed and tested.

## Hallmark self-audit

| Axis | Score (1–5) | Why |
|---|---:|---|
| Philosophy | 5 | Review-first learning, not auto-clicking for its own sake. |
| Hierarchy | 5 | Primary scan/solve actions, visible answer list and restrained secondary controls. |
| Execution | 4 | Chromium smoke tests passed; site-specific integration remains to be verified. |
| Specificity | 5 | Purpose-built around Spark frame anatomy and a small popup. |
| Restraint | 5 | No hero gradients, fake iPhone frames or remote font/UI runtime. |
| Variety | 4 | Popup utility workspace and Settings preferences page use distinct rhythms. |

**Checks performed:** multilingual UI rendering, explicit light/dark themes, vertical scrolling without horizontal overflow in Chromium, disabled state checks, reduced-motion styling, per-frame submission simulation. These are not substitutes for testing a live Spark assignment.
