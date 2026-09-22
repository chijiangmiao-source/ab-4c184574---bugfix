import { describe, expect, it } from 'vitest';
import { findNegativeCycleWitness } from './negativeCycle';
import type { Assertion, Witness } from './types';

let line = 0;
const a = (id: number, u: string, v: string, c: number): Assertion => ({ id, u, v, c, line: ++line });

/** 校验见证结构：简单环、断言不重复、总和小于零、规范旋转 */
function expectValidWitness(w: Witness) {
  const { steps, total, ids, events } = w;
  expect(steps.length).toBeGreaterThan(0);
  // 链式相接并闭合
  for (let i = 0; i < steps.length; i++) {
    expect(steps[i].assertion.v).toBe(steps[(i + 1) % steps.length].assertion.u);
  }
  // 事件除首尾闭合外不重复
  expect(events).toHaveLength(steps.length + 1);
  expect(events[0]).toBe(events[events.length - 1]);
  expect(new Set(events.slice(0, -1)).size).toBe(steps.length);
  // 断言不重复
  expect(new Set(ids).size).toBe(ids.length);
  // 累计和与总和
  let acc = 0;
  for (const s of steps) {
    acc += s.assertion.c;
    expect(s.cumSum).toBe(acc);
  }
  expect(total).toBe(acc);
  expect(total).toBeLessThan(0);
  // 已旋转到最小编号开头
  expect(ids[0]).toBe(Math.min(...ids));
}

describe('findNegativeCycleWitness：手工用例', () => {
  it('三角负环：按环序给出不等式与累计和', () => {
    const w = findNegativeCycleWitness([a(1, 'A', 'B', 5), a(2, 'B', 'C', -8), a(3, 'C', 'A', 1)]);
    expect(w).not.toBeNull();
    expect(w!.ids).toEqual([1, 2, 3]);
    expect(w!.steps.map((s) => s.cumSum)).toEqual([5, -3, -2]);
    expect(w!.total).toBe(-2);
    expect(w!.events).toEqual(['A', 'B', 'C', 'A']);
    expectValidWitness(w!);
  });

  it('规范旋转：沿原方向转到最小编号开头', () => {
    const w = findNegativeCycleWitness([a(9, 'A', 'B', -1), a(5, 'B', 'C', -1), a(7, 'C', 'A', -1)]);
    expect(w!.ids).toEqual([5, 7, 9]);
    expect(w!.events).toEqual(['B', 'C', 'A', 'B']);
    expectValidWitness(w!);
  });

  it('禁止反转：只沿原方向旋转，不取反向的更优字典序', () => {
    // 正向规范序列为 [1,2,9]；若允许反转会得到字典序更小的 [1,9,2]
    const w = findNegativeCycleWitness([a(9, 'A', 'B', -3), a(1, 'B', 'C', 0), a(2, 'C', 'A', 0)]);
    expect(w!.ids).toEqual([1, 2, 9]);
    expectValidWitness(w!);
  });

  it('同长候选环按编号整数序列字典序取最小', () => {
    const w = findNegativeCycleWitness([
      a(2, 'C', 'A', -1),
      a(5, 'A', 'B', 0),
      a(9, 'B', 'C', 0),
      a(4, 'A', 'D', -2),
      a(7, 'D', 'C', 0),
    ]);
    expect(w!.ids).toEqual([2, 4, 7]);
    expect(w!.total).toBe(-3);
    expectValidWitness(w!);
  });

  it('边数最少优先：负自环胜过编号更小的长环', () => {
    const w = findNegativeCycleWitness([
      a(1, 'A', 'B', 5),
      a(2, 'B', 'C', -8),
      a(3, 'C', 'A', 1),
      a(50, 'X', 'X', -1),
    ]);
    expect(w!.ids).toEqual([50]);
    expect(w!.events).toEqual(['X', 'X']);
    expectValidWitness(w!);
  });

  it('负自环：单个断言构成环', () => {
    const w = findNegativeCycleWitness([a(7, 'X', 'X', -3)]);
    expect(w!.ids).toEqual([7]);
    expect(w!.total).toBe(-3);
    expectValidWitness(w!);
  });

  it('同一事件多个负自环取最小编号', () => {
    const w = findNegativeCycleWitness([a(3, 'X', 'X', -2), a(1, 'X', 'X', -5)]);
    expect(w!.ids).toEqual([1]);
    expectValidWitness(w!);
  });

  it('非负自环不构成见证', () => {
    expect(findNegativeCycleWitness([a(1, 'X', 'X', 0)])).toBeNull();
    expect(findNegativeCycleWitness([a(1, 'X', 'X', 4)])).toBeNull();
  });

  it('平行边：同一对事件间的多条断言分别参与选择', () => {
    const w = findNegativeCycleWitness([a(1, 'A', 'B', 5), a(2, 'A', 'B', -10), a(3, 'B', 'A', 0)]);
    expect(w!.ids).toEqual([2, 3]);
    expect(w!.total).toBe(-10);
    expectValidWitness(w!);
  });

  it('二元环', () => {
    const w = findNegativeCycleWitness([a(4, 'P', 'Q', 2), a(6, 'Q', 'P', -5)]);
    expect(w!.ids).toEqual([4, 6]);
    expect(w!.total).toBe(-3);
    expectValidWitness(w!);
  });

  it('零和环不算负环', () => {
    expect(findNegativeCycleWitness([a(1, 'A', 'B', 1), a(2, 'B', 'A', -1)])).toBeNull();
  });

  it('相容批次返回 null', () => {
    expect(
      findNegativeCycleWitness([a(1, 'A', 'B', 5), a(2, 'B', 'C', -3), a(3, 'C', 'A', -1)]),
    ).toBeNull();
  });

  it('无环图返回 null', () => {
    expect(findNegativeCycleWitness([a(1, 'A', 'B', -9), a(2, 'B', 'C', -9)])).toBeNull();
  });

  it('不连通分量中的负环也能找到', () => {
    const w = findNegativeCycleWitness([
      a(1, 'A', 'B', 1),
      a(2, 'B', 'A', 1),
      a(3, 'P', 'Q', -4),
      a(4, 'Q', 'P', 1),
    ]);
    expect(w!.ids).toEqual([3, 4]);
    expectValidWitness(w!);
  });

  it('较大图：50 边负环 + 非负弦，仍取环序最小编号序列', () => {
    const n = 50;
    const batch: Assertion[] = [];
    for (let i = 0; i < n; i++) {
      batch.push({
        id: i + 1,
        u: `R${i}`,
        v: `R${(i + 1) % n}`,
        c: i === n - 1 ? -1 : 0,
        line: i + 1,
      });
    }
    // 非负弦：与环边组成更短但非负的环，不影响结果
    let chordId = 100;
    for (let i = 0; i < n; i += 2) {
      batch.push({ id: chordId, u: `R${i}`, v: `R${(i + 2) % n}`, c: 7, line: chordId });
      chordId += 1;
    }
    const w = findNegativeCycleWitness(batch);
    expect(w!.ids).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    expect(w!.total).toBe(-1);
    expectValidWitness(w!);
  });

  it('满规模相容批次：60 事件 240 断言返回 null', () => {
    const batch: Assertion[] = [];
    let id = 1;
    // 只保留 i<j 的边：无环，必相容
    for (let i = 0; i < 60 && batch.length < 240; i++) {
      for (let j = i + 1; j < 60 && batch.length < 240; j++) {
        batch.push({ id: id++, u: `E${i}`, v: `E${j}`, c: -5, line: id });
      }
    }
    expect(batch).toHaveLength(240);
    expect(findNegativeCycleWitness(batch)).toBeNull();
  });

  it('结果与输入行序无关（确定性）', () => {
    const base = [
      a(2, 'C', 'A', -1),
      a(5, 'A', 'B', 0),
      a(9, 'B', 'C', 0),
      a(4, 'A', 'D', -2),
      a(7, 'D', 'C', 0),
    ];
    const first = findNegativeCycleWitness(base)!.ids;
    const rng = mulberry32(42);
    for (let t = 0; t < 20; t++) {
      const shuffled = [...base];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      expect(findNegativeCycleWitness(shuffled)!.ids).toEqual(first);
    }
  });
});

/** 合法高分支批次：58 事件 / 168 断言，始终走下标 2 才成负环 */
function buildHighBranchingBatch(): Assertion[] {
  const batch: Assertion[] = [];
  let line = 0;
  const ev = (layer: number, idx: number) => (layer === -1 ? 'S' : `L${layer}_${idx}`);
  const add = (id: number, u: string, v: string, c: number) =>
    batch.push({ id, u, v, c, line: ++line });

  // 编号 1..3：S -> 第一层三个事件；指向下标 2 的上界为 0，其余为 1
  for (let b = 0; b < 3; b++) add(1 + b, 'S', ev(0, b), b === 2 ? 0 : 1);
  // 相邻层之间全部九种连接：编号 4+9i+3a+b；仅终点下标为 2 时上界为 0
  for (let i = 0; i < 18; i++) {
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        add(4 + 9 * i + 3 * a + b, ev(i, a), ev(i + 1, b), b === 2 ? 0 : 1);
      }
    }
  }
  // 编号 166..168：末层三个事件返回 S，上界均为 -1
  for (let a = 0; a < 3; a++) add(166 + a, ev(18, a), 'S', -1);
  return batch;
}

const EXPECTED_HIGH_IDS = [
  3, 12, 21, 30, 39, 48, 57, 66, 75, 84, 93, 102, 111, 120, 129, 138, 147, 156, 165, 168,
];
const EXPECTED_HIGH_EVENTS = [
  'S',
  ...Array.from({ length: 19 }, (_, i) => `L${i}_2`),
  'S',
];

describe('findNegativeCycleWitness：合法高分支批次（58 事件 / 168 断言）', () => {
  it('5 秒内返回唯一的 20 条矛盾链：规范编号、事件链、累计和、总和', () => {
    const batch = buildHighBranchingBatch();
    expect(batch).toHaveLength(168);
    expect(new Set(batch.flatMap((x) => [x.u, x.v]))).toHaveLength(58);
    expect(new Set(batch.map((x) => x.id))).toHaveLength(168);

    const t0 = Date.now();
    const w = findNegativeCycleWitness(batch);
    expect(Date.now() - t0).toBeLessThan(5000);

    expect(w).not.toBeNull();
    expect(w!.ids).toEqual(EXPECTED_HIGH_IDS);
    expect(w!.events).toEqual(EXPECTED_HIGH_EVENTS);
    // 前 19 步累计和均为 0，最后一步（及总和）为 -1
    expect(w!.steps.map((s) => s.cumSum)).toEqual([
      ...Array.from({ length: 19 }, () => 0),
      -1,
    ]);
    expect(w!.total).toBe(-1);
    expectValidWitness(w!);
  });

  it('乱序输入结果完全一致（多种洗牌 + 逆序）', () => {
    const base = buildHighBranchingBatch();
    const expectShape = (w: Witness) => {
      expect(w.ids).toEqual(EXPECTED_HIGH_IDS);
      expect(w.events).toEqual(EXPECTED_HIGH_EVENTS);
      expect(w.total).toBe(-1);
    };

    const reversed = [...base].reverse();
    expectShape(findNegativeCycleWitness(reversed)!);

    const rng = mulberry32(20260922);
    for (let t = 0; t < 10; t++) {
      const shuffled = [...base];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const t0 = Date.now();
      const w = findNegativeCycleWitness(shuffled);
      expect(Date.now() - t0).toBeLessThan(5000);
      expectShape(w!);
      expectValidWitness(w!);
    }
  });

  it('同规模高分支相容批次（返回边取 0）同样快速返回 null', () => {
    const batch = buildHighBranchingBatch().map((x) =>
      x.id >= 166 ? { ...x, c: 0 } : x,
    );
    const t0 = Date.now();
    expect(findNegativeCycleWitness(batch)).toBeNull();
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

/** 可复现的伪随机数 */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lexLess(x: number[], y: number[]): boolean {
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] < y[i];
  }
  return x.length < y.length;
}

/** 暴力枚举所有简单环，按同一选择规则求参照答案（仅用于小规模对拍） */
function bruteForceIds(assertions: Assertion[]): number[] | null {
  const names = [...new Set(assertions.flatMap((x) => [x.u, x.v]))];
  const idx = new Map(names.map((nm, i) => [nm, i] as const));
  const n = names.length;
  interface E {
    id: number;
    from: number;
    to: number;
    c: number;
  }
  const edges: E[] = assertions.map((x) => ({
    id: x.id,
    from: idx.get(x.u)!,
    to: idx.get(x.v)!,
    c: x.c,
  }));
  const adj: E[][] = Array.from({ length: n }, () => []);
  for (const e of edges) adj[e.from].push(e);

  let best: number[] | null = null;
  const consider = (cyc: E[], total: number) => {
    if (total >= 0) return;
    const ids = cyc.map((e) => e.id);
    let mi = 0;
    for (let i = 1; i < ids.length; i++) if (ids[i] < ids[mi]) mi = i;
    const canon = [...ids.slice(mi), ...ids.slice(0, mi)];
    if (
      best === null ||
      canon.length < best.length ||
      (canon.length === best.length && lexLess(canon, best))
    ) {
      best = canon;
    }
  };

  for (const e of edges) if (e.from === e.to) consider([e], e.c);

  const visited = new Uint8Array(n);
  const path: E[] = [];
  const dfs = (start: number, cur: number, total: number) => {
    for (const e of adj[cur]) {
      if (e.to === e.from) continue;
      if (e.to === start) {
        consider([...path, e], total + e.c);
        continue;
      }
      if (visited[e.to]) continue;
      visited[e.to] = 1;
      path.push(e);
      dfs(start, e.to, total + e.c);
      path.pop();
      visited[e.to] = 0;
    }
  };
  for (let s = 0; s < n; s++) {
    visited.fill(0);
    visited[s] = 1;
    path.length = 0;
    dfs(s, s, 0);
  }
  return best;
}

describe('findNegativeCycleWitness：与暴力枚举随机对拍', () => {
  it('小规模随机图上结果一致', () => {
    const rng = mulberry32(20260917);
    const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
    for (let iter = 0; iter < 400; iter++) {
      const nEvents = ri(1, 6);
      const m = ri(1, 10);
      const pool = Array.from({ length: nEvents }, (_, i) => `E${i}`);
      const idPool = Array.from({ length: 60 }, (_, i) => i + 1);
      for (let i = idPool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [idPool[i], idPool[j]] = [idPool[j], idPool[i]];
      }
      const batch: Assertion[] = Array.from({ length: m }, (_, i) => ({
        id: idPool[i],
        u: pool[ri(0, nEvents - 1)],
        v: pool[ri(0, nEvents - 1)],
        c: ri(-6, 6),
        line: i + 1,
      }));
      const got = findNegativeCycleWitness(batch);
      const want = bruteForceIds(batch);
      if (want === null) {
        expect(got, `批次 ${JSON.stringify(batch)}`).toBeNull();
      } else {
        expect(got, `批次 ${JSON.stringify(batch)}`).not.toBeNull();
        expect(got!.ids, `批次 ${JSON.stringify(batch)}`).toEqual(want);
        expectValidWitness(got!);
      }
    }
  });
});
