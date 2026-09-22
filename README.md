# 航海日志日期矛盾考证器

航海日志中“靠港”“补给”“离港”等事件的日期上界被抄录成一批形如
`date(v) - date(u) ≤ c` 的断言。本工具用**差分约束 + 负环求证**判断这批断言是否
自相矛盾；若矛盾，给出**最短且可重复复核**的矛盾链（权重和小于零的有向简单环）。

技术栈：TypeScript + React + Vite 单页应用，Vitest 单元测试，Playwright 端到端测试，
Docker Compose 一键启动。

## 输入格式与校验规则

每行一条断言，字段以空白分隔：

```
编号 起始事件u 结束事件v c
```

语义：`date(v) - date(u) ≤ c`（`u`、`v` 为事件名，`c` 为整数）。

- **编号**：须匹配 `[1-9][0-9]{0,5}`（1–999999，无前导零），整批唯一，按整数数值比较。
- **事件名**：1–64 个字符，允许 Unicode 字母、数字、下划线、连字符、点；
  **区分大小写**（`A` 与 `a` 是不同事件），不做任何归一化。
- **c**：整数，范围 `[-100000, 100000]`。
- **批量限制**：每批 1–60 个不同事件、1–240 条断言；纯空白行忽略。
- **任一非法行均阻止计算**，并在诊断区按行号就地标注该行的全部错误。

## 求证与选择规则

把每条断言看作有向边 `u → v`（权重 `c`），断言组相容 ⟺ 图中不存在权重和小于零的
有向环。见证（矛盾链）须为**有向简单环**：除首尾闭合外事件不重复、断言不重复、
权重总和小于零。满足条件的环可能不止一个，按以下规则取唯一结果：

1. **边数最少**者优先；
2. 将各候选环**沿原方向旋转**至最小编号开头（**禁止反转**）；
3. 按**编号整数序列字典序**取最小者。

平行边（同一对事件间的多条断言）、自环（单条断言成环）、多环并存均有确定结果；
结果只取决于编号与图结构，与输入行序无关，可重复复核。

算法要点（`src/core/negativeCycle.ts`）：

- 用 min-plus 矩阵幂求负闭_walk_的最少边数 `k`（负闭_walk_可分解为简单环，
  故最少边数的负简单环边数同为 `k`）；
- 在恰好 `k` 条边的负简单环中按编号贪心构造字典序最小者：逐位尝试最小编号，
  用 DFS + 矩阵幂下界剪枝判断是否存在可行补全。

## 结果展示

- **存在矛盾**：按环序展示每条不等式 `date(v) - date(u) ≤ c`、逐步累计和，
  并给出“总和小于零”的结论（左侧沿环抵消为 0，右侧总和 < 0，矛盾）。
- **约束相容**：只显示相容结论，**不编造任何具体日期**。

## Docker Compose 启动（推荐）

```bash
docker compose up --build web
```

访问 <http://localhost:8080>。可用 `WEB_PORT` 覆盖宿主端口：

```bash
WEB_PORT=9000 docker compose up --build web   # 访问 http://localhost:9000
```

一次性校验服务（构建后运行 Vitest 单元测试与 Playwright 端到端测试，跑完即退出）：

```bash
docker compose run --rm verify
# 或
docker compose up --build verify
```

## 本地开发

```bash
npm install                 # 安装依赖
npm run dev                 # 开发服务器（默认 5173 端口）
npm run test:unit           # Vitest 单元测试（解析校验 + 负环求证，含随机对拍）
npx playwright install chromium   # 首次运行端到端测试前安装浏览器
npm run test:e2e            # Playwright 端到端测试（自动构建并预览）
npm run verify              # 单元 + 端到端，一次跑完
npm run build               # 类型检查并产出 dist/
```

## 目录结构

```
src/
  core/
    types.ts               # 断言、解析结果、见证等类型
    parse.ts               # 逐行解析与全部校验规则
    negativeCycle.ts       # 负环求证与见证选择（核心算法）
    parse.test.ts          # 解析校验单元测试
    negativeCycle.test.ts  # 求证单元测试（含与暴力枚举的随机对拍）
  components/
    Diagnostics.tsx        # 就地错误标注
    WitnessView.tsx        # 矛盾链 / 相容结论展示
  App.tsx                  # 页面编排
e2e/
  app.spec.ts              # Playwright：录入与求证链路
Dockerfile                 # web 服务（构建 + nginx 托管）
Dockerfile.verify          # verify 一次性校验服务
docker-compose.yml         # web（WEB_PORT 可覆盖）与 verify
```
