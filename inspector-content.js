/* Spark Exercise Inspector: opt-in, read-only DOM captures and correction interaction trace. */
(() => {
  'use strict';
  if (globalThis.__sparkInspectorListenerInstalled) return;
  globalThis.__sparkInspectorListenerInstalled = true;

  const instanceId = String(Date.now()) + ':' + Math.random().toString(36).slice(2);
  const clean = (value, max = 260) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const attr = (el, name) => el?.getAttribute?.(name) ?? null;
  const safeUrl = () => { try { return location.origin + location.pathname; } catch { return null; } };
  const classes = el => typeof el?.className === 'string' ? el.className : '';
  const sensitive = el => ['password', 'hidden', 'file'].includes(String(el?.type || '').toLowerCase());
  const describe = el => ({
    tag: el.tagName.toLowerCase(), id: clean(el.id, 120) || null,
    classes: clean(classes(el), 230), text: clean(el.textContent),
    name: attr(el, 'name'), type: attr(el, 'type'), role: attr(el, 'role'),
    modelId: attr(el, 'data-model-id'), dataEvent: attr(el, 'data-event'),
    checked: 'checked' in el ? !!el.checked : null,
    selected: 'selected' in el ? !!el.selected : null,
    disabled: 'disabled' in el ? !!el.disabled : null,
    value: ('value' in el && !sensitive(el)) ? clean(el.value, 140) : null,
    // Avoid credentials and URL-bearing markup. Captures may still include exercise text.
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

  const MAX_EVENTS = 180;
  const MAX_BYTES = 420000;
  const TRACE_MS = 180000;
  const watchEvents = ['pointerdown', 'pointerup', 'click', 'focusin', 'focusout', 'beforeinput', 'input', 'change', 'keydown', 'keyup', 'submit'];
  const trace = {active: false, records: [], byteCount: 0, truncated: false, startedAt: null, endedAt: null, armedUntil: 0, lastMutation: 0, lastState: '', observer: null, timer: null};

  const relevantEditor = el => {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (el.closest('.ic-text-correction')) return true;
      return !!el.closest('[class*="icTextCorrection"], [class*="ki24"], [role="dialog"], [role="listbox"], [role="option"], .ui-dialog, .popover, .popper, .popup, .tooltip, [class*="replacement"], [class*="correction-menu"]');
    } catch {return false;}
  };
  const shortNode = el => {
    if (!el || el.nodeType !== 1) return {nodeType: el?.nodeType ?? null, text: clean(el?.textContent, 100)};
    return {
      tag: el.tagName.toLowerCase(), id: clean(el.id, 90) || null,
      classes: clean(classes(el), 160), role: attr(el, 'role'), modelId: attr(el, 'data-model-id'),
      text: sensitive(el) ? null : clean(el.textContent, 130),
      value: 'value' in el && !sensitive(el) ? clean(el.value, 140) : null,
      type: attr(el, 'type'), ariaExpanded: attr(el, 'aria-expanded'), ariaSelected: attr(el, 'aria-selected')
    };
  };
  const isVisible = el => {
    try {return !!(el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';}
    catch {return false;}
  };
  const editorSelector = [
    'input:not([type="password"]):not([type="hidden"]):not([type="file"])', 'textarea',
    'select', '[contenteditable="true"]', '[role="dialog"]', '[role="listbox"]',
    '[role="option"]', '[class*="icTextCorrection"]', '[class*="ki24_"]',
    '[class*="ki24-"]', '.ui-dialog', '.popover', '.popper', '.popup', '.tooltip',
    '[class*="replacement"]', '[class*="correction-menu"]', '[role="menu"]', '[role="menuitem"]'
  ].join(', ');
  function correctionState() {
    const widgets = [...document.querySelectorAll('.ic-text-correction')].slice(0, 6).map((root, index) => ({
      index, classes: clean(classes(root), 160),
      tokens: [...root.querySelectorAll('span.input-text')].slice(0, 90).map((el, i) => ({
        i, modelId: attr(el, 'data-model-id'), text: clean(el.textContent, 90), classes: clean(classes(el), 140)
      }))
    }));
    const editorNodes = [...document.querySelectorAll(editorSelector)]
      .filter(el => isVisible(el) && (relevantEditor(el) ||
        (Date.now() < trace.armedUntil && ( /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ||
          !!el.closest?.('.popover, .popper, .popup, [role="menu"], [role="menuitem"], [class*="replacement"]') ))))
      .slice(0, 28).map(shortNode);
    return {widgets, editorNodes};
  }
  function record(type, data = {}, withState = false) {
    if (!trace.active || trace.records.length >= MAX_EVENTS || trace.byteCount > MAX_BYTES) {
      if (trace.active) trace.truncated = true;
      return;
    }
    const entry = {ms: Date.now() - trace.startedAt, type, ...data};
    if (withState) {
      const state = correctionState();
      const fingerprint = JSON.stringify(state);
      // Keep changed snapshots plus the first sample, but avoid repeated huge states.
      if (trace.lastState !== fingerprint || type === 'initial' || type === 'final') {
        entry.state = state;
        trace.lastState = fingerprint;
      }
    }
    const bytes = JSON.stringify(entry).length;
    if (trace.byteCount + bytes > MAX_BYTES) {trace.truncated = true; return;}
    trace.records.push(entry);
    trace.byteCount += bytes;
  }
  function onEvent(event) {
    if (!trace.active) return;
    const el = event.target;
    const inside = relevantEditor(el);
    const editorInput = Date.now() < trace.armedUntil &&
      el?.nodeType === 1 && ( /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName) || !!el.closest?.('[role="option"], [role="listbox"], [role="menuitem"], .popover, .popper, .popup, .tooltip, .ui-dialog, [class*="replacement"]') );
    if (!inside && !editorInput) return;
    if (inside) trace.armedUntil = Date.now() + 20000;
    const data = {target: shortNode(el)};
    if (/^key/.test(event.type)) {
      // Do not record literal character keystrokes; input values are captured in the scoped editor state.
      data.key = ['Enter', 'Escape', 'Tab', 'Backspace', 'Delete'].includes(event.key) ? event.key : 'other';
    }
    if (event.type === 'beforeinput' || event.type === 'input') data.inputType = clean(event.inputType, 50);
    record(event.type, data, ['click', 'input', 'change', 'focusin', 'focusout', 'pointerup'].includes(event.type));
    if (['click', 'pointerup', 'input', 'change'].includes(event.type)) {
      setTimeout(() => record('settled', {after: event.type}, true), 80);
      setTimeout(() => record('settled', {after: event.type}, true), 350);
    }
  }
  function onMutations(mutations) {
    if (!trace.active) return;
    const overlaySelector = 'input, textarea, [contenteditable="true"], [role="option"], [role="menuitem"], .popup, .popper, .popover, [class*="replacement"], [class*="correction"]';
    const associated = mutations.filter(m => relevantEditor(m.target) ||
      (Date.now() < trace.armedUntil && [...m.addedNodes, ...m.removedNodes].some(n =>
        relevantEditor(n) || (n?.nodeType === 1 &&
          (n.matches?.(overlaySelector) || n.querySelector?.(overlaySelector))))));
    if (!associated.length) return;
    trace.armedUntil = Date.now() + 20000;
    const samples = associated.slice(0, 6).map(m => ({
      kind: m.type, attribute: m.attributeName || null, target: shortNode(m.target),
      added: [...m.addedNodes].slice(0, 3).map(shortNode),
      removed: [...m.removedNodes].slice(0, 3).map(shortNode)
    }));
    const now = Date.now();
    if (now - trace.lastMutation > 75) {
      trace.lastMutation = now;
      record('dom-mutation', {changes: samples, total: associated.length}, true);
    } else {
      record('dom-mutation', {changes: samples.slice(0, 2), total: associated.length});
    }
  }
  function startTrace() {
    if (trace.active) return {ok: true, active: true, alreadyActive: true};
    trace.active = true; trace.records = []; trace.byteCount = 0;
    trace.truncated = false; trace.startedAt = Date.now(); trace.endedAt = null;
    trace.armedUntil = 0; trace.lastMutation = 0; trace.lastState = '';
    for (const type of watchEvents) document.addEventListener(type, onEvent, true);
    trace.observer = new MutationObserver(onMutations);
    trace.observer.observe(document.documentElement, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','value','aria-expanded','aria-selected','aria-hidden','style']});
    record('initial', {title: clean(document.title), url: safeUrl()}, true);
    trace.timer = setTimeout(stopTrace, TRACE_MS);
    return {ok: true, active: true};
  }
  function stopTrace() {
    if (!trace.active) return {ok:true, active:false};
    record('final', {}, true);
    trace.active = false; trace.endedAt = Date.now();
    for (const type of watchEvents) document.removeEventListener(type, onEvent, true);
    trace.observer?.disconnect();trace.observer = null;
    if (trace.timer) clearTimeout(trace.timer);
    trace.timer = null;
    return {ok: true, active: false};
  }
  function getTrace() {
    return {title: clean(document.title), url: safeUrl(), active: trace.active,
      startedAt: trace.startedAt ? new Date(trace.startedAt).toISOString() : null,
      endedAt: trace.endedAt ? new Date(trace.endedAt).toISOString() : null,
      truncated: trace.truncated, eventCount: trace.records.length, events: trace.records.slice()};
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!message?.type?.startsWith('SPARK_INSPECT_')) return false;
    try {
      switch (message.type) {
        case 'SPARK_INSPECT_PROBE': respond({ok:true,result:{instanceId,title:clean(document.title),url:safeUrl(),readyState:document.readyState,correctionWidgets:document.querySelectorAll('.interaction.ic-text-correction').length,interactionCount:document.querySelectorAll('.interaction').length}}); break;
        case 'SPARK_INSPECT_CAPTURE': respond({ok:true, result:capture()}); break;
        case 'SPARK_INSPECT_TRACE_START': respond(startTrace()); break;
        case 'SPARK_INSPECT_TRACE_STOP': respond(stopTrace()); break;
        case 'SPARK_INSPECT_TRACE_GET': respond({ok:true, result:getTrace()}); break;
        case 'SPARK_INSPECT_TRACE_CLEAR': stopTrace();trace.records=[];trace.startedAt=null;trace.endedAt=null;trace.byteCount=0;trace.truncated=false;respond({ok:true});break;
        default: return false;
      }
    } catch (error) {respond({ok:false,error:String(error?.message || error)});}
    return false;
  });
})();
