import { useMemo, useState } from 'react';
import { parseBatch } from './core/parse';
import { findNegativeCycleWitness } from './core/negativeCycle';
import type { Witness } from './core/types';
import Diagnostics from './components/Diagnostics';
import WitnessView from './components/WitnessView';

const SAMPLE_CONTRADICTION = ['1 甲港 乙港 5', '2 乙港 丙港 -8', '3 丙港 甲港 1'].join('\n');

const SAMPLE_CONSISTENT = ['1 甲港 乙港 5', '2 乙港 丙港 -3', '3 丙港 甲港 -1'].join('\n');

const SAMPLE_MULTI_CYCLE = [
  '2 丙港 甲港 -1',
  '5 甲港 乙港 0',
  '9 乙港 丙港 0',
  '4 甲港 丁港 -2',
  '7 丁港 丙港 0',
].join('\n');

interface Report {
  source: string;
  witness: Witness | null;
}

export default function App() {
  const [text, setText] = useState('');
  const [report, setReport] = useState<Report | null>(null);

  const parsed = useMemo(() => parseBatch(text), [text]);
  const stale = report !== null && report.source !== text;

  const compute = () => {
    if (!parsed.ok) return; // 任一非法行均阻止计算
    setReport({ source: text, witness: findNegativeCycleWitness(parsed.assertions) });
  };

  return (
    <div className="page">
      <header>
        <h1>航海日志日期矛盾考证器</h1>
        <p className="subtitle">
          每行一条断言：<code>编号 起始事件u 结束事件v c</code>，语义为{' '}
          <code>date(v) - date(u) ≤ c</code>。 若“靠港 / 补给 / 离港”的日期上界互相矛盾，
          本工具给出最短且可重复复核的矛盾链（权重和小于零的有向简单环）。
        </p>
      </header>

      <main>
        <section className="card">
          <h2>1. 逐行录入断言</h2>
          <textarea
            data-testid="assertions-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder={'例如：\n1 甲港 乙港 5\n2 乙港 丙港 -8\n3 丙港 甲港 1'}
          />
          <div className="toolbar">
            <button data-testid="compute" onClick={compute} disabled={!parsed.ok}>
              计算
            </button>
            <button
              data-testid="sample-contradiction"
              onClick={() => setText(SAMPLE_CONTRADICTION)}
            >
              示例：矛盾
            </button>
            <button data-testid="sample-consistent" onClick={() => setText(SAMPLE_CONSISTENT)}>
              示例：相容
            </button>
            <button data-testid="sample-multi" onClick={() => setText(SAMPLE_MULTI_CYCLE)}>
              示例：多环取字典序
            </button>
            <button data-testid="clear" onClick={() => setText('')}>
              清空
            </button>
          </div>
          {!parsed.ok && (
            <p className="blocked-hint" data-testid="blocked-hint">
              存在非法行或批次超限，已阻止计算。
            </p>
          )}
          <Diagnostics parsed={parsed} />
        </section>

        <section className="card">
          <h2>2. 考证结果</h2>
          {report === null ? (
            <p className="placeholder" data-testid="no-result">
              校验通过后点击「计算」。
            </p>
          ) : (
            <div data-testid="result">
              {stale && (
                <p className="stale-hint" data-testid="stale-hint">
                  输入已修改，以下结果对应修改前的批次，请重新计算。
                </p>
              )}
              <WitnessView witness={report.witness} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
