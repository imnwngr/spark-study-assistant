# Wordbuilding / collocation gaps

Example: **1b | Wordbuilding | 1** (six missing collocations).

- Instruction: Complete sentences using **play**, **do**, or **go**, and one word or phrase from the shared box.
- Example words: football · hiking · horse riding · nothing · the piano · yoga.
- This is a **text entry** exercise in the screenshot, not a dropdown menu. A full response contains the verb **and** the complementary phrase.

| Gap | Context (abbreviated) | Contextual answer (not QTI-verified) |
|---|---|---|
| 1 | I ___ when I have time. I love making music. | play the piano |
| 2 | I often ___ in the countryside. | go hiking |
| 3 | I ___ at home ... It's great exercise. | do yoga |
| 4 | I ___ with my friends in the park. | play football |
| 5 | I just relax and ___ at all. | do nothing |
| 6 | I love horses and I ___ every weekend. | go horse riding |

## v0.6.1 behavior

The parser still treats published QTI as the primary source; the six answers above are **illustrative/contextual**, not stored as a hardcoded site-specific key. The shared bank is carried into the AI fallback for unresolved questions. The extension does not attempt drag/drop or clickable non-input blanks unless the real DOM reveals a safe, confirmed interaction.

To confirm the live QTI interaction format and control elements, run `tools/inspect-wordbuilding.js` from DevTools Console at the open Spark Dashboard. See [QTI reader notes](QTI_READER.md).
