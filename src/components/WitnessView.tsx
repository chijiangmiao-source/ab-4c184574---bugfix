import type { Witness } from '../core/types';

/** 考证结果：负环见证（不等式、累计和、总和小于零结论）或约束相容 */
export default function WitnessView({ witness }: { witness: Witness | null }) {
  if (witness === null) {
    return (
      <div className="result consistent" data-testid="consistent">
        <h2>考证结果：约束相容</h2>
        <p>
          本批断言不存在权重和小于零的有向环，各日期上界相互相容；
          按考证规则不给出任何具体日期。
        </p>
      </div>
    );
  }

  const k = witness.steps.length;
  return (
    <div className="result witness" data-testid="witness">
      <h2>考证结果：存在矛盾（负环）</h2>
      <p className="witness-meta">
        最短矛盾链共 <strong>{k}</strong> 条断言；编号序列{' '}
        <code data-testid="witness-ids">[{witness.ids.join(', ')}]</code>；事件环{' '}
        <code data-testid="witness-events">{witness.events.join(' → ')}</code>。
      </p>
      <table className="witness-table" data-testid="witness-table">
        <thead>
          <tr>
            <th>步骤</th>
            <th>断言编号</th>
            <th>源行</th>
            <th>不等式</th>
            <th>累计和</th>
          </tr>
        </thead>
        <tbody>
          {witness.steps.map((s, i) => (
            <tr key={s.assertion.id}>
              <td>{i + 1}</td>
              <td>#{s.assertion.id}</td>
              <td>第 {s.assertion.line} 行</td>
              <td>
                <code>
                  date({s.assertion.v}) - date({s.assertion.u}) ≤ {s.assertion.c}
                </code>
              </td>
              <td>{s.cumSum}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>总和</td>
            <td>{witness.total}</td>
          </tr>
        </tfoot>
      </table>
      <p className="conclusion" data-testid="conclusion">
        将以上 {k} 个不等式逐项相加：左侧沿环相互抵消恒等于 0，右侧总和小于零（
        {witness.total} &lt; 0），于是得到 0 ≤ {witness.total} &lt; 0 的矛盾。
        因此本批“靠港 / 补给 / 离港”的日期上界不可能同时成立。
      </p>
    </div>
  );
}
