# Submit & Next — diagnostic findings and v0.7.2 behavior

## Observed on the real 1b | Grammar | 3 page

The supplied read-only diagnostic captured two manual clicks:

1. `Submit to Gradebook` (`data-event="submit"`) was visible, enabled and actionable. `Check Answers` (`data-event="check"`) was hidden and inactive. After around 1.2 seconds, Submit to Gradebook had an inactive class and `disabled=true`.
2. `Next` (`data-event="forward_lo"`) was still visible and enabled. A manual click made the old exercise iframe disappear by the final snapshot.

This establishes the **UI state flow**, not server-side gradebook persistence. No network status, gradebook confirmation, or individual answer values were captured.

## v0.7.2 behavior

- Requires a confirmed user click in the extension, verified filling for **all recognized items**, and an unchanged exercise/screen.
- Uses exactly one actionable `submit` control, otherwise exactly one actionable `check` control. It never clicks a hidden duplicate or a generic form submit.
- For `submit`, waits until the same connected button transitions into an inactive/disabled state. For `check`, waits for the historical check-state transition. A timeout or ambiguous transition stops automatic Next.
- If enabled in Settings, requests `forward_lo` only after the UI-state transition and only if exactly one such button is actionable. If a stage is ambiguous, stop and ask the user to inspect Spark; do **not** silently retry.
- `forward` is screen navigation *within* a learning object, not the same as `forward_lo`.
- Submit & Next is not a guarantee that an assignment has been stored in the gradebook. Verify completion in Spark.

## Collect additional evidence

Run `tools/inspect-submit-next.js` as a Chrome DevTools Snippet on the Spark Dashboard. Use the recorder when manually submitting a *different exercise type*; never click Submit just to create a diagnostic if the work is not ready. Review JSON before sharing.
