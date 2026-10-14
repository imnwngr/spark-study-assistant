# Changelog

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
