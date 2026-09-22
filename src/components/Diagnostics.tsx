import type { ParseResult } from '../core/types';

/** 校验诊断：批次级错误 + 逐行就地标注 */
export default function Diagnostics({ parsed }: { parsed: ParseResult }) {
  return (
    <div className="diagnostics" data-testid="diagnostics">
      {parsed.batchErrors.length > 0 && (
        <div className="batch-errors" data-testid="batch-errors" role="alert">
          {parsed.batchErrors.map((msg) => (
            <p key={msg}>⚠ {msg}</p>
          ))}
        </div>
      )}

      {parsed.lineErrors.length > 0 && (
        <div className="line-errors" data-testid="line-errors">
          {parsed.lineErrors.map((le) => (
            <div className="line-error" data-testid={`line-error-${le.line}`} key={le.line}>
              <div className="line-error-head">
                <span className="line-no">第 {le.line} 行</span>
                <code className="line-raw">{le.raw}</code>
              </div>
              <ul>
                {le.messages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {parsed.ok && parsed.assertions.length > 0 && (
        <p className="ok-summary" data-testid="ok-summary">
          校验通过：{parsed.assertions.length} 条断言，{parsed.eventCount} 个事件。
        </p>
      )}
    </div>
  );
}
