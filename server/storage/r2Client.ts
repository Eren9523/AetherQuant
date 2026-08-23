import fs from 'fs';
import path from 'path';
import { d1Client } from '../db/d1Client';

/**
 * Cloudflare R2 Client & Storage Cost Guard
 * Strictly enforces Rule 15-25:
 * - 8GB System Safe Limit
 * - 4-Tier System Storage States: NORMAL, WARNING, RESTRICTED, READ_ONLY
 * - Lifecycle expiration management
 * - Presigned URL and upload verification
 */

export type StorageState = 'NORMAL' | 'WARNING' | 'RESTRICTED' | 'READ_ONLY';

export interface StorageObjectMetadata {
  id: string;
  objectKey: string;
  ownerId: string;
  category: 'market' | 'uploads' | 'datasets' | 'documents' | 'backtests' | 'models' | 'system';
  sizeBytes: number;
  contentType: string;
  isPermanent: boolean;
  createdAt: string;
  expiresAt?: string;
}

export class R2StorageClient {
  public static readonly SAFE_LIMIT_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB (Rule 15)
  public static readonly WARNING_THRESHOLD_BYTES = 6 * 1024 * 1024 * 1024; // 6 GB
  public static readonly RESTRICTED_THRESHOLD_BYTES = 7 * 1024 * 1024 * 1024; // 7 GB

  private storageDir: string;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || 'penguinquant-storage';
    this.storageDir = path.join(process.cwd(), '.data', 'r2_storage');
    this.initStorage();
  }

  private initStorage() {
    if (!fs.existsSync(this.storageDir)) {
      try {
        fs.mkdirSync(this.storageDir, { recursive: true });
      } catch (e) {
        console.error('Failed to create local R2 storage directory:', e);
      }
    }
  }

  public async getStorageState(): Promise<{
    state: StorageState;
    totalSizeBytes: number;
    safeLimitBytes: number;
    usedPercentage: number;
    objectCount: number;
  }> {
    const objects = d1Client.getTable<StorageObjectMetadata>('storage_objects');
    const totalBytes = objects.reduce((sum, obj) => sum + (obj.sizeBytes || 0), 0);
    const objectCount = objects.length;
    const usedPercentage = Number(((totalBytes / R2StorageClient.SAFE_LIMIT_BYTES) * 100).toFixed(2));

    let state: StorageState = 'NORMAL';
    if (totalBytes >= R2StorageClient.SAFE_LIMIT_BYTES) {
      state = 'READ_ONLY';
    } else if (totalBytes >= R2StorageClient.RESTRICTED_THRESHOLD_BYTES) {
      state = 'RESTRICTED';
    } else if (totalBytes >= R2StorageClient.WARNING_THRESHOLD_BYTES) {
      state = 'WARNING';
    }

    return {
      state,
      totalSizeBytes: totalBytes,
      safeLimitBytes: R2StorageClient.SAFE_LIMIT_BYTES,
      usedPercentage,
      objectCount,
    };
  }

  public async createPresignedUploadUrl(params: {
    ownerId: string;
    filename: string;
    sizeBytes: number;
    contentType: string;
    category: StorageObjectMetadata['category'];
    isPermanent?: boolean;
  }) {
    const { state } = await this.getStorageState();

    // Circuit Breakers (Rules 16 & 17)
    if (state === 'READ_ONLY') {
      throw new Error('STORAGE_QUOTA_EXCEEDED: 系统存储已达 8GB 安全上限，处于只读模式');
    }

    if (state === 'RESTRICTED' && !params.isPermanent) {
      throw new Error('STORAGE_RESTRICTED: 系统存储空间紧张 (>7GB)，已暂停临时上传');
    }

    // User Upload Constraints (Rule 18: Max 10MB per file)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (params.sizeBytes > MAX_FILE_SIZE) {
      throw new Error(`FILE_TOO_LARGE: 单文件大小不得超过 10MB (当前 ${Math.round(params.sizeBytes / 1024 / 1024)}MB)`);
    }

    const ext = path.extname(params.filename).toLowerCase();
    const allowedExts = ['.csv', '.xlsx', '.xls', '.pdf', '.docx', '.txt', '.parquet', '.json'];
    if (!allowedExts.includes(ext)) {
      throw new Error(`INVALID_FILE_TYPE: 不支持的文件格式 ${ext}。仅支持 CSV, Excel, PDF, Word, TXT, Parquet`);
    }

    const objectId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const sanitizedName = path.basename(params.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `${params.category}/${params.ownerId}/${objectId}_${sanitizedName}`;

    // Retention Days (Rule 19)
    let retentionDays = 7;
    if (params.category === 'uploads') retentionDays = 7;
    else if (params.category === 'backtests') retentionDays = 14;
    else if (params.category === 'documents') retentionDays = 30;
    else if (params.isPermanent) retentionDays = 3650;

    const expiresAt = new Date(Date.now() + retentionDays * 24 * 3600 * 1000).toISOString();

    // Register storage metadata record
    const metaRecord: StorageObjectMetadata = {
      id: objectId,
      objectKey,
      ownerId: params.ownerId,
      category: params.category,
      sizeBytes: params.sizeBytes,
      contentType: params.contentType,
      isPermanent: Boolean(params.isPermanent),
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    d1Client.insertRecord('storage_objects', metaRecord);

    return {
      objectId,
      objectKey,
      uploadUrl: `/api/v1/uploads/direct?key=${encodeURIComponent(objectKey)}`,
      expiresAt,
      category: params.category,
    };
  }

  public async saveObject(objectKey: string, buffer: Buffer, meta: Partial<StorageObjectMetadata>) {
    const filePath = path.join(this.storageDir, objectKey.replace(/\//g, '_'));
    fs.writeFileSync(filePath, buffer);

    const existing = d1Client.getTable<StorageObjectMetadata>('storage_objects').find((o) => o.objectKey === objectKey);
    if (!existing) {
      d1Client.insertRecord('storage_objects', {
        id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        objectKey,
        ownerId: meta.ownerId || 'system',
        category: meta.category || 'system',
        sizeBytes: buffer.length,
        contentType: meta.contentType || 'application/octet-stream',
        isPermanent: meta.isPermanent || false,
        createdAt: new Date().toISOString(),
        expiresAt: meta.expiresAt,
      });
    }
  }

  public async getObject(objectKey: string): Promise<Buffer | null> {
    const filePath = path.join(this.storageDir, objectKey.replace(/\//g, '_'));
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    return null;
  }

  public async deleteObject(objectKey: string): Promise<boolean> {
    const filePath = path.join(this.storageDir, objectKey.replace(/\//g, '_'));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }
    const objects = d1Client.getTable<StorageObjectMetadata>('storage_objects');
    const match = objects.find((o) => o.objectKey === objectKey);
    if (match) {
      d1Client.deleteRecord('storage_objects', match.id);
    }
    return true;
  }

  public async runStorageReconciliation() {
    // Rule 23: Reconcile D1 storage_objects and cleanup expired files
    const now = new Date().toISOString();
    const objects = d1Client.getTable<StorageObjectMetadata>('storage_objects');
    let cleanedCount = 0;
    let freedBytes = 0;

    for (const obj of objects) {
      if (obj.expiresAt && obj.expiresAt < now) {
        const filePath = path.join(this.storageDir, obj.objectKey.replace(/\//g, '_'));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        d1Client.deleteRecord('storage_objects', obj.id);
        cleanedCount++;
        freedBytes += obj.sizeBytes;
      }
    }

    return { cleanedCount, freedBytes };
  }
}

export const r2Client = new R2StorageClient();
