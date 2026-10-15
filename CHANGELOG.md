## v0.7.3 — Review multi-screen QTI, safe order preview

- Analyze 8 additional inspector captures: Real life sequence screens, 10-screen Review radio sets, and Writing skill. As requested, **Speaking and Writing (including Writing skill) remain deferred**.
- Detect the `os-sequence` tiles of the active Spark screen; use the published `orderInteraction` declaration to reconstruct the exact sentence and punctuation only when every visible tile matches **one uniquely identifiable QTI XML assessment**. This is **read-only answer preview**, not automated dragging or submission.
- Harden QTI assessment selection for Review radio groups where multiple screens reuse `C0_0` / `RESPONSE0`: cross-check option labels against the displayed text or against the per-ID DOM label mapping, and abstain on conflicts. Never infer by XML file order or shuffled visual position.
- Improve exercise copy and scan for sequence tiles, active-screen isolation and manually handled tasks. Keep Solve & fill, Copy full exercise, and the v0.7.2 Submit & next safeguards unchanged.
- Add 10 dedicated Node regression tests (123/123 total) and independent Chromium simulated integration checks for per-screen ordering plus shuffled 5-radio fill. The new inspector collection is not committed or sent to an API by the extension.
- Authenticated live Spark validation still required, especially for any eventual drag-and-drop adapter. Gradebook status and Next are **not** inferred from QTI.

## v0.7.2 — Submit to Gradebook / Next control fix

- Diagnose authenticated `1b | Grammar | 3` manual flow: `submit` changes from actionable to inactive after about 1.2 seconds; `forward_lo` navigates away, while `check` is hidden/disabled.
- Prefer a uniquely visible Spark `data-event="submit"` control; fallback to uniquely actionable `check` for other activity types. Never click a generic form submit or hidden duplicate toolbar controls.
- After explicitly confirmed, fully verified filling, wait for the *same connected* submission button to become disabled/inactive before requesting an unambiguous Next; otherwise stop with no retry and no navigation.
- Maintain optional Next preference and existing Speaking/Writing exclusions. Clarify in all UI languages that a disabled button is not proof of server-side gradebook persistence.
- Add regression tests and isolated Chromium tests for success, missing UI acknowledgement, disabled Next, and Check Answers fallback. Authenticated validation is limited to the user-supplied diagnostic trace.

## v0.7.1 — Compact popup controls & safe submission diagnostics

- Remove redundant **Solve** and **Fill selected answers** popup buttons while preserving the combined **Solve & fill** action and its QTI/API/application logic.
- Make **Copy exercise** retrieve the complete *active screen* prompt directly from Spark, including instructions, every question, word banks and answer choices. Do not copy input values, QTI answer keys or hidden screens.
- Retain guarded **Submit & next** without assuming the screen-forward and learning-object-forward controls are equivalent. Add a read-only diagnostic recorder to collect user-triggered before/after button state transitions without authentication data.
- Refresh multilingual copy labels and regression tests.

# Changelog

## v0.7.0 — Verified QTI adapters and multi-screen safety

- Implement scanner and verified click adapters for Spark's native radio/checkbox groups, matching C-group identifiers instead of shuffled visual positions.
- Extend QTI parsing to checkbox multi-select, text alternatives (`|` and multiple QTI values), exact partial-word gaps, and review-only `gapMatchInteraction` pairs.
- Scope DOM scanning to the active screen, separate QTI XML documents by question text and abstain when assessment mapping is ambiguous.
- Keep Speaking and all Writing categories, including Writing skill, outside the new adapter by request.
- Preserve provider/API fallback, existing customization, and confirmed submission workflow. Never auto-drag unknown controls.
- Add QTI adapter guide, update both READMEs and exercise-fixture coverage. 106 Node regression tests plus an isolated Chromium radio/checkbox smoke test; **live authenticated Spark still needs verification**.


## v0.6.1 — Wordbuilding shared banks & strict text QTI

- Add conditional shared-word-bank recognition for exercises that explicitly ask for words or phrases from a box. Exclude the unnumbered vocabulary bank from question counts and preserve its terms in each editable blank.
- Display the word bank in popup answer cards and copy reports; pass it to AI only for unresolved QTI questions.
- Tighten typed QTI mapping to explicit single string declarations and reject incomplete *play/do/go + phrase* responses where the word bank is available. Unknown drag-and-drop/matching interactions remain unsupported rather than guessed.
- Add a read-only Dashboard console inspector (`tools/inspect-wordbuilding.js`) and technical guide for collecting the real live DOM/QTI interaction shape without copying cookies, tokens or complete HTML.
- Extend Node regression tests to 95 passing and run Chromium six-gap text-entry fixture: six scanned questions, six QTI mappings and six filled native inputs. This fixture is **synthetic**; compatibility with the actual Wordbuilding page is not verified.


## v0.6.0 — QTI-first answers & smoother glass

- Introduce `qti.js`: a size-limited, non-executing parser for JSON-escaped `assessmentItem` XML embedded in published `data.js` files. Read declared `correctResponse` values and validate each mapping against visible choices and response IDs.
- Use QTI as the **first answer source**. Send **only unmatched questions** to existing AI profiles or legacy-rule fallback. Preserve already verified QTI matches when the fallback service fails.
- Check same-origin `/cdn_proxy/` script paths and scan revision identifiers; handle missing, unsupported or ambiguous interactions conservatively. Support single-choice and explicit text-entry QTI mappings; order/drag/drop remain unsupported.
- Speed up the interface: remove blur on nested popup question cards, buttons and sticky dock; reduce remaining material blur, batch card DOM updates and throttle pointer highlights to animation frames. Keep Light / Dark / System, backdrop colors and accessibility modes.
- Make QTI priority visible in the popup and Settings, with English / Vietnamese / Simplified Chinese / Traditional Chinese copy.
- Rebuild the English and Vietnamese README with illustrated features, QTI/API fallback diagram, accurate project tree, installation and limitations. Add `docs/QTI_READER.md`.
- Extend automated tests from 79 to 88 passing Node tests; run Chromium integration checks for browser XML parsing, full QTI with zero API calls, partial QTI calling API only for two remaining questions and popup/Settings layout with mock data.
- Browser-based tests are synthetic. A full authenticated Spark regression remains required for each exercise format.

## 0.5.0 — Liquid Glass & chromatic studio

- Rebuild the popup into a compact **glass command deck**: exercise first, stable 388px width, persistent consolidated action dock, independent re-scan shortcut, and distinct loading/error states.
- Rebuild Settings as a **chromatic atelier**: translucent navigation, grouped preferences, and a live glass surface preview.
- Add **nine wallpaper presets**, a keyboard-accessible **hue ring**, editable **six-digit HEX** color, Chrome-native color input, and intensity control (0–100%). Restore default supported.
- Persist `uiBackdropColor` and `uiBackdropStrength` locally; auto-apply saved appearance in popup and Settings while keeping the existing Light / Dark / System choice.
- Add four-language strings (English, Vietnamese, Simplified and Traditional Chinese) for every new color control.
- Add reduced-transparency and high-contrast fallbacks, focus styles, restrained pointer-responsive glass highlights, and mobile palette sizing.
- Align layout decisions with Hallmark's anti-pattern, responsive, typography and microinteraction references. Add `docs/GLASS_DESIGN.md` and updated screenshots.
- Keep all existing providers, offline compatibility rules, question scanning, answer application, and guarded check-and-next behavior unchanged. Fix a redundant double confirmation introduced in the previous popup script.
- Add appearance regression tests and browser interaction checks. UI previews use mocked exercise and local storage data; no authenticated Spark session tested.

## v0.4.1 — Popup width hotfix

- Fix Chrome action popup collapsing to an extremely narrow width by removing viewport-relative `max-width` and `max-height` from the popup container.
- Assign the popup document and body a stable 376px intrinsic width, retaining the 600px scroll cap.
- Add a regression test for popup sizing; existing functionality unchanged.

# Changelog

## 0.3.0 — Native-inspired UI / UX

- Redesign Chrome popup with a compact, three-step workflow and collapsible, editable answer cards.
- Redesign options/settings with a responsive sidebar, visual solution mode selector, profile manager and grouped privacy settings.
- Add dark theme, reduced motion, keyboard focus indicators, improved loading/error feedback and unsaved-change indicator.
- Preserve all v0.2.0 API providers, comparison workflow, endpoint security, offline rules and answer application logic.
- Add basic UI integrity tests alongside existing 54 logic tests.

## 0.2.0 — Multiple API providers

- Add OpenAI-compatible profile presets and custom endpoint support.
- Add model comparison and safe selection of disagreed answers.
- Retain v0.1.0 offline rule fallback.

## 0.1.0 — Initial release

- Initial Chrome MV3 extension: scan Spark worksheets in accessible frames, suggest answers and apply supported answers.

## 0.4.0 — Multilingual pocket workflow

- English default, Vietnamese, Simplified Chinese and Traditional Chinese UI via a shared locale module.
- Manual Light / Dark / System appearance selection, persisted in Chrome local storage.
- Compact 376 px popup and persistent two-row action dock; Apple-inspired Hallmark audit.
- Experimental user-confirmed **Submit & next**, with verified-fill and DOM-state guards; no unattended submission.
- Full English and Vietnamese README, updated screenshots and automation DOM evidence guide.
- Retained multi-provider AI and legacy offline rules, without installing a new offline runtime.
