<div align="center">
  <img src="icons/icon128.png" alt="Spark Study Assistant icon" width="90" height="90" />

  # Spark Study Assistant

  **Answers from the exercise first. AI only when needed.**

  A local-first Chrome extension for reviewing and filling supported exercises on National Geographic Learning Spark.

  [![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#installation)
  [![Release](https://img.shields.io/badge/version-0.6.0-8C83F4?style=flat-square)](CHANGELOG.md)
  [![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=111)](#project-structure)
  [![Tests](https://img.shields.io/badge/tests-88_passing-2A946A?style=flat-square)](#testing)

  [**Get started**](#installation) · [**How answers are found**](#answer-pipeline) · [**Project structure**](#project-structure) · [**Tiếng Việt**](README.vi.md)
</div>

---

<div align="center">
<table>
  <tr>
    <td align="center"><img src="docs/screenshots/popup-glass-light.png" alt="Spark Assistant popup — light" width="295" /></td>
    <td align="center"><img src="docs/screenshots/popup-glass-dark.png" alt="Spark Assistant popup — dark" width="295" /></td>
  </tr>
  <tr><td align="center"><sub>Light · compact question review</sub></td><td align="center"><sub>Dark · Liquid Glass surfaces</sub></td></tr>
</table>
</div>

> [!NOTE]
> UI screenshots are **illustrative** (mock exercise data). The QTI reader has been tested against a browser fixture reproducing a five-question Spark exercise, but not every Spark interaction type or authenticated assignment has been verified.

## What's new in 0.6.0

**QTI-first solving.** Some published Spark exercises include explicit answer declarations inside an XML assessment packaged in `data.js`. This version reads those declarations locally and maps them to visible controls before considering an AI request.

**Less work for Chrome.** Nested answer cards no longer create individual blurred compositor layers. The shared glass material uses a lower blur radius; reflective pointer highlights are animation-frame limited, and the popup renders question cards in a single DOM batch.

**Existing workflows stay intact.** Multiple AI profiles, model comparison, manual answer editing, guarded filling and the opt-in check-and-next action all remain available.

## Answer pipeline

```mermaid
flowchart TD
  A[Read current Spark exercise] --> B[Find published data.js in active frame]
  B --> C{Valid QTI assessment?}
  C -->|Yes| D[Read correctResponse declarations]
  D --> E{Exact ID and option match?}
  E -->|Yes| F[Verified local answer]
  E -->|No| G[Unresolved question]
  C -->|No| G
  G --> H{Configured fallback?}
  H -->|AI profile| I[Ask selected API for unresolved items only]
  H -->|Legacy rules| J[Conservative rule suggestions]
  F --> K[Review answers in popup]
  I --> K
  J --> K
  K --> L[Fill supported controls]
  L --> M[Optional confirmed Check & Next]
```

The QTI reader is **not** a general answer-key scraper. See [implementation notes](docs/QTI_READER.md). It accepts an answer only when the client-side assessment has an explicit `responseDeclaration / correctResponse` and the `responseIdentifier` plus **entire choice set** match the visible exercise. The initial release supports QTI inline/single-choice dropdowns and explicitly declared text-entry responses. Unknown formats (reordering, drag-and-drop, unusual scoring rules) remain unresolved and use the existing fallback.

No downloaded script is evaluated by the QTI parser. The extension parses the JSON-escaped XML strings in `data.js`, with origin, size and structural checks. QTI content stays in the browser. **Only questions not matched locally are sent to your chosen AI provider.**

| Case | What happens |
|---|---|
| All visible choices map to QTI | **No AI call**; results marked `Verified QTI` |
| Some choices map | QTI answers are retained; only unmatched items use the configured fallback |
| Missing or malformed QTI | Existing single-AI, multi-AI comparison or legacy rules are used |
| Controls cannot be verified on-page | The extension does not silently submit |

## Features

| | Capability |
|---|---|
| ◈ | **QTI-first reader** for unambiguous, published answer declarations |
| ↗ | **AI fallback** with independent OpenAI-compatible profiles and model comparison |
| ✓ | **Review & edit** each response before filling |
| ⌁ | **Guarded filling** for supported dropdown and text controls |
| ⇥ | **Check & next (experimental)** only after a user confirmation and DOM validation |
| ◐ | **Glass appearance**, Light / Dark / System and a nine-preset color studio with HEX & hue wheel |
| 文 | **Four languages**: English (default), Tiếng Việt, 简体中文, 繁體中文 |

## Installation

1. Download this repository or use **Code → Download ZIP** on GitHub.
2. Open **`chrome://extensions/`** in Chrome or Chromium.
3. Enable **Developer mode**, select **Load unpacked**, and choose the directory containing `manifest.json`.
4. Open an assignment on [NGL Spark](https://learn.eltngl.com/) and refresh the page once after installing/updating the extension.
5. Open Spark Study Assistant and follow **Scan → Solve → Review → Fill**. Use **Solve & fill** to run the workflow in one action, then inspect your answers on Spark.

No `npm install`, bundler or API key is needed to inspect *compatible* published QTI answers. **An API key and endpoint are required for an AI fallback** if an exercise is not fully covered by QTI or the limited legacy rules.

### Configure AI fallback

Go to **Settings → AI connections**, add profiles and choose the model(s) to use. Under **Answers**, select **Single AI**, **Compare AIs** or **Legacy rules**. The chosen mode applies **only after** QTI checking; a successful QTI answer never needs an API call.

OpenAI-compatible Chat Completions endpoints are supported (OpenAI, OpenRouter, Groq, DeepSeek, compatible Gemini endpoints, Ollama local server, custom endpoint). Native Anthropic Messages and the OpenAI Responses API are *not* directly implemented.

### Personalize the interface

<div align="center">
<table>
<tr><td><img src="docs/screenshots/color-studio-light.png" width="410" alt="Color Studio light" /></td><td><img src="docs/screenshots/color-studio-dark.png" width="410" alt="Color Studio dark" /></td></tr>
</table>
</div>

Select Light, Dark or System, pick one of nine colors, enter a custom HEX value or use the hue ring and intensity slider. Preferences stay in `chrome.storage.local`. For smoother scrolling, glass blur is concentrated in larger surfaces rather than every nested row; reduced-motion and reduced-transparency preferences are respected.

## Project structure

```text
spark-study-assistant/
│
├── manifest.json                 # Chrome MV3 permissions, scripts & version
├── popup.html                    # Popup shell and actions
├── popup.js                      # Scan → QTI → fallback → review → fill
├── options.html                  # Settings layout
├── options.js                    # AI profile, language and preference editing
├── styles.css                    # Layout, glass tokens, responsive/accessibility
├── appearance.js                 # Light/dark/wallpaper runtime
├── color-studio.js               # Swatches, hue wheel and HEX validation
├── i18n.js                       # UI copy for four languages
│
├── content.js                    # Per-iframe DOM scan, fill and check/next
├── qti.js                        # Safe data.js/XML parser & answer mapping  NEW
├── background.js                 # Orchestrates fallback API requests
├── providers.js                  # Provider profiles, schemas and comparison
├── solver.js                     # Small legacy ruleset (not a local LLM)
│
├── _locales/                     # Chrome manifest translations
│   ├── en/  ├── vi/  ├── zh_CN/  └── zh_TW/
├── icons/                        # Bundled extension icons
├── docs/
│   ├── screenshots/              # UI previews (illustrative)
│   ├── AUTOMATION_DISCOVERY.md   # Privacy-safe DOM investigation
│   ├── QTI_READER.md            # Reader design, validation and limits
│   ├── GLASS_DESIGN.md           # Visual/material decisions
│   └── ...                       # Historical design/research notes
└── tests/                        # Zero-dependency Node regression tests
    ├── qti.test.js               # XML answers, mismatches and fallback
    ├── providers.test.js
    ├── solver.test.js
    ├── background.test.js
    ├── appearance.test.js
    ├── i18n.test.js
    └── ui.test.js
```

## Testing

Run the regression suite from PowerShell (single paste):

```powershell
& {
    Set-Location "$HOME\Downloads\spark-study-assistant"
    node --test
}
```

The tests cover mapping five sample answers to QTI choice identifiers, text responses, stale choice guards, provider behavior, UI structure and appearance. A separate Chromium integration check validated QTI XML parsing with the browser's native `DOMParser`. These tests do **not** guarantee that every live Spark assignment uses the same XML format.

## Permissions & safety

- Reads exercise content in authorized Spark frames; cross-origin scripts are *not* fetched by the QTI reader.
- API requests carry only unresolved extracted question/choice data to the selected provider — not LMS cookies, tokens or assignment URL.
- API keys remain in Chrome local extension storage, which is **not a hardened secrets vault**; never add credentials to Git.
- **Check & next** requires an explicit user click and confirmation. It may not be equivalent to the final LMS score submission. See [automation evidence](docs/AUTOMATION_DISCOVERY.md).
- No background telemetry, remote UI framework, embedded LLM or large offline knowledge database.

---

<div align="center">
  <strong>Less guessing. More verifiable answers.</strong><br />
  <sub>Independent open-source companion; not affiliated with National Geographic Learning, Spark or Avallain.</sub><br /><br />
  <a href="README.vi.md">Đọc bản tiếng Việt</a> · <a href="CHANGELOG.md">Changelog</a> · <a href="docs/AUTOMATION_DISCOVERY.md">Known limitations</a>
</div>
