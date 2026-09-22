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
 * - 用 min-plus 矩阵幂 W^t 求负闭_walk_的最少边数 k（对角线首次出现负值）。
 *   关键引理：长度恰为 k 的负闭_walk_必为简单环——否则重复顶点可把它拆成
 *   两个更短的闭_walk_，权重和为负意味着其中至少一个为负，与 k 的最小性矛盾。
 *   故“最短负闭_walk_”与“最短负简单环”等价，且以下所有可行性判定都无需
 *   追踪顶点访问集合：固定步数的最小权重_walk_一旦给出负值，取到该值的
 *   _walk_拼接前缀后必然是简单环。
 * - 规范形以环上最小编号边开头。按编号升序枚举首边 e0，并把可用边限制为
 *   id >= e0.id；用固定步数反向 DP 判定是否存在以 e0 开头的长度 k 负闭_walk_，
 *   第一个可行的 e0 即最优首边。
 * - 随后逐位贪心：每一步按编号升序试探邻接边，用同一张步数 DP 精确判定
 *   “剩余步数内能否以足够小的权重回到起点”，首个可行边即字典序最优选择。
 * 结果只依赖编号与图结构，与输入行序无关（确定性）。
 *
 * 复杂度：min-plus 幂 O(k n^3)；贪心构造 O(k m^2)（n ≤ 60, m ≤ 240）。
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
  let minK = -1;
  let current = w;
  for (let k = 1; k <= n; k++) {
    for (let i = 0; i < n; i++) {
      if (current[i][i] < 0) {
        minK = k;
        break;
      }
    }
    if (minK !== -1) break;
    if (k < n) current = minPlusMultiply(current, w, n);
  }
  if (minK === -1) return null;
  const k = minK;

  // dist[t][v]：从 v 出发、仅使用 id >= minId 的边、恰好 t 步到达 target 的
  // 最小权重。贪心每选一条边就查 dist[remain][e.to] 判定后缀可行性。
  const dist: number[][] = Array.from({ length: k }, () => new Array<number>(n).fill(INF));
  const buildDist = (target: number, minId: number): void => {
    for (let t = 0; t < k; t++) dist[t].fill(INF);
    dist[0][target] = 0;
    for (let t = 0; t + 1 < k; t++) {
      const curLayer = dist[t];
      const nextLayer = dist[t + 1];
      for (const e of byId) {
        if (e.id < minId) continue;
        const tail = curLayer[e.to];
        if (tail === INF) continue;
        const s = e.c + tail;
        if (s < nextLayer[e.from]) nextLayer[e.from] = s;
      }
    }
  };

  let chosen: Edge[] | undefined;

  for (const first of byId) {
    buildDist(first.from, first.id);
    // 以 first 开头走 k 条边回到其起点的最小总权重
    if (!(first.c + dist[k - 1][first.to] < 0)) continue;

    // 首边可行：逐位贪心构造以 first 开头的字典序最小长度 k 负环
    const picked: Edge[] = [first];
    let cur = first.to;
    let sum = first.c;
    for (let t = 1; t < k; t++) {
      const remain = k - t - 1;
      let next: Edge | undefined;
      for (const e of adj[cur]) {
        if (e.id < first.id) continue;
        const tail = dist[remain][e.to];
        if (tail !== INF && sum + e.c + tail < 0) {
          next = e;
          break;
        }
      }
      if (next === undefined) {
        // 不可达分支：首边可行时，dist 的最小化定义归纳保证每步必有候选
        picked.length = 0;
        break;
      }
      picked.push(next);
      cur = next.to;
      sum += next.c;
    }
    if (picked.length === k) {
      chosen = picked;
      break;
    }
  }

  if (chosen === undefined) return null;

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
