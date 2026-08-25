# 给 Google AI Studio / Gemini 的严格执行提示词

把本文全部复制给 AI Studio，并同时上传 `UPLOAD_MANIFEST.md` 中的 14 个文件。

---

你现在执行的不是重构、不是 UI 改版，也不是用模拟数据让页面“看起来正常”。

任务基线是 PenguinQuant 提交：

`b829b7b6cd5f03a4a5f16eefd6a6038601daa775`

我上传的 14 个代码文件是由外部模型审定并完成真实数据回归测试的“完整替换文件”。你必须按 `UPLOAD_MANIFEST.md` 中的相对路径逐一原样替换，不得摘抄、改写、简化或“优化”其中代码。

## 强制边界

1. 禁止修改现有前端布局、路由、组件名、菜单和视觉框架。
2. 禁止加入 mock、demo、synthetic、random、hard-coded 股价、静态行情 JSON 或“校准数据”。
3. 禁止在上游失败时返回 `success=true` 的伪数据。无真实数据时必须保留明确错误。
4. 禁止在 `MarketRepository` 或请求路由内动态 `CREATE TABLE`。D1 架构只能由 `worker/migrations/*.sql` 迁移。
5. 禁止把 R2 绑定改回 `BUCKET`。本项目的真实绑定名是 `DATA_BUCKET`。
6. 禁止将 Cloudflare token、D1/R2 凭据或 Quant Service token 写入源码。
7. 禁止修改或删除我上传的测试。
8. 如果预览环境没有 Python 或无法安装 AKShare，必须报告 `PYTHON_RUNTIME_UNAVAILABLE`，不得用前端数据代替。
9. 除了上传的 14 个文件，不允许修改其他文件。如果你认为必须修改，先停止并列出理由，等待人类批准。

## 执行顺序

1. 如果环境存在 Git 元数据，先回报当前 Git SHA；如果 SHA 不是上述基线，停止并报告差异。如果 AI Studio 无 Git 元数据，明确记录 `GIT_SHA_UNAVAILABLE`，核对 manifest 路径后继续原样替换，不要推测 SHA。
2. 按 manifest 完整替换 14 个文件。
3. 安装依赖：

   ```bash
   npm install
   python -m pip install -r quant-service/requirements.txt
   ```

4. 执行静态检查和测试：

   ```bash
   npm run lint
   npm run build
   python -m pytest -q quant-service/tests
   ```

5. 对一个全新的本地 D1 状态执行：

   ```bash
   npm run d1:migrate:local
   ```

6. 启动开发服务。Windows 环境如果 `python` 不在 PATH，设置 `PYTHON_BIN` 为实际 `python.exe` 绝对路径后再执行 `npm run dev`。
7. 完成下面的真实验收，不得仅报告“Build passed”。

## 真实验收门槛

必须提供下列原始返回的关键字段：

1. `GET /health` 必须显示 AKShare 实际安装版本。
2. 用 `Bearer <MARKET_SYNC_TOKEN>` 调用 `POST /api/v1/market/internal/sync`。
3. `GET /api/v1/market/health` 必须是 `status=healthy`、`stock_count >= 4000`、`last_sync_status=success`。
4. `GET /api/v1/market/cn/spot?search=000001&page=1&page_size=5` 必须返回实际股票、`provider`、`source`、`as_of`和活跃 `snapshot_id`。
5. 调用一个未缓存的 K 线 URL 两次。第一次应为 `cached=false`，第二次应为 `cached=true`，两次都要有非空 bars 且 `source=akshare`。
6. 验证 R2 存在 `market/cn/kline/<symbol>/<interval>/<adjust>.json`对象，D1 存在对应 `market_kline_manifest`。
7. 如果终端出现 `D1_ERROR: no such table` 或 `MARKET_SCHEMA_NOT_MIGRATED`，不要动态建表；返回迁移命令的完整错误。

最后只能输出：替换的 14 个路径、每条验证命令的退出码、真实 API 关键字段、D1 行数、R2 对象 key，以及仍未解决的错误。禁止用“已完全修复”代替证据。
