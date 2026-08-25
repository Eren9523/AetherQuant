# 本地真实回归证据

验证日期：2026-08-25（Asia/Hong_Kong）

验证基线：`b829b7b6cd5f03a4a5f16eefd6a6038601daa775`

## AKShare 真实调用

- Python 3.12.10
- AKShare 1.18.94
- 方法：`ak.stock_zh_a_spot_tx()`
- 实际完成 27 个分页，耗时约 44.1 秒
- 返回 5,550 只股票，`provider=tencent`，`source=akshare`
- 本轮指数主通道失败后使用 AKShare 备用通道，返回 8 个指数

## D1 快照

- 活跃快照：`cn_20260825070845_pg64`
- `market_quotes_snapshot` 活跃快照行数：5,550
- `market_indices_snapshot` 活跃快照行数：8
- 健康接口：`status=healthy`
- 同步结果：`last_sync_status=success`
- 全新本地持久化目录上的 5 个 D1 迁移全部成功，4 个市场核心表验证存在

## 表格 API 样本

`GET /api/v1/market/cn/spot?search=000001&page=1&page_size=5`

- 代码：000001
- 名称：平安银行
- 最新价：11.59
- 涨跌幅：0.26
- `provider=tencent`
- `source=akshare`
- 腾讯排行接口不提供的 `open/high/low` 为 `null`，未伪造数值

## R2 K 线缓存

`GET /api/v1/market/cn/stocks/600519/chart?interval=1w&adjust=qfq`

- 第一次：256 根，`provider=tencent`，`source=akshare`，`cached=false`
- 第二次：256 根，`cached=true`，`stale=false`
- R2 key：`market/cn/kline/600519/1w/qfq.json`
- R2 对象：50,617 bytes，日期范围 2021-08-27 至 2026-08-24
- D1 `market_kline_manifest` 对应记录：1
- 最后一根周 K：2026-08-24，OHLC = 1271.01 / 1313.80 / 1270.33 / 1304.66

## 代码验证

- `npm run lint`：通过
- `npm run build`：通过；仅存在原有 bundle size 警告
- `python -m pytest -q quant-service/tests`：16 passed
- `git diff --check`：无 whitespace error

## 边界

以上是本地 Wrangler D1/R2 绑定与真实外网 AKShare 的端到端证据。未操作你的 Cloudflare 远程数据库或生产 Worker，因此不应将这份报告视为“生产已部署”。
