/* Pure range selection shared by the interface and its checks. */
(() => {
  const labels = ['', '一', '二', '三', '四', '五', '六'];
  const gradeOf = unit => unit.grade ?? 1;
  const unitKey = unit => `g${gradeOf(unit)}:${unit.id}`;
  const singleId = unit => gradeOf(unit) === 1 ? unit.id : unitKey(unit);
  const gradeName = grade => `${labels[grade]}年級`;
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
  globalThis.PracticeScope = { gradeOf, unitKey, singleId, gradeName, eligible, build };
})();
