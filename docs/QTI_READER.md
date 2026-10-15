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

## Wordbuilding / shared word bank (v0.6.1)

The **1b | Wordbuilding | 1** screenshot shows a *shared bank of words or phrases* and six free-text blanks. The previous scanner could mistakenly count an unnumbered static bank as an extra question, breaking the strict QTI interaction-count check, or omit the bank from the fallback AI prompt.

The scanner now treats a static word-bank block as **context**, not a question, only when the rubric explicitly references words/phrases "from the box" and there are actual editable question blocks. It also recognizes common named word-bank containers. The bank is attached to each text question, shown in the popup, copied with the answer report, and included in the fallback AI prompt. It is never automatically treated as a list of multiple-choice answers.

`qti.js` will accept a free-text Wordbuilding answer **only when** the published QTI has a corresponding `textEntryInteraction` or `extendedTextInteraction` with an explicit single string `correctResponse` and its interaction count matches the live questions. For the *play / do / go* rubric, incomplete one-word values are rejected when the word bank is present. A QTI `gapMatchInteraction`, another custom interaction, mismatched screen count, or unrecognized DOM editing control will **not** be guessed or silently filled.

A synthetic six-question Chromium fixture passed scan → QTI decode → fill, but the real user's HTML / QTI for this Wordbuilding activity has **not been supplied**. To establish actual compatibility, paste [`tools/inspect-wordbuilding.js`](../tools/inspect-wordbuilding.js) into DevTools Console on the Spark Dashboard while this exercise is open. The resulting `SPARK_WORDBUILDING_DIAGNOSTIC` JSON reports input classes, interaction types, response IDs and declared answer strings without dumping HTML, cookies, URL queries or tokens. Review before sharing. It does not press Check Answers or submit.
