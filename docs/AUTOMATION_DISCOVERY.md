# DOM evidence for safer Spark automation

The **Submit & next** beta uses selectors observed in the supplied Spark activity HTML:

- `[data-event="check"]` — **Check Answers**.
- `[data-event="forward_lo"]` — **Next learning object** (initially disabled in the supplied sample).
- `[data-event="sendscores"]` — **Results** (not currently clicked by the extension).

These are *DOM observations*, not a guarantee that invoking Check Answers sends the final LMS score. We deliberately do not click guessed `submit`, `forward` or general arrow controls.

## Help collect post-check evidence (no credentials)

Open an actual exercise in Chrome. Before and after manually selecting **Check Answers** and **Results**, run this command in DevTools Console **in the innermost exercise frame context**:

```javascript
(() => {
  const nodes = [...document.querySelectorAll('[data-event]')]
    .filter(el => /^(check|sendscores|forward_lo|forward)$/.test(el.dataset.event || ''));
  const output = nodes.map(el => ({
    event: el.dataset.event,
    text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    disabled: Boolean(el.disabled),
    ariaDisabled: el.getAttribute('aria-disabled'),
    classes: [...el.classList].filter(x => /^[a-z][a-z0-9_-]{0,70}$/i.test(x)),
    visible: !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'
  }));
  copy(JSON.stringify(output, null, 2));
  console.table(output);
})();
```

Send **only the copied JSON** plus a short note identifying the stage (before check / after check / after results), and whether the LMS grade was actually recorded. Do **not** copy `document.documentElement.outerHTML`, iframe URLs, headers, cookies, storage, profile fields or authentication tokens: those may contain private session data.

If the extension cannot confirm the state change, it stops safely. Full end-to-end auto-advance can be improved when live post-check and post-results state is documented and validated.
