/**
 * 複製したシーン・プロジェクトの名前を決める。
 * 元の名前に「 (1)」「 (2)」…と連番を付け、既存の名前と重ならない最小の番号を使う。
 * 元の名前がすでに「名前 (n)」の形なら、その番号を外した名前を元にする（「名前 (1)」の複製は「名前 (2)」）。
 */
export const nextCopyName = (name: string, existingNames: readonly string[]): string => {
  const base = name.replace(/ \(\d+\)$/, '') || name;
  const taken = new Set(existingNames);
  for (let n = 1; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
};
