"""
Snapshot Service
Provides snapshot generation, schema validation, and quality assurance
for the Penguin Quant Market Pipeline.
"""
import logging
from typing import Dict, Any, Tuple
from app.providers.data_source_manager import data_source_manager
from app.core.config import settings

logger = logging.getLogger("snapshot_service")

class SnapshotValidationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

class SnapshotService:
    def __init__(self):
        self.dsm = data_source_manager

    def build_internal_snapshot(self) -> Dict[str, Any]:
        """
        Fetches full market quotes, indices, and overview.
        Validates minimum stock count and integrity constraints.
        """
        snapshot = self.dsm.fetch_full_spot_snapshot()
        stocks = snapshot.get("stocks", [])
        stock_count = len(stocks)
        min_count = settings.MARKET_MIN_STOCK_COUNT

        if stock_count < min_count:
            logger.error(
                "Snapshot incomplete: stock_count=%d is less than minimum required=%d",
                stock_count, min_count
            )
            raise SnapshotValidationError(
                code="SNAPSHOT_INCOMPLETE",
                message=f"全市场行情快照数据不完整 (获取 {stock_count} 条，要求至少 {min_count} 条)"
            )

        logger.info(
            "Internal Market Snapshot built successfully: %d stocks, %d indices, provider=%s",
            stock_count, len(snapshot.get("indices", [])), snapshot.get("provider")
        )
        return snapshot

snapshot_service = SnapshotService()
