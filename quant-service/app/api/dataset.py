from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import pandas as pd
import requests
import io
import json
import logging
import os
from typing import Optional, Dict, Any

router = APIRouter(prefix="/datasets", tags=["datasets"])
logger = logging.getLogger(__name__)

class ParseRequest(BaseModel):
    ds_id: str
    r2_key: str
    format: str # csv, xlsx, parquet
    worker_url: str
    worker_token: Optional[str] = None

class ParseResponse(BaseModel):
    success: bool
    row_count: int
    column_count: int
    preview_r2_key: str
    profile_r2_key: str
    parquet_r2_key: str
    columns: list
    error: Optional[str] = None

@router.post("/parse", response_model=ParseResponse)
def parse_dataset(req: ParseRequest):
    try:
        # Download from Worker R2 proxy
        headers = {}
        if req.worker_token:
            headers["Authorization"] = f"Bearer {req.worker_token}"
        
        file_url = f"{req.worker_url}/api/v1/datasets/internal/r2/{req.r2_key}"
        resp = requests.get(file_url, headers=headers)
        if resp.status_code != 200:
            raise Exception(f"Failed to fetch {req.r2_key} from worker: HTTP {resp.status_code}")

        file_content = resp.content
        
        # Load into Pandas
        if req.format.lower() == 'csv':
            df = pd.read_csv(io.BytesIO(file_content))
        elif req.format.lower() == 'xlsx' or req.format.lower() == 'xls':
            df = pd.read_excel(io.BytesIO(file_content))
        elif req.format.lower() == 'parquet':
            df = pd.read_parquet(io.BytesIO(file_content))
        elif req.format.lower() == 'json':
            df = pd.read_json(io.BytesIO(file_content))
        else:
            raise Exception(f"Unsupported format: {req.format}")

        row_count = len(df)
        column_count = len(df.columns)
        
        # Infer Schema
        columns = []
        for i, col in enumerate(df.columns):
            dtype = str(df[col].dtype)
            columns.append({
                "column_name": col,
                "data_type": dtype,
                "ordinal": i
            })

        # Generate Preview (first 100 rows)
        preview_df = df.head(100)
        # convert dates etc to string so it serializes
        preview_json = preview_df.to_dict(orient="records")
        for row in preview_json:
            for k, v in row.items():
                if pd.isna(v):
                    row[k] = None
                elif hasattr(v, "isoformat"):
                    row[k] = v.isoformat()

        # Generate Parquet buffer
        parquet_buf = io.BytesIO()
        df.to_parquet(parquet_buf, engine='pyarrow')
        parquet_buf.seek(0)

        # Upload back to R2
        base_path = "/".join(req.r2_key.split("/")[:-1])
        preview_key = f"{base_path}/preview.json"
        profile_key = f"{base_path}/profile.json"
        parquet_key = f"{base_path}/data.parquet"

        # PUT preview
        preview_url = f"{req.worker_url}/api/v1/datasets/internal/r2/{preview_key}"
        requests.put(preview_url, headers=headers, data=json.dumps(preview_json))

        # PUT parquet
        parquet_url = f"{req.worker_url}/api/v1/datasets/internal/r2/{parquet_key}"
        requests.put(parquet_url, headers=headers, data=parquet_buf.read())

        # For Profile we just write a dummy profile with counts for now
        profile = {
            "row_count": row_count,
            "column_count": column_count
        }
        profile_url = f"{req.worker_url}/api/v1/datasets/internal/r2/{profile_key}"
        requests.put(profile_url, headers=headers, data=json.dumps(profile))

        return ParseResponse(
            success=True,
            row_count=row_count,
            column_count=column_count,
            preview_r2_key=preview_key,
            profile_r2_key=profile_key,
            parquet_r2_key=parquet_key,
            columns=columns
        )

    except Exception as e:
        logger.exception("Parse failed")
        return ParseResponse(
            success=False,
            row_count=0,
            column_count=0,
            preview_r2_key="",
            profile_r2_key="",
            parquet_r2_key="",
            columns=[],
            error=str(e)
        )
