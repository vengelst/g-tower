import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import dotenv from 'dotenv';

// Für lokale Ausführung: versucht .env aus dem Repo-Root zu laden (Docker setzt ENV i.d.R. bereits).
for (const p of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '..', '.env')]) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? 'admin@gtower.local';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? 'admin123';
const TOWER_ID = process.env.SMOKE_TOWER_ID ?? 'b0000000-0000-0000-0000-000000000001';

let token: string;

// 1x1 transparent PNG
const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/azG8QAAAABJRU5ErkJggg==';

describe('Document upload/download integration (local storage)', () => {
  before(async () => {
    const res = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    assert.equal(res.status, 200);
    assert.equal(typeof res.body?.token, 'string');
    token = res.body.token;
  });

  it('upload -> metadata -> download returns bytes', async () => {
    const uploadRes = await request(BASE_URL)
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('towerId', TOWER_ID)
      .field('title', 'Smoke Upload')
      .attach('file', Buffer.from(PNG_1x1_BASE64, 'base64'), { filename: 'smoke.png', contentType: 'image/png' });

    assert.equal(uploadRes.status, 201);
    assert.equal(typeof uploadRes.body?.id, 'string');
    assert.equal(uploadRes.body.tower_id, TOWER_ID);
    assert.equal(uploadRes.body.mime_type, 'image/png');

    const docId = uploadRes.body.id as string;

    const dlRes = await request(BASE_URL)
      .get(`/api/documents/${docId}/download`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    assert.equal(dlRes.status, 200);
    assert.ok(String(dlRes.headers['content-type']).includes('image/png'));
    assert.ok(Buffer.isBuffer(dlRes.body));
    assert.ok((dlRes.body as Buffer).length > 10);
  });
});

