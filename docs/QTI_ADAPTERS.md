# QTI adapters — v0.7.0

Spark publishes different interactive question types inside JSON-escaped QTI XML in `data.js`. This release adds a small **adapter layer** that preserves the original API fallback and refuses unsafe mappings.

## Observed evidence

The implementation was informed by a **13-capture read-only inspector collection**, provided during development. The collection was used locally as research material **and is not committed to the repository**, since it contains exercise text and published assessment declarations.

| Spark task | QTI interaction | Adapter status |
| --- | --- | --- |
| Vocabulary / Visual literacy | `inlineChoiceInteraction` | Verified identifier → dropdown text, fill supported |
| Listening / Pronunciation / Critical thinking | `choiceInteraction` + single cardinality | Shuffled C-group IDs → radio selection, fill supported in simulated UI |
| Listening, choose all | `choiceInteraction` + multiple cardinality | Entire ID set → checkboxes, fill supported in simulated UI |
| Grammar / Wordbuilding / Review | `textEntryInteraction` | Exact declared text, including accepted variants / suffix-only answers |
| Multi-screen activities | Several `assessmentItem` XML documents | Match the **current visible screen** and abstain when equally plausible |
| Real life (drag words into gaps) | `gapMatchInteraction` + `directedPair` | ID-pair answers displayed **for review only**; no automated dragging |
| Writing skill (associate) | `associateInteraction` + `pair` | **Deferred** with other Writing exercises by request |
| Speaking and open-ended Writing | No unique QTI answer | **Deferred**, existing workflow unchanged |

A *declaration* is not a guarantee of the grader's complete acceptance rules or of successful interaction with every live Spark build. No API request is needed when QTI fully covers a compatible screen.

## DOM ↔ QTI matching

1. Select `.content-wrap` for the currently visible screen, excluding `activity--hidden` screens. Count only its answerable controls.
2. Match dropdown choices by a unique normalized label set and matching QTI identifiers.
3. Match radio/checkbox controls by the stable `C{group}_{choice}` index encoded in Spark's `input-radio-s{screen}-c{group}-{choice}` / checkbox IDs. **Never trust their visual order**, which Spark may shuffle.
4. For text input, preserve **only what belongs in the blank**. The partial word answer `tay` remains `tay`, not `stay`.
5. A text response may carry multiple accepted variants as `<value>` siblings or pipe-delimited text (for example `play the piano|the piano`). Select the first complete compatible variant; retain the set as reference.
6. If multiple assessment XML files have the same response IDs, compare the answerable question context with each XML interaction's enclosing `<p>`. If the match is tied or too weak, **abstain** rather than choosing the first.
7. For matching pairs, resolve QTI source/target identifiers to readable labels for **manual review**. No drag-drop or pair-link clicking is enabled without live UI evidence.

The parser never evaluates downloaded script text and does not save published XML to browser storage. An unmatched/ambiguous question follows the existing AI API or legacy-rule fallback.

## Explicitly deferred

Speaking, Writing and Writing skill are excluded from the new QTI adapter. This is intentional even if a Writing exercise declares closed-choice QTI correct responses. Speaking and open-ended writing generally have no unique declared answer, but exercise category alone is not proof either way.

## QA

- Run `node --test tests/*.test.js` for the portable Node suite.
- Tests include fake DOM QTI objects for radio, checkbox, multi-screen collisions, text alternatives, suffix blanks, and gap-match preview.
- A Chromium smoke fixture at `tests/browser-adapters.html` was exercised in an isolated in-memory page. It confirmed selection of one radio and two checkboxes and verified state through `aria-checked`. This is **not an authenticated Spark regression test**.
- Browser page fixture is inert without the standalone mock Chrome runtime; it must **never** be injected into a real assignment.

## Known limitations

- Text and selection controls are supported only when the live DOM matches the inspected structural pattern.
- Gap Match and Associate do not auto-drag / auto-pair. In Writing, the adapter is not activated at all.
- A problem with indistinguishable active-screen XML candidates is unresolved deliberately.
- Any visible DOM changes after a scan require scanning again before QTI can be trusted.
- The existing Check & Next command remains opt-in and uses its earlier verification steps.
