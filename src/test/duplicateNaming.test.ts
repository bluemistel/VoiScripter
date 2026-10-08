/**
 * 複製時の名前（「名前 (1)」の連番）のテスト
 */

import { describe, it, expect } from 'vitest';
import { nextCopyName } from '../utils/duplicateNaming';

describe('nextCopyName', () => {
  it('元の名前に (1) を付ける', () => {
    expect(nextCopyName('台本A', ['台本A'])).toBe('台本A (1)');
  });

  it('使われている番号は飛ばして、空いている最小の番号にする', () => {
    expect(nextCopyName('台本A', ['台本A', '台本A (1)', '台本A (2)'])).toBe('台本A (3)');
    expect(nextCopyName('台本A', ['台本A', '台本A (2)'])).toBe('台本A (1)');
  });

  it('連番付きの名前を複製すると、元の名前の次の番号になる', () => {
    expect(nextCopyName('台本A (1)', ['台本A', '台本A (1)'])).toBe('台本A (2)');
  });

  it('番号だけの名前はそのまま元の名前として扱う', () => {
    expect(nextCopyName('(1)', ['(1)'])).toBe('(1) (1)');
  });
});
