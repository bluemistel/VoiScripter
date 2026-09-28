/**
 * パーソナルカラー派生ヘルパーのテスト
 */

import { describe, it, expect } from 'vitest';
import { bubbleFill, nameBadgeText, nameLabelText } from '../utils/colorUtils';

/** WCAG の相対輝度 */
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** モックで使われているキャラ色 */
const SAMPLE_COLORS = ['#6ba8e8', '#f0b458', '#f2a0b5', '#9ca3af', '#ff0000', '#00ffcc'];

describe('bubbleFill', () => {
  it('ライトは 14、ダークは 24 のアルファを付ける', () => {
    expect(bubbleFill('#6ba8e8', false)).toBe('#6ba8e814');
    expect(bubbleFill('#6ba8e8', true)).toBe('#6ba8e824');
  });

  it('#rgb 形式と大文字を正規化する', () => {
    expect(bubbleFill('#ABC', false)).toBe('#aabbcc14');
  });

  it('解釈できない色は既定色にフォールバックする', () => {
    expect(bubbleFill('', false)).toBe('#9ca3af14');
    expect(bubbleFill('rgb(1, 2, 3)', true)).toBe('#9ca3af24');
  });
});

describe('nameBadgeText', () => {
  it('#rrggbb を返す', () => {
    SAMPLE_COLORS.forEach(color => expect(nameBadgeText(color)).toMatch(/^#[0-9a-f]{6}$/));
  });

  it('通常のキャラ色では濃色文字で 4.5:1 以上のコントラストを確保する', () => {
    ['#6ba8e8', '#f0b458', '#f2a0b5', '#9ca3af', '#00ffcc'].forEach(color => {
      const text = nameBadgeText(color);
      expect(luminance(text)).toBeLessThan(luminance(color));
      expect(contrast(text, color)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('暗いキャラ色では淡色文字に切り替えて読めるようにする', () => {
    ['#333333', '#0000ff', '#1f3a5f'].forEach(color => {
      const text = nameBadgeText(color);
      expect(luminance(text)).toBeGreaterThan(luminance(color));
      expect(contrast(text, color)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('nameLabelText', () => {
  it('ライトはブロック面（白）に対して 4.5:1 以上', () => {
    SAMPLE_COLORS.forEach(color => {
      expect(contrast(nameLabelText(color, false), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('ダークはブロック面（rgb(39 39 39)）に対して 4.5:1 以上', () => {
    SAMPLE_COLORS.forEach(color => {
      expect(contrast(nameLabelText(color, true), '#272727')).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('色相を保つ（青は青系のまま）', () => {
    const [r, , b] = [1, 3, 5].map(i => parseInt(nameLabelText('#6ba8e8', false).slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
  });
});
