import type { Assertion, LineError, ParseResult } from './types';

/** 批次与字段的硬性限制 */
export const LIMITS = {
  maxEvents: 60,
  maxAssertions: 240,
  minC: -100000,
  maxC: 100000,
} as const;

/** 编号：1–999999，不允许前导零 */
export const ID_PATTERN = /^[1-9][0-9]{0,5}$/;

/**
 * 事件名：1–64 个字符，允许 Unicode 字母、数字、下划线、连字符、点；
 * 不做任何大小写归一化（区分大小写）。
 */
export const EVENT_PATTERN = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]{0,63}$/u;

/** 整数 c：可选符号 + 数字 */
export const C_PATTERN = /^[+-]?[0-9]+$/;

/**
 * 解析并校验整批录入。每行格式：`编号 起始事件u 结束事件v c`，
 * 语义为 date(v) - date(u) <= c。纯空白行忽略。
 * 任一非法行都会使 ok=false，从而阻止计算。
 */
export function parseBatch(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const assertions: Assertion[] = [];
  const lineErrors: LineError[] = [];
  const idFirstLine = new Map<number, number>();
  const events = new Set<string>();
  let assertionLines = 0;

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const trimmed = rawLine.trim();
    if (trimmed === '') return; // 空白行忽略
    assertionLines += 1;

    const errors: string[] = [];
    const tokens = trimmed.split(/\s+/);
    if (tokens.length !== 4) {
      errors.push(`应为 4 个字段「编号 起始事件 结束事件 c」，实际 ${tokens.length} 个`);
      lineErrors.push({ line: lineNo, raw: rawLine, messages: errors });
      return;
    }
    const [idTok, uTok, vTok, cTok] = tokens;

    let id: number | null = null;
    if (!ID_PATTERN.test(idTok)) {
      errors.push(`编号「${idTok}」非法：须匹配 [1-9][0-9]{0,5}（1–999999，无前导零）`);
    } else {
      id = Number.parseInt(idTok, 10);
      const first = idFirstLine.get(id);
      if (first !== undefined) {
        errors.push(`编号 ${id} 与第 ${first} 行重复（批内须唯一）`);
      } else {
        idFirstLine.set(id, lineNo);
      }
    }

    const uOk = EVENT_PATTERN.test(uTok);
    const vOk = EVENT_PATTERN.test(vTok);
    if (!uOk) {
      errors.push(`起始事件「${uTok}」非法：1–64 个字符，允许字母/数字/下划线/连字符/点`);
    }
    if (!vOk) {
      errors.push(`结束事件「${vTok}」非法：1–64 个字符，允许字母/数字/下划线/连字符/点`);
    }

    let c: number | null = null;
    if (!C_PATTERN.test(cTok)) {
      errors.push(`c「${cTok}」非法：须为整数`);
    } else {
      c = Number.parseInt(cTok, 10);
      if (c < LIMITS.minC || c > LIMITS.maxC) {
        errors.push(`c=${c} 超出范围 [${LIMITS.minC}, ${LIMITS.maxC}]`);
      }
    }

    if (uOk) events.add(uTok);
    if (vOk) events.add(vTok);

    if (errors.length > 0) {
      lineErrors.push({ line: lineNo, raw: rawLine, messages: errors });
    } else if (id !== null && c !== null) {
      assertions.push({ id, u: uTok, v: vTok, c, line: lineNo });
    }
  });

  const batchErrors: string[] = [];
  if (assertionLines === 0) {
    batchErrors.push('至少需要 1 条断言');
  }
  if (assertionLines > LIMITS.maxAssertions) {
    batchErrors.push(`断言数量 ${assertionLines} 超过上限 ${LIMITS.maxAssertions}`);
  }
  if (events.size > LIMITS.maxEvents) {
    batchErrors.push(`事件数量 ${events.size} 超过上限 ${LIMITS.maxEvents}`);
  }

  const ok = lineErrors.length === 0 && batchErrors.length === 0;
  return { assertions, lineErrors, batchErrors, eventCount: events.size, assertionLines, ok };
}
