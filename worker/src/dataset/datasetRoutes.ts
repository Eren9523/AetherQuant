import { Hono } from 'hono';
import { Bindings, Variables } from '../index';
import { STORAGE_POLICY, checkD1Budget } from '../storage/storagePolicy';

export function createDatasetRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // 1. Init Upload
  router.post('/init-upload', async (c) => {
    const reqId = c.get('requestId');
    const { name, filename, size_bytes, format, mime_type } = await c.req.json();
    const userId = c.get('authenticatedUserId') || 'guest';

    if (!c.env.DB || !c.env.DATA_BUCKET) {
      return c.json({ success: false, error: { code: 'INFRA_UNAVAILABLE', message: 'D1 or R2 missing' }, request_id: reqId }, 503);
    }

    if (size_bytes > STORAGE_POLICY.MAX_UPLOAD_SIZE_BYTES) {
      return c.json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 500MB limit' }, request_id: reqId }, 400);
    }

    const dsId = `ds_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const r2Key = `datasets/${userId}/${dsId}/${filename || 'data'}`;

    const metadataStr = JSON.stringify({ name, filename, size_bytes });
    try {
      checkD1Budget(metadataStr);
    } catch (e: any) {
      return c.json({ success: false, error: { code: 'D1_PAYLOAD_TOO_LARGE', message: e.message }, request_id: reqId }, 400);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `INSERT INTO datasets (id, user_id, name, filename, storage_type, format, mime_type, size_bytes, row_count, column_count, status, r2_key, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'uploading', ?, ?, ?)`
    ).bind(dsId, userId, name, filename || null, 'r2', format || null, mime_type || null, size_bytes || 0, r2Key, now, now).run();

    await c.env.DB.prepare(
      `INSERT INTO dataset_jobs (id, dataset_id, user_id, job_type, status, started_at) VALUES (?, ?, ?, 'upload', 'running', ?)`
    ).bind(`job_${Date.now()}`, dsId, userId, now).run();

    return c.json({
      success: true,
      data: {
        id: dsId,
        upload_url: null, // Client uses direct upload endpoint if presigned is complex, but we'll implement direct Worker upload.
      },
      request_id: reqId
    });
  });

  // 2. Direct Upload chunk/file
  router.post('/:id/upload', async (c) => {
    const reqId = c.get('requestId');
    const dsId = c.req.param('id');
    const userId = c.get('authenticatedUserId') || 'guest';

    if (!c.env.DB || !c.env.DATA_BUCKET) {
      return c.json({ success: false, error: { code: 'INFRA_UNAVAILABLE' }, request_id: reqId }, 503);
    }

    // Verify ownership
    const ds = await c.env.DB.prepare('SELECT * FROM datasets WHERE id = ? AND user_id = ?').bind(dsId, userId).first();
    if (!ds) {
      return c.json({ success: false, error: { code: 'NOT_FOUND' }, request_id: reqId }, 404);
    }

    const body = await c.req.parseBody();
    const file = body['file'];
    
    let arrayBuffer: ArrayBuffer;
    if (file instanceof File) {
      arrayBuffer = await file.arrayBuffer();
    } else {
      arrayBuffer = await c.req.arrayBuffer();
    }

    if (arrayBuffer.byteLength > STORAGE_POLICY.MAX_UPLOAD_SIZE_BYTES) {
      return c.json({ success: false, error: { code: 'FILE_TOO_LARGE' }, request_id: reqId }, 400);
    }

    await c.env.DATA_BUCKET.put(ds.r2_key as string, arrayBuffer);

    // Call Quant Service for Parsing (mocked call logic or real if accessible)
    // We'll update the dataset status for now, and try to call Quant Service if it's available.
    
    // Asynchronous parse trigger or sync parse. We'll do it sync for simplicity if it responds fast,
    // but better to just set status = 'uploaded' and let user see that, or call python service.
    
    try {
      const quantUrl = c.env.QUANT_SERVICE_URL;
      if (quantUrl) {
         await c.env.DB.prepare(`UPDATE datasets SET status = 'parsing' WHERE id = ?`).bind(dsId).run();
         
         const parseReq = {
           ds_id: dsId,
           r2_key: ds.r2_key,
           format: ds.format || (file as File).name.split('.').pop() || 'csv',
           worker_url: c.env.APP_ORIGIN || 'http://localhost:3000', // Need local if testing
           worker_token: c.env.QUANT_SERVICE_TOKEN
         };

         // Actually APP_ORIGIN might be localhost in dev. 
         const origin = c.env.APP_ORIGIN || c.req.url.split('/api')[0];
         parseReq.worker_url = origin;

         const resp = await fetch(`${quantUrl}/datasets/parse`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(parseReq)
         });

         const parseRes = await resp.json() as any;
         if (parseRes.success) {
           await c.env.DB.prepare(`
             UPDATE datasets SET 
               status = 'ready',
               row_count = ?,
               column_count = ?,
               preview_r2_key = ?,
               parsed_at = ?
             WHERE id = ?
           `).bind(
             parseRes.row_count, 
             parseRes.column_count, 
             parseRes.preview_r2_key,
             new Date().toISOString(),
             dsId
           ).run();

           // Insert columns
           for (const col of parseRes.columns) {
             await c.env.DB.prepare(`
               INSERT INTO dataset_columns (dataset_id, column_name, data_type, ordinal)
               VALUES (?, ?, ?, ?)
             `).bind(dsId, col.column_name, col.data_type, col.ordinal).run();
           }
         } else {
           await c.env.DB.prepare(`UPDATE datasets SET status = 'failed', error_message = ? WHERE id = ?`).bind(parseRes.error, dsId).run();
         }
      } else {
         await c.env.DB.prepare(`UPDATE datasets SET status = 'uploaded' WHERE id = ?`).bind(dsId).run();
      }
    } catch (e: any) {
      console.warn("Quant service trigger failed:", e);
      await c.env.DB.prepare(`UPDATE datasets SET status = 'failed', error_message = ? WHERE id = ?`).bind(e.message, dsId).run();
    }

    return c.json({
      success: true,
      data: { id: dsId, status: 'uploaded' },
      request_id: reqId
    });
  });

  // 3. List Datasets
  router.get('/', async (c) => {
    const reqId = c.get('requestId');
    const userId = c.get('authenticatedUserId') || 'guest';
    
    if (!c.env.DB) return c.json({ success: true, data: [] });

    const datasets = await c.env.DB.prepare('SELECT id, name, filename, format, status, row_count, column_count, size_bytes, created_at, parsed_at FROM datasets WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
    
    return c.json({
      success: true,
      data: datasets.results,
      request_id: reqId
    });
  });

  // 4. Get Dataset Details & Preview
  router.get('/:id', async (c) => {
    const reqId = c.get('requestId');
    const dsId = c.req.param('id');
    const userId = c.get('authenticatedUserId') || 'guest';

    if (!c.env.DB || !c.env.DATA_BUCKET) {
      return c.json({ success: false, error: { code: 'INFRA_UNAVAILABLE' } }, 503);
    }

    const ds = await c.env.DB.prepare('SELECT * FROM datasets WHERE id = ? AND user_id = ?').bind(dsId, userId).first();
    if (!ds) {
      return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404);
    }

    const columns = await c.env.DB.prepare('SELECT * FROM dataset_columns WHERE dataset_id = ? ORDER BY ordinal').bind(dsId).all();

    let preview = null;
    let profile = null;
    if (ds.preview_r2_key) {
      const p = await c.env.DATA_BUCKET.get(ds.preview_r2_key as string);
      if (p) {
        try { preview = await p.json(); } catch(e){}
      }
    }

    return c.json({
      success: true,
      data: {
        ...ds,
        columns: columns.results,
        preview,
        profile
      },
      request_id: reqId
    });
  });

  // 5. Delete
  router.delete('/:id', async (c) => {
    const reqId = c.get('requestId');
    const dsId = c.req.param('id');
    const userId = c.get('authenticatedUserId') || 'guest';

    if (!c.env.DB || !c.env.DATA_BUCKET) {
      return c.json({ success: false, error: { code: 'INFRA_UNAVAILABLE' } }, 503);
    }

    const ds = await c.env.DB.prepare('SELECT * FROM datasets WHERE id = ? AND user_id = ?').bind(dsId, userId).first();
    if (!ds) {
      return c.json({ success: false, error: { code: 'NOT_FOUND' } }, 404);
    }

    await c.env.DB.prepare(`UPDATE datasets SET status = 'deleting' WHERE id = ?`).bind(dsId).run();

    if (ds.r2_key) await c.env.DATA_BUCKET.delete(ds.r2_key as string);
    if (ds.preview_r2_key) await c.env.DATA_BUCKET.delete(ds.preview_r2_key as string);

    await c.env.DB.prepare(`DELETE FROM dataset_columns WHERE dataset_id = ?`).bind(dsId).run();
    await c.env.DB.prepare(`DELETE FROM dataset_jobs WHERE dataset_id = ?`).bind(dsId).run();
    await c.env.DB.prepare(`DELETE FROM datasets WHERE id = ?`).bind(dsId).run();

    return c.json({ success: true, request_id: reqId });
  });

  // 6. Internal endpoint for Quant Service to read/write R2
  router.get('/internal/r2/:key{.+}', async (c) => {
    // Basic auth check
    const auth = c.req.header('authorization');
    if (c.env.QUANT_SERVICE_TOKEN && auth !== `Bearer ${c.env.QUANT_SERVICE_TOKEN}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const key = c.req.param('key');
    const object = await c.env.DATA_BUCKET.get(key);
    if (object === null) {
      return new Response('Object Not Found', { status: 404 });
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    return new Response(object.body, { headers });
  });

  router.put('/internal/r2/:key{.+}', async (c) => {
    const auth = c.req.header('authorization');
    if (c.env.QUANT_SERVICE_TOKEN && auth !== `Bearer ${c.env.QUANT_SERVICE_TOKEN}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const key = c.req.param('key');
    await c.env.DATA_BUCKET.put(key, c.req.raw.body);
    return c.json({ success: true });
  });

  return router;
}
