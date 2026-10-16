/* Spark Inspector: opt-in, read-only DOM snapshots; no page state changes. */
(() => {
  'use strict';
  if (globalThis.__sparkInspectorListenerInstalled) return;
  globalThis.__sparkInspectorListenerInstalled = true;
  const clean = (value, max = 260) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const attr = (el, name) => el.getAttribute(name);
  const safeUrl = () => { try { return location.origin + location.pathname; } catch { return null; } };
  const describe = el => ({
    tag: el.tagName.toLowerCase(), id: clean(el.id, 120) || null,
    classes: clean(typeof el.className === 'string' ? el.className : '', 230),
    text: clean(el.textContent), name: attr(el, 'name'), type: attr(el, 'type'),
    role: attr(el, 'role'), modelId: attr(el, 'data-model-id'), dataEvent: attr(el, 'data-event'),
    checked: 'checked' in el ? !!el.checked : null,
    selected: 'selected' in el ? !!el.selected : null,
    disabled: 'disabled' in el ? !!el.disabled : null,
    value: ('value' in el && el.type !== 'password' && el.type !== 'hidden') ? clean(el.value, 140) : null,
    // HTML may include user text; no outerHTML for scripts, forms or URL/query-bearing elements.
    html: /^(script|iframe|form|input|textarea)$/i.test(el.tagName) ? null : clean(el.outerHTML, 1400)
  });
  const selectors = ['.interaction', '[class*="interaction"]', '.os-sequence', '.os-match', '.os-choice', '.os-gap', '.os-text', '.is-dropdown', '.ic-text-correction', 'input', 'textarea', 'select', '[contenteditable="true"]', '[role="radio"]', '[role="checkbox"]', '[draggable="true"]'];
  function capture() {
    const counts = Object.fromEntries(selectors.map(selector => [selector, document.querySelectorAll(selector).length]));
    const interactions = [...document.querySelectorAll('.interaction')].slice(0, 45).map((el, index) => ({
      index, ...describe(el),
      children: [...el.querySelectorAll('input, textarea, select, button, [role="radio"], [role="checkbox"], [data-model-id]')]
        .slice(0, 32).map(describe)
    }));
    const controls = [...document.querySelectorAll('button, [data-event], [role="button"], .pagination, [class*="progress"], [class*="screen"]')]
      .filter(el => !el.closest('.interaction')).slice(0, 55).map(describe);
    const qtiNodes = [...document.querySelectorAll('script[src*="data.js"], script[type*="xml"], script[type*="qti"]')]
      .slice(0, 20).map(el => ({type: attr(el, 'type'), srcPath: (() => {try {const u = new URL(el.src); return u.origin+u.pathname;} catch {return null;}})(), text: clean(el.textContent, 900)}));
    return {
      title: clean(document.title), url: safeUrl(), counts, interactions, controls, qtiNodes,
      summary: {
        types: [...new Set(interactions.map(item => item.classes.split(' ').find(token => /^(is-|ic-|os-|pp-)/.test(token))).filter(Boolean))],
        interactionCount: counts['.interaction']
      }
    };
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'SPARK_INSPECT_CAPTURE') return false;
    try { respond({ok:true, result:capture()}); }
    catch (error) {respond({ok:false,error:String(error?.message || error)});}
    return false;
  });
})();
