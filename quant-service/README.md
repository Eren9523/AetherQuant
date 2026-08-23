# Penguin Quant Python Market Service

面向 A 股真实市场行情的轻量高性能微服务（基于 FastAPI + AKShare）。

## 1. 架构拓扑 (Architecture)

```
Browser / React Frontend
       │
       ▼ (HTTPS)
Cloudflare TypeScript Worker (唯一对外公开 Gateway)
       │
       ▼ (Private HTTP / Bearer Auth: QUANT_SERVICE_TOKEN)
Python Quant Service (FastAPI Microservice)
       │
       ▼ (HTTP / Web Scraping)
AKShare (EastMoney / 上游金融数据源)
```

## 2. 环境与依赖要求

- Python 3.12 (严格通过 `.python-version` 锁定)
- 依赖项见 `requirements.txt`：
  - `fastapi`
  - `uvicorn[standard]`
  - `akshare`
  - `pandas`
  - `pydantic`
  - `httpx`

## 3. 核心 API 规范

### 3.1 健康检查 (探针)
- `GET /health` (无需认证)
- 返回服务状态、AKShare 实际加载版本与时间戳。

### 3.2 A 股全市场实时行情
- `GET /v1/market/cn/spot?symbols=600519,000001&full_market=false`
- 鉴权头：`Authorization: Bearer <QUANT_SERVICE_TOKEN>`
- 内存缓存 TTL: 20 秒
- 字段标准化：`symbol`（6位前导零）、`exchange`（SH/SZ/BJ）、`last`、`change_pct`、`volume`、`turnover` 等。

### 3.3 A 股标的历史日K线
- `GET /v1/market/cn/stocks/{symbol}/history?start=YYYYMMDD&end=YYYYMMDD&adjust=none`
- 鉴权头：`Authorization: Bearer <QUANT_SERVICE_TOKEN>`
- 内存缓存 TTL: 30 分钟
- 严格校验：`symbol` 必须为6位数字，`adjust` 仅支持 `none` / `qfq` / `hfq`。

## 4. 本地启动指南

```bash
cd quant-service
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
