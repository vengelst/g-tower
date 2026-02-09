import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import dotenv from 'dotenv';

/**
 * Smoke-Tests: "API lebt oder ist tot" für die CRITICAL-Routen.
 *
 * Voraussetzungen:
 * - Datenbank ist erreichbar (DATABASE_URL gesetzt)
 * - Seed-Daten sind geladen (mind. admin user + 1 Tower)
 *
 * Seed Defaults (backend/seed.sql):
 * - admin@gtower.local / admin123
 * - Beispiel-Tower: b0000000-0000-0000-0000-000000000001
 */

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
let loginResponseBody: any;

describe('CRITICAL API Smoke Tests', () => {
  before(async () => {
    const res = await request(BASE_URL)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    assert.equal(res.status, 200);
    assert.ok(res.body && typeof res.body === 'object');
    assert.equal(typeof res.body.token, 'string');
    assert.ok(res.body.token.length > 10);

    token = res.body.token;
    loginResponseBody = res.body;
  });

  it('POST /api/auth/login returns token + user', () => {
    assert.equal(typeof loginResponseBody.token, 'string');
    assert.ok(loginResponseBody.user && typeof loginResponseBody.user === 'object');
    assert.equal(loginResponseBody.user.email, ADMIN_EMAIL);
  });

  it('GET /api/auth/me returns current user', async () => {
    const res = await request(BASE_URL)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.ok(res.body && typeof res.body === 'object');
    assert.equal(res.body.email, ADMIN_EMAIL);
    assert.ok(typeof res.body.id === 'string');
  });

  it('GET /api/towers returns paginated list', async () => {
    const res = await request(BASE_URL)
      .get('/api/towers?limit=1&page=1')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.ok(res.body && typeof res.body === 'object');
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.pagination && typeof res.body.pagination === 'object');
    assert.equal(typeof res.body.pagination.total, 'number');
  });

  it('GET /api/towers/:id returns tower detail', async () => {
    const res = await request(BASE_URL)
      .get(`/api/towers/${TOWER_ID}`)
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.ok(res.body && typeof res.body === 'object');
    assert.equal(res.body.id, TOWER_ID);
    assert.equal(typeof res.body.serial_number, 'string');
    assert.equal(typeof res.body.status, 'string');
    assert.equal(typeof res.body.lifecycle_status, 'string');
  });
});
