/* Pure offline solver: only return answers supported by explicit, narrow rules.
 * No DOM access or network use. Shared with background and tests. */
(function (root) {
  'use strict';
  const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  const flat = (s) => norm(s).replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
  const knownPhrases = [
    [/get home\s*\[\[\d+\]\].*thursdays/i, 'late'],
    [/\bhe\s*\[\[\d+\]\]\s*up early/i, 'wakes'],
    [/want to\s*\[\[\d+\]\]\s*a break/i, 'take'],
    [/doesn't often\s*\[\[\d+\]\]\s*tired/i, 'feel'],
    [/sometimes\s*\[\[\d+\]\]\s*up until midnight/i, 'stay'],
    [/\bi\s*\[\[\d+\]\]\s*up about\s*5/i, 'get'],
    [/do you\s*\[\[\d+\]\]\s*long hours/i, 'work'],
    [/often\s*\[\[\d+\]\]\s*exercise/i, 'do'],
    [/sometimes\s*\[\[\d+\]\]\s*asleep/i, 'fall'],
    [/to\s*\[\[\d+\]\]\s*tv/i, 'watch']
  ];
  const fixedCorrections = [
    [/in my free time.*do sport.*cooks a meal/i, 'cook'],
    [/nura works long hours.*don't often/i, "doesn't"],
    [/alessio watch tv/i, 'watches'],
    [/does you spend time/i, 'Do'],
    [/my brothers doesn't play/i, "don't"]
  ];
  const knownSequences = [
    ['this take I medicine twice a day', 'I take this medicine twice a day.'],
    ["don't often they go on holiday", "They don't often go on holiday."],
    ['rarely eats out during the week she', 'She rarely eats out during the week.'],
    ['at lunchtime check you always your emails do', 'Do you always check your emails at lunchtime?'],
    ['are for class never you on time', 'You are never on time for class.']
  ];
  const phonemes = {'travels':'/z/', 'helps':'/s/', 'realises':'/ɪz/', 'realizes':'/ɪz/', 'once':'/s/', 'hers':'/z/'};
  function inOptions(answer, options) {
    if (!Array.isArray(options) || !options.length) return answer;
    return options.find((s) => norm(s) === norm(answer)) || null;
  }
  function solveOne(q) {
    const context = String(q.localContext || q.context || '');
    const options = q.options || [];
    const hint = norm(q.hint);
    if (options.some(x => /^\/(?:s|z|ɪz)\/$/.test(x.trim()))) {
      const found = context.match(/transcript\s+([a-z]+)/i);
      const word = norm(q.word || (found && found[1]) || '');
      const answer = inOptions(phonemes[word], options);
      if (answer) return { answer, confidence: 'high', explanation: 'Quy tắc phát âm âm cuối.', source: 'offline' };
    }
    for (const [pattern, answer] of knownPhrases) {
      if (pattern.test(context)) {
        const allowed = inOptions(answer, options);
        if (allowed) return { answer: allowed, confidence: 'high', explanation: 'Cụm từ thông dụng trong ngữ cảnh.', source: 'offline' };
      }
    }
    if (q.kind === 'order') {
      const ordered = knownSequences.find(([input]) => flat(context).includes(flat(input)));
      if (ordered) return {answer: ordered[1], confidence: 'high', explanation:'Mẫu trật tự từ đã xác nhận.', source:'offline'};
    }
    if (q.kind === 'correction') {
      const correction = fixedCorrections.find(([pattern]) => pattern.test(context));
      if (correction) return {answer: correction[1], confidence: 'high', explanation:'Hòa hợp chủ ngữ và động từ.', source:'offline'};
    }
    if (q.kind === 'text' && hint) {
      const before = norm(q.before || '');
      const after = norm(q.after || '');
      // Conservative present-simple rules tied to the specific supplied verb.
      if (hint === 'sleep' && /(?:\bwe\s*)$/.test(before)) return {answer:'sleep', confidence:'high',explanation:'We + động từ nguyên mẫu.',source:'offline'};
      if (hint === 'be' && /(?:our brain|\bhe|\bshe|\bit)\s*$/.test(before)) return {answer:'is',confidence:'high',explanation:'Chủ ngữ số ít + is.',source:'offline'};
      if (hint === 'not sleep' && /\bhe\s*$/.test(before)) return {answer:"doesn't sleep", confidence:'high',explanation:"He + doesn't + V.",source:'offline'};
      if (hint === 'feel' && /\bhe\s*$/.test(before)) return {answer:'feels',confidence:'high',explanation:'He + động từ thêm -s.',source:'offline'};
      if (hint === 'drink' && /(?:robbie shone.*listens to music|listens to music)\s*,?\s*$/.test(before)) return {answer:'drinks',confidence:'high',explanation:'Chủ ngữ số ít, cấu trúc song song.',source:'offline'};
      void after;
    }
    return {answer:'',confidence:'low', explanation:'Chưa có quy tắc offline đủ chắc chắn; cần AI hoặc nhập thủ công.',source:'offline'};
  }
  function solve(payload) {
    return {answers: (payload.questions || []).map(q => ({id:q.id, ...solveOne(q)})), mode:'offline'};
  }
  root.SparkSolver = {solve, norm, flat};
})(typeof self !== 'undefined' ? self : globalThis);
