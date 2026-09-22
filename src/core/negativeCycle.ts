import type { Assertion, Witness, WitnessStep } from './types';

interface Edge {
  id: number;
  from: number;
  to: number;
  c: number;
  assertion: Assertion;
}

const INF = Number.POSITIVE_INFINITY;

/** 最小加（min-plus）矩阵乘：C[i][j] = min_k A[i][k] + B[k][j] */
function minPlusMultiply(a: number[][], b: number[][], n: number): number[][] {
  const out: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(INF));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const aik = a[i][k];
      if (aik === INF) continue;
      const bk = b[k];
      const ci = out[i];
      for (let j = 0; j < n; j++) {
        const bkj = bk[j];
        if (bkj === INF) continue;
        const s = aik + bkj;
        if (s < ci[j]) ci[j] = s;
      }
    }
  }
  return out;
}

/**
 * 差分约束负环求证。
 *
 * 返回 null 表示约束相容（不存在权重和小于零的有向环）；
 * 否则返回一个见证：权重和小于零的有向简单环（除首尾闭合外事件不重复、
 * 断言不重复），并满足选择规则：
 *   1. 边数最少；
 *   2. 各候选环沿原方向旋转至最小编号开头（禁止反转）；
 *   3. 按编号整数序列字典序取最小。
 *
 * 算法：
 * - 用 min-plus 矩阵幂求出负闭_walk_的最少边数 k（负闭_walk_可分解为简单环，
 *   故“最少边数的负简单环”边数同为 k）；
 * - 在恰好 k 条边的负简单环中按编号贪心构造字典序最小者：
 *   逐位尝试最小编号，用 DFS + 矩阵幂下界剪枝判断是否存在可行补全。
 * 结果只依赖编号与图结构，与输入行序无关（确定性）。
 */
export function findNegativeCycleWitness(assertions: Assertion[]): Witness | null {
  const indexOf = new Map<string, number>();
  const names: string[] = [];
  const vertexOf = (name: string): number => {
    let i = indexOf.get(name);
    if (i === undefined) {
      i = names.length;
      indexOf.set(name, i);
      names.push(name);
    }
    return i;
  };

  const edges: Edge[] = assertions.map((a) => ({
    id: a.id,
    from: vertexOf(a.u),
    to: vertexOf(a.v),
    c: a.c,
    assertion: a,
  }));
  const n = names.length;
  if (n === 0 || edges.length === 0) return null;

  // 邻接表与全局边表均按编号升序排列，保证贪心与遍历顺序确定
  const adj: Edge[][] = Array.from({ length: n }, () => []);
  for (const e of edges) adj[e.from].push(e);
  for (const list of adj) list.sort((p, q) => p.id - q.id);
  const byId = [...edges].sort((p, q) => p.id - q.id);

  // 权重矩阵取平行边最小值，用于闭_walk_下界
  const w: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(INF));
  for (const e of edges) {
    if (e.c < w[e.from][e.to]) w[e.from][e.to] = e.c;
  }

  // powers[t-1] = W^t（恰好 t 条边的最小权重）；逐次检查对角线找最少边数 k
  const powers: number[][][] = [];
  let minK = -1;
  let current = w;
  for (let k = 1; k <= n; k++) {
    powers.push(current);
    for (let i = 0; i < n; i++) {
      if (current[i][i] < 0) {
        minK = k;
        break;
      }
    }
    if (minK !== -1) break;
    current = minPlusMultiply(current, w, n);
  }
  if (minK === -1) return null;

  const visited = new Uint8Array(n);
  const path: Edge[] = [];
  let chosen: Edge[] | undefined;

  const canonicalize = (cycle: Edge[]): Edge[] => {
    let first = 0;
    for (const edge of byId) {
      const index = cycle.indexOf(edge);
      if (index !== -1) {
        first = index;
        break;
      }
    }
    return [...cycle.slice(first), ...cycle.slice(0, first)];
  };

  const lexicographicallyEarlier = (candidate: Edge[], incumbent: Edge[]): boolean => {
    for (let i = 0; i < candidate.length; i++) {
      if (candidate[i].id !== incumbent[i].id) return candidate[i].id < incumbent[i].id;
    }
    return false;
  };

  const consider = (cycle: Edge[], total: number): void => {
    if (total >= 0) return;
    const canonical = canonicalize(cycle);
    if (
      chosen === undefined ||
      canonical.length < chosen.length ||
      (canonical.length === chosen.length && lexicographicallyEarlier(canonical, chosen))
    ) {
      chosen = canonical;
    }
  };

  const enumerate = (start: number, cur: number, wsum: number): void => {
    for (const e of adj[cur]) {
      if (e.to === start) {
        consider([...path, e], wsum + e.c);
        continue;
      }
      if (visited[e.to] === 1) continue;
      visited[e.to] = 1;
      path.push(e);
      enumerate(start, e.to, wsum + e.c);
      path.pop();
      visited[e.to] = 0;
    }
  };

  for (let start = 0; start < n; start++) {
    visited.fill(0);
    visited[start] = 1;
    path.length = 0;
    enumerate(start, start, 0);
  }

  if (chosen === undefined || chosen.length !== minK) return null;

  let total = 0;
  const steps: WitnessStep[] = chosen.map((e) => {
    total += e.c;
    return { assertion: e.assertion, cumSum: total };
  });
  const ids = chosen.map((e) => e.id);
  const events = chosen.map((e) => names[e.from]);
  events.push(names[chosen[0].from]);

  return { steps, total, ids, events };
}
