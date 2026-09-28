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

// ---------------------------------------------------------------------------
// キャラクターのパーソナルカラーの派生（docs/design-handoff/tokens.css 末尾参照）
// 使ってよい場所は「テキストエリアの枠線」「話者名バッジ」「テキストエリアの薄い背景」の3か所のみ。
// ---------------------------------------------------------------------------

/** 色が解釈できないときに使う既定のキャラクター色（アイコン背景の既定と同じ） */
const DEFAULT_CHARACTER_COLOR = '#9ca3af';

/** #rgb / #rrggbb を小文字の #rrggbb に正規化する。解釈できなければ既定色 */
const normalizeHex = (hexColor: string): string => {
  const hex = hexColor.trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return DEFAULT_CHARACTER_COLOR;
  return `#${full.toLowerCase()}`;
};

type Oklch = { l: number; c: number; h: number };

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

const hexToOklch = (hexColor: string): Oklch => {
  const hex = normalizeHex(hexColor).slice(1);
  const [r, g, b] = [0, 2, 4].map(i => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
};

/** OKLCH → リニアsRGB（ガマット外なら 0〜1 をはみ出した値を返す） */
const oklchToLinearRgb = ({ l: L, c, h }: Oklch): [number, number, number] => {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
};

const isInGamut = (rgb: [number, number, number]): boolean =>
  rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH → #rrggbb。sRGB に収まらないときは明度と色相を保ったまま彩度を落とす */
const oklchToHex = (color: Oklch): string => {
  let rgb = oklchToLinearRgb(color);
  if (!isInGamut(rgb)) {
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (isInGamut(oklchToLinearRgb({ ...color, c: mid }))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinearRgb({ ...color, c: lo });
  }
  return `#${rgb
    .map(v => Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
};

/** 色相を保ったまま OKLCH の明度を差し替える（chromaScale で彩度も調整） */
const withLightness = (color: string, lightness: number, chromaScale = 1): string => {
  const base = hexToOklch(color);
  return oklchToHex({ l: lightness, c: base.c * chromaScale, h: base.h });
};

/** テキストエリアの薄い背景。キャラ色に 8桁HEX のアルファ（ライト 0x14 / ダーク 0x24）を付ける */
export const bubbleFill = (color: string, isDark: boolean): string =>
  `${normalizeHex(color)}${isDark ? '24' : '14'}`;

/** WCAG の相対輝度（#rrggbb） */
const relativeLuminance = (hexColor: string): number => {
  const hex = normalizeHex(hexColor).slice(1);
  const [r, g, b] = [0, 2, 4].map(i => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG のコントラスト比 */
const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * 話者名バッジ（キャラ色の塗り）の上に載せる文字色。
 * キャラ色を L≈0.30 まで暗くした濃色で、ライト・ダーク共通。
 * 彩度は色味がわずかに残る程度に抑える（モックの濃色文字に合わせる）。
 * キャラ色自体が暗く濃色文字が読めない場合だけ、同じ色相の淡色に切り替える。
 */
export const nameBadgeText = (color: string): string => {
  const dark = withLightness(color, 0.3, 0.25);
  if (contrastRatio(dark, color) >= 4.5) return dark;
  const light = withLightness(color, 0.97, 0.25);
  return contrastRatio(light, color) > contrastRatio(dark, color) ? light : dark;
};

/**
 * 背景に直接載せる話者名の文字色（シネマの話者名ラベルなど）。
 * ライトは L≈0.45 の暗いトーン、ダークは L≈0.82 の明るいトーン。
 */
export const nameLabelText = (color: string, isDark: boolean): string =>
  withLightness(color, isDark ? 0.82 : 0.45);
