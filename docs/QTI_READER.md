# QTI answer reader — implementation notes

The extension first searches the active Spark exercise frame for a same-origin `data.js` script. Some published activities package XML files in JavaScript string literals keyed by names such as `cat2643621.xml` and `LearningObjectInfo.xml`.

## Observed evidence

A user-provided report for **1a | Grammar 2 | 2** identified an `assessmentItem` with five `responseDeclaration` elements, five `correctResponse` elements and five `inlineChoiceInteraction` controls. Each QTI answer identifier resolved to exactly one of the two published options. The five mapped answers were `rarely have`, `always`, `usually forget`, `often unable`, `every evening`.

This is evidence for **that activity**, not evidence that all Spark exercises publish answer declarations or use the same interaction type.

## Implementation

1. `content.js` processes `SPARK_SCAN` as before; answer extraction is not performed on every scan.
2. `popup.js` sends `SPARK_QTI` after the user presses Solve, with the IDs from the latest scan.
3. `content.js` checks that those IDs still match the scan, finds its own script `data.js`, enforces a same-origin `/cdn_proxy/` path, sets a four-second timeout and caps downloaded data at 2 MB. The source is cached **in memory only** for the current frame.
4. `qti.js` locates JSON-encoded XML strings **without evaluating JavaScript**, parses XML through `DOMParser`, and selects the `assessmentItem` document.
5. A response can be used only if `responseIdentifier` resolves to exactly one `correctResponse` and every displayed dropdown choice matches the QTI choice set. Duplicate/ambiguous labels, mismatched counts and unsupported interactions are rejected.
6. `popup.js` retains QTI matches and calls the selected fallback mode with **only the unresolved questions**.
7. User editing, application verification and explicit Check & Next continue to use the existing guarded workflow.

## Supported / unsupported

| XML interaction | Current behavior |
|---|---|
| `inlineChoiceInteraction` | Map single-choice answer by identifier and exact choice text |
| `choiceInteraction` | Supports mapping only when the rendered control is a compatible single dropdown |
| `textEntryInteraction` / `extendedTextInteraction` | Read a single explicit declared text answer (if rendered as a text input) |
| `orderInteraction`, `gapMatchInteraction`, `matchInteraction` | No automatic QTI mapping; use fallback |
| XML with missing/duplicate IDs, multiple accepted choices, shuffled UI options without text agreement | Reject or fall back |

The XML `correctResponse` field represents the **published assessment declaration**. The extension does not claim to reproduce every scoring rule, text normalization policy, or final server grading operation.

## Safeguards

- No `eval`, dynamic script execution, token inspection or external analytics.
- No remote QTI read: content scripts read only their **own frame origin**.
- No logging of data.js source, response URL queries or private assignment tokens.
- No QTI-based auto-submission. Submitting remains an explicit confirmed action.
- If a live Spark exercise differs from the tested XML sample, collect sanitized structure reports from `docs/AUTOMATION_DISCOVERY.md` rather than guessing identifiers or removing validation.

## Regression coverage

Run `node --test`. `tests/qti.test.js` checks correct ID mapping, text entry, duplicate/missing values, stale options, source limits and fallback routing. Native Chromium `DOMParser` parsing was also checked against a synthetic namespace-aware five-item QTI assessment. This does **not** replace live-site integration testing.
