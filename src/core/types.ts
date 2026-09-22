/** 一条断言：date(v) - date(u) <= c，编号 id 在批内唯一。 */
export interface Assertion {
  /** 断言编号，匹配 [1-9][0-9]{0,5}，按整数比较 */
  id: number;
  /** 起始事件名（区分大小写） */
  u: string;
  /** 结束事件名（区分大小写） */
  v: string;
  /** 整数上界，范围 [-100000, 100000] */
  c: number;
  /** 来源行号（从 1 开始），用于就地复核 */
  line: number;
}

/** 某一非法行的诊断信息 */
export interface LineError {
  line: number;
  raw: string;
  messages: string[];
}

/** 一批录入的解析与校验结果 */
export interface ParseResult {
  /** 全部合法的断言（仅当 ok 时才可供计算使用） */
  assertions: Assertion[];
  /** 逐行错误（就地标注用） */
  lineErrors: LineError[];
  /** 批次级错误（数量超限等） */
  batchErrors: string[];
  /** 批内不同事件名数量 */
  eventCount: number;
  /** 非空行数量 */
  assertionLines: number;
  /** 是否全部合法、可以计算 */
  ok: boolean;
}

/** 见证环上的一步：一条断言及其累计和 */
export interface WitnessStep {
  assertion: Assertion;
  /** 前 i 条 c 的累计和 */
  cumSum: number;
}

/**
 * 负环见证：一个权重和小于零的有向简单环。
 * - 除首尾闭合外事件不重复，断言不重复；
 * - 已沿原方向旋转到最小编号开头（未反转）；
 * - 是所有“边数最少”候选环中编号整数序列字典序最小者。
 */
export interface Witness {
  steps: WitnessStep[];
  /** 全部 c 的总和，必小于零 */
  total: number;
  /** 环上断言编号序列（规范旋转后） */
  ids: number[];
  /** 环上事件序列（首尾相同） */
  events: string[];
}
