# Review QTI in v0.7.3

## Evidence and limitations

The additional Inspector collection contained eight captures of three exercise groups:

- **Review Real life / 1d:** several screens with one visible `os-sequence` widget and `orderInteraction` assessments (each reuses `RESPONSE0`). QTI uses `cardinality="ordered"` and an ordered list of `simpleChoice` identifiers. The DOM uses draggable `li.os-sequence-element` tiles; no verified programmatic drag/drop API was recorded.
- **Review (10 screens):** a five-question radio group per active screen, with numerous XML assessments and IDs such as `C0_0` reused on other screens. A valid match requires visible option labels to agree with the selected assessment, as well as a matching set of stable radio IDs. Existing click-and-verify radio filling remains enabled.
- **Review Writing skill:** QTI includes inline choices, but the **entire Writing category remains out of scope by request**.

This collection is **not** included in the repository. Tests use fabricated questions and synthetic QTI with the same structural characteristics.

## Safety policy

1. No response-ID-only mapping across assessments.
2. For order sequences, validate both the declared `correctResponse` permutation and every visible tile label, including fixed punctuation. An identical match against more than one assessment is ambiguous and rejected.
3. Order solutions are displayed in the popup **without applying**, regardless of the completeness of QTI data. As a result, Submit & next cannot be unlocked by an order preview.
4. A missing or inconsistent QTI match does not mutate the page; unresolved items use existing API fallback when configured.
5. Speaking and Writing, including Writing skill, remain deferred.
6. Nothing in this parser is proof of gradebook submission or server-side score persistence.

## Tests

- `node --test tests/*.test.js` — includes QTI ordering, punctuation, mismatched tokens, screen ambiguity, wrong candidate XML, and stable-ID radio matching.
- Isolated Chromium integration exercised active/hidden two-screen sequence scanning, QTI text preview with zero DOM mutation, and five shuffled radio selections. These synthetic tests **do not** confirm success against logged-in Spark.
