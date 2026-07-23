/** #rrggbb / #rgb 形式の色の相対輝度から、読みやすい文字色（濃/淡）を返す */
export const getReadableTextColor = (hexColor: string): string => {
  const hex = hexColor.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return '#1f2937';
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // sRGB 簡易輝度
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1f2937' : '#f9fafb';
};
