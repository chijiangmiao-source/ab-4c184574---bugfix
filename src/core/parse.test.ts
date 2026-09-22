import { describe, expect, it } from 'vitest';
import { LIMITS, parseBatch } from './parse';

describe('parseBatch：合法批次', () => {
  it('解析合法行并统计事件', () => {
    const r = parseBatch('1 甲港 乙港 5\n2 乙港 甲港 -3');
    expect(r.ok).toBe(true);
    expect(r.assertions).toHaveLength(2);
    expect(r.assertions[0]).toMatchObject({ id: 1, u: '甲港', v: '乙港', c: 5, line: 1 });
    expect(r.assertions[1]).toMatchObject({ id: 2, u: '乙港', v: '甲港', c: -3, line: 2 });
    expect(r.eventCount).toBe(2);
  });

  it('忽略纯空白行', () => {
    const r = parseBatch('\n  \n1 A B 0\n\n');
    expect(r.ok).toBe(true);
    expect(r.assertionLines).toBe(1);
    expect(r.assertions[0].line).toBe(3);
  });

  it('事件名区分大小写：A 与 a 是不同事件', () => {
    const r = parseBatch('1 A B 0\n2 a B 0');
    expect(r.ok).toBe(true);
    expect(r.eventCount).toBe(3);
  });

  it('c 取边界值 ±100000 均合法', () => {
    expect(parseBatch('1 A B 100000').ok).toBe(true);
    expect(parseBatch('1 A B -100000').ok).toBe(true);
  });

  it('编号取边界值 1 与 999999 均合法', () => {
    expect(parseBatch('1 A B 0').ok).toBe(true);
    expect(parseBatch('999999 A B 0').ok).toBe(true);
  });
});

describe('parseBatch：非法行就地标错', () => {
  it('编号 0、前导零、超位、非数字均非法', () => {
    for (const bad of ['0', '01', '007', '1234567', 'abc', '-1', '1.5']) {
      const r = parseBatch(`${bad} A B 0`);
      expect(r.ok).toBe(false);
      expect(r.lineErrors).toHaveLength(1);
      expect(r.lineErrors[0].line).toBe(1);
      expect(r.lineErrors[0].messages.join()).toContain('编号');
    }
  });

  it('编号批内重复：后续行就地报错并指出首次出现行', () => {
    const r = parseBatch('5 A B 0\n3 B C 0\n5 C A 0');
    expect(r.ok).toBe(false);
    expect(r.lineErrors).toHaveLength(1);
    expect(r.lineErrors[0].line).toBe(3);
    expect(r.lineErrors[0].messages[0]).toContain('第 1 行');
  });

  it('c 非整数或越界', () => {
    for (const bad of ['100001', '-100001', 'x', '1.5', '--3', '']) {
      const r = parseBatch(`1 A B ${bad}`.trim());
      expect(r.ok).toBe(false);
      expect(r.lineErrors[0].messages.join()).toMatch(/c/);
    }
  });

  it('字段数不等于 4', () => {
    const r = parseBatch('1 A B\n1 A B C 0');
    expect(r.ok).toBe(false);
    expect(r.lineErrors).toHaveLength(2);
    expect(r.lineErrors[0].messages[0]).toContain('4 个字段');
  });

  it('事件名含非法字符', () => {
    const r = parseBatch('1 A# B 0');
    expect(r.ok).toBe(false);
    expect(r.lineErrors[0].messages.join()).toContain('起始事件');
  });

  it('一行多个错误全部列出', () => {
    const r = parseBatch('0 A# B 100001');
    expect(r.lineErrors).toHaveLength(1);
    expect(r.lineErrors[0].messages.length).toBeGreaterThanOrEqual(3);
  });

  it('保留原始行内容用于就地展示', () => {
    const r = parseBatch('  0  A   B  3  ');
    expect(r.lineErrors[0].raw).toBe('  0  A   B  3  ');
  });
});

describe('parseBatch：批次级限制', () => {
  it('空批次非法', () => {
    const r = parseBatch('   \n\n');
    expect(r.ok).toBe(false);
    expect(r.batchErrors.join()).toContain('至少需要 1 条断言');
  });

  it(`断言数量上限 ${LIMITS.maxAssertions}`, () => {
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => `${i + 1} A B 0`).join('\n');
    expect(parseBatch(mk(LIMITS.maxAssertions)).ok).toBe(true);
    const over = parseBatch(mk(LIMITS.maxAssertions + 1));
    expect(over.ok).toBe(false);
    expect(over.batchErrors.join()).toContain('241');
  });

  it(`事件数量上限 ${LIMITS.maxEvents}`, () => {
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => `${i + 1} E${i + 1} E${i + 1} 0`).join('\n');
    expect(parseBatch(mk(LIMITS.maxEvents)).ok).toBe(true);
    const over = parseBatch(mk(LIMITS.maxEvents + 1));
    expect(over.ok).toBe(false);
    expect(over.batchErrors.join()).toContain('61');
  });

  it('任一非法行都会使 ok=false', () => {
    const r = parseBatch('1 A B 0\n2 B C 0\n0 C A 0');
    expect(r.ok).toBe(false);
    expect(r.assertions).toHaveLength(2); // 合法行仍被解析，但整批不可计算
  });
});
