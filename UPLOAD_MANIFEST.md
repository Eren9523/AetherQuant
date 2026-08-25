# PenguinQuant AKShare 修复包

基线仓库：`https://github.com/Eren9523/PenguinQuant`

基线提交：`b829b7b6cd5f03a4a5f16eefd6a6038601daa775`

请将本目录内的代码文件按下列路径完整替换到 Google AI Studio 项目。不要只复制局部代码块，不要让 Gemini 重写这些文件。

## 完整替换清单

1. `devServer.ts`
2. `package.json`
3. `wrangler.jsonc`
4. `quant-service/requirements.txt`
5. `quant-service/app/core/config.py`
6. `quant-service/app/providers/akshare_provider.py`
7. `quant-service/app/providers/data_source_manager.py`
8. `quant-service/app/services/market_service.py`
9. `quant-service/tests/test_tencent_history_fallback.py`
10. `worker/migrations/0004_market_pipeline_fix.sql`
11. `worker/src/market/marketKlineStore.ts`
12. `worker/src/market/marketRepository.ts`
13. `worker/src/market/marketRoutes.ts`
14. `worker/src/market/marketSyncService.ts`

## 这个包修复的故障

- D1 数据库名从错误的 `penguinquant-db` 统一为实际绑定 `aetherquant-db`。
- 本地迁移不再把整个 SQL 文件交给 `db.exec()`，避免注释行导致的 `SQL code did not contain a statement`。
- 运行时不再“自愈创建” D1 表；迁移缺失时明确报 `MARKET_SCHEMA_NOT_MIGRATED`。
- R2 代码统一读取实际 Wrangler 绑定 `DATA_BUCKET`。
- 真实调用已安装的 AKShare，全市场默认使用 `stock_zh_a_spot_tx()`，东财仍是真实备用通道。
- AKShare 腾讯分页失败时才转到同一腾讯公开数据源，并明确标记 `source=tencent_http`，不冒充 AKShare。
- 腾讯行情不提供 OHLC 时保留 `null`，不用最新价伪造开高低价。
- K 线增加腾讯 AKShare 备用通道，保存准确的 `provider/source`，并写入 R2。
- 5,500 行快照改用 D1 JSON1 批量写入，每日一次收盘同步，适配 D1/R2 免费额度思路。

## 不在本包中的操作

本包没有修改 Cloudflare 远程 D1/R2，没有提交或推送 GitHub，也没有代替你配置生产密钥。生产环境还必须有一个可运行 Python + AKShare 的 Quant Service，Cloudflare Worker 只负责网关、D1 和 R2。
