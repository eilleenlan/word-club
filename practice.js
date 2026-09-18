/* Pure range selection shared by the interface and its checks. */
(() => {
  const labels = ['', '一', '二', '三', '四', '五', '六'];
  const gradeOf = unit => unit.grade ?? 1;
  const unitKey = unit => `g${gradeOf(unit)}:${unit.id}`;
  const singleId = unit => gradeOf(unit) === 1 ? unit.id : unitKey(unit);
  const gradeName = grade => `${labels[grade]}年級`;
  function checkAnswer(value, expected) {
    const answer = value.trim().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
    const target = expected.trim().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
    if (!answer) return 'empty';
    if (answer.toLowerCase() !== target.toLowerCase()) return 'spelling';
    // Capital letters in textbook entries mark required capitalization (names or I).
    if (/[A-Z]/.test(target) && answer !== target) return 'case';
    return 'correct';
  }
  function eligible(all, grade, cross) {
    return all.filter(unit => gradeOf(unit) >= 1 && (cross ? gradeOf(unit) <= grade : gradeOf(unit) === grade)).sort((a, b) => gradeOf(a) - gradeOf(b) || a.number.localeCompare(b.number, undefined, { numeric: true }));
  }
  function build(all, grade, cross, selected) {
    const chosen = eligible(all, grade, cross).filter(unit => selected.has(unitKey(unit)));
    if (!chosen.length) return null;
    const seen = new Set();
    const words = chosen.flatMap(unit => unit.words).filter(word => {
      const id = JSON.stringify([word[0].trim().replace(/\s+/g, ' ').toLowerCase(), word[1]]);
      if (seen.has(id)) return false;
      seen.add(id); return true;
    });
    if (!words.length) return null;
    return {
      id: cross ? `cross:g${grade}:${chosen.map(unitKey).join('+')}` : `mixed:g${grade}:${chosen.map(unit => unit.id).join('+')}`,
      mixed: true, cross, title: cross ? '跨年級練習' : '綜合練習', count: chosen.length,
      range: chosen.map(unit => `${cross ? gradeName(gradeOf(unit)) + ' ' : ''}Unit ${unit.number}`).join('、'), words
    };
  }
  const defaultRoundSize = grade => grade <= 2 ? 20 : grade <= 4 ? 25 : 30;
  const roundId = (unit, size) => `random:${size}:${unit.id}`;
  function sample(unit, size, previous = [], random = Math.random) {
    if (!unit || !Number.isInteger(size) || size < 1) throw new Error('Invalid practice round');
    const pool = [...unit.words];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const words = pool.slice(0, size);
    // When there are spare questions, consecutive rounds must not have identical sets.
    if (pool.length > words.length && previous.length === words.length && words.every(word => previous.includes(word))) {
      words[words.length - 1] = pool[words.length];
    }
    return { ...unit, id: roundId(unit, size), title: '跨年級隨機練習', sampled: true, poolSize: unit.words.length, words };
  }
  globalThis.PracticeScope = { gradeOf, unitKey, singleId, gradeName, eligible, build, checkAnswer, defaultRoundSize, roundId, sample };
})();
