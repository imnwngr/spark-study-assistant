# Submit & next — finding the correct Spark flow

**Purpose:** Find which Spark control checks answers, transitions between **screens of the same learning object**, reports results, and proceeds to **the next learning object**. These events are not interchangeable.

The experimental extension submit button remains guarded in 0.7.1; no new target has been guessed.

## Run read-only diagnostics

1. Open the Spark assignment **in its Dashboard tab** (not a standalone content URL).
2. Chrome: **F12 → Sources → Snippets → New snippet**. Paste `tools/inspect-submit-next.js`; save and run (`Ctrl+Enter`). Or paste the file into the Dashboard Console.
3. In the small panel, click **Capture now**. Then return to Spark and **manually** click the actual **Check Answers** control (only if you are ready to check your answers). If the exercise has multiple screens, try the ordinary **Next screen** control at the appropriate moment. The inspector will take before/after snapshots of those clicks.
4. Click **Download JSON** or **Copy JSON**. Send that output to the developer.
5. To compare pre/post scenarios, include a manual capture before and after opening Spark's **Results** view or proceeding to another learning object.

The inspector **does not click any controls, submit answers, read entered answers, capture cookies or network requests**, or upload data. It only captures targeted button availability, active screen IDs, QTI feedback-state counts and click transitions. Close/Stop it when finished. Review the JSON before sharing: exercise titles are included.

## Why a button might stay disabled in v0.7.1

The popup enables Submit & next only after **Solve & fill** verifies every recognized answer in the current visible screen. If even one answer requires manual interaction, the control remains disabled. The Spark `forward` control changes screens inside an exercise; `forward_lo` is a potential next-learning-object control. The `sendscores` control might present results instead of acting like Check Answers. Do not assume they have the same semantics without a before/after trace.

The final fix will be based on observed DOM state transitions, not a blind click selector.
