import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Versucht .env aus backend/ oder Repo-Root zu laden (für lokale Ausführung).
for (const p of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '..', '.env')]) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

import crypto from 'node:crypto';

type Args = {
  towers: number;
  documents: number;
  tickets: number;
  withHistory: boolean;
  withImages: boolean;
  dryRun: boolean;
  seed: string;
  batchSize: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    towers: 5000,
    documents: 3000,
    tickets: 3000,
    withHistory: false,
    withImages: false,
    dryRun: false,
    seed: 'demo',
    batchSize: 500,
  };

  for (const raw of argv) {
    if (raw === '--with-history') args.withHistory = true;
    else if (raw === '--with-images') args.withImages = true;
    else if (raw === '--dry-run') args.dryRun = true;
    else if (raw.startsWith('--towers=')) args.towers = Number(raw.split('=')[1]);
    else if (raw.startsWith('--documents=')) args.documents = Number(raw.split('=')[1]);
    else if (raw.startsWith('--tickets=')) args.tickets = Number(raw.split('=')[1]);
    else if (raw.startsWith('--seed=')) args.seed = raw.split('=')[1] || 'demo';
    else if (raw.startsWith('--batch=')) args.batchSize = Number(raw.split('=')[1]);
  }

  if (!Number.isFinite(args.towers) || args.towers < 0) throw new Error('--towers must be >= 0');
  if (!Number.isFinite(args.documents) || args.documents < 0) throw new Error('--documents must be >= 0');
  if (!Number.isFinite(args.tickets) || args.tickets < 0) throw new Error('--tickets must be >= 0');
  if (!Number.isFinite(args.batchSize) || args.batchSize < 1 || args.batchSize > 2000) throw new Error('--batch must be 1..2000');
  return args;
}

function u32FromSeed(seed: string): number {
  const h = crypto.createHash('sha256').update(seed).digest();
  return h.readUInt32LE(0);
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rand: () => number, items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rand() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.value;
  }
  return items[items.length - 1].value;
}

function deterministicUuid(seed: string, type: string, idx: number): string {
  const b = crypto.createHash('sha256').update(`${seed}:${type}:${idx}`).digest();
  const bytes = Buffer.from(b.subarray(0, 16));
  // RFC 4122 variant + version 4 bits (deterministisch, aber UUID-kompatibel)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type Country = {
  code: string;
  name: string;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  cities: string[];
};

const COUNTRIES: Country[] = [
  { code: 'DE', name: 'Deutschland', bbox: { minLat: 47.2, maxLat: 55.1, minLng: 5.9, maxLng: 15.0 }, cities: ['Berlin','Hamburg','München','Köln','Frankfurt','Stuttgart','Düsseldorf','Leipzig'] },
  { code: 'FR', name: 'Frankreich', bbox: { minLat: 42.3, maxLat: 51.1, minLng: -4.9, maxLng: 8.3 }, cities: ['Paris','Lyon','Marseille','Toulouse','Nantes','Lille','Bordeaux'] },
  { code: 'IT', name: 'Italien', bbox: { minLat: 36.6, maxLat: 47.1, minLng: 6.6, maxLng: 18.5 }, cities: ['Rom','Mailand','Neapel','Turin','Bologna','Florenz','Venedig'] },
  { code: 'ES', name: 'Spanien', bbox: { minLat: 36.0, maxLat: 43.8, minLng: -9.3, maxLng: 3.3 }, cities: ['Madrid','Barcelona','Valencia','Sevilla','Bilbao','Málaga'] },
  { code: 'NL', name: 'Niederlande', bbox: { minLat: 50.7, maxLat: 53.6, minLng: 3.3, maxLng: 7.2 }, cities: ['Amsterdam','Rotterdam','Den Haag','Utrecht','Eindhoven'] },
  { code: 'BE', name: 'Belgien', bbox: { minLat: 49.5, maxLat: 51.6, minLng: 2.5, maxLng: 6.4 }, cities: ['Brüssel','Antwerpen','Gent','Lüttich'] },
  { code: 'AT', name: 'Österreich', bbox: { minLat: 46.4, maxLat: 49.1, minLng: 9.5, maxLng: 17.2 }, cities: ['Wien','Graz','Linz','Salzburg','Innsbruck'] },
  { code: 'CH', name: 'Schweiz', bbox: { minLat: 45.8, maxLat: 47.8, minLng: 5.9, maxLng: 10.5 }, cities: ['Zürich','Genf','Basel','Bern','Lausanne'] },
  { code: 'PL', name: 'Polen', bbox: { minLat: 49.0, maxLat: 54.8, minLng: 14.1, maxLng: 24.2 }, cities: ['Warschau','Krakau','Danzig','Breslau','Poznań'] },
  { code: 'CZ', name: 'Tschechien', bbox: { minLat: 48.5, maxLat: 51.1, minLng: 12.1, maxLng: 18.9 }, cities: ['Prag','Brünn','Ostrau','Pilsen'] },
  { code: 'DK', name: 'Dänemark', bbox: { minLat: 54.5, maxLat: 57.8, minLng: 8.1, maxLng: 15.2 }, cities: ['Kopenhagen','Aarhus','Odense','Aalborg'] },
  { code: 'SE', name: 'Schweden', bbox: { minLat: 55.3, maxLat: 69.1, minLng: 11.1, maxLng: 24.2 }, cities: ['Stockholm','Göteborg','Malmö','Uppsala'] },
];

type TowerRow = {
  id: string;
  serial_number: string;
  name: string;
  description: string | null;
  address_street: string | null;
  address_city: string | null;
  address_zip: string | null;
  address_country: string;
  latitude: number;
  longitude: number;
  status: string;
  config: any;
  commissioned_at: string;
  decommissioned_at: string | null;
  lifecycle_status: string;
  created_by: string | null;
};

function randomCoord(rand: () => number, c: Country) {
  const lat = c.bbox.minLat + rand() * (c.bbox.maxLat - c.bbox.minLat);
  const lng = c.bbox.minLng + rand() * (c.bbox.maxLng - c.bbox.minLng);
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

function daysAgoIso(rand: () => number, minDays: number, maxDays: number) {
  const days = minDays + rand() * (maxDays - minDays);
  const ms = Date.now() - Math.floor(days * 24 * 60 * 60 * 1000);
  return new Date(ms).toISOString();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function insertBatch(client: any, table: string, cols: string[], rows: any[][]) {
  if (!rows.length) return;
  const values: any[] = [];
  const tuples: string[] = [];
  let p = 1;
  for (const r of rows) {
    const ph = r.map(() => `$${p++}`);
    tuples.push(`(${ph.join(',')})`);
    values.push(...r);
  }
  const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES ${tuples.join(',')}`;
  await client.query(sql, values);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rand = mulberry32(u32FromSeed(args.seed));

  console.log('[seed:demo] Starting');
  console.log(JSON.stringify({
    towers: args.towers,
    documents: args.documents,
    tickets: args.tickets,
    withHistory: args.withHistory,
    withImages: args.withImages,
    dryRun: args.dryRun,
    seed: args.seed,
    batch: args.batchSize,
  }, null, 2));

  if (args.dryRun) {
    console.log(`[seed:demo] DRY-RUN: would insert towers=${args.towers}`);
    console.log(`[seed:demo] DRY-RUN: would insert tickets=${args.tickets}, documents=${args.documents}, images=${args.withImages ? 'per tower 1-4' : 0}`);
    console.log(`[seed:demo] DRY-RUN: withHistory=${args.withHistory}`);
    return;
  }

  // Dynamic imports after dotenv loaded (ESM import hoisting would otherwise initialize modules too early).
  const { query, getClient } = await import('../src/config/database.js');
  const { documentService } = await import('../src/services/documentService.js');

  const users = (await query('SELECT id, email FROM users ORDER BY created_at ASC')).rows as Array<{ id: string; email: string }>;
  if (!users.length) throw new Error('No users in DB. Please load dev seed data first (seed.sql).');
  const admin = users.find(u => u.email === 'admin@gtower.local') || users[0];

  const towerRows: TowerRow[] = [];

  const lifecycleDist = [
    { value: 'production', weight: 6 },
    { value: 'delivery', weight: 8 },
    { value: 'storage', weight: 18 },
    { value: 'rented', weight: 42 },
    { value: 'return_delivery', weight: 6 },
    { value: 'repair', weight: 8 },
    { value: 'reconditioning', weight: 6 },
    { value: 'end_of_life', weight: 4 },
    { value: 'scrapped', weight: 2 },
  ] as const;

  const statusDist = [
    { value: 'active', weight: 68 },
    { value: 'warning', weight: 10 },
    { value: 'critical', weight: 4 },
    { value: 'offline', weight: 10 },
    { value: 'maintenance', weight: 6 },
    { value: 'decommissioned', weight: 2 },
  ] as const;

  for (let i = 0; i < args.towers; i++) {
    const id = deterministicUuid(args.seed, 'tower', i);
    const c = COUNTRIES[Math.floor(rand() * COUNTRIES.length)];
    const city = c.cities[Math.floor(rand() * c.cities.length)];
    const { lat, lng } = randomCoord(rand, c);
    const lifecycle = pickWeighted(rand, lifecycleDist as any);
    const status = pickWeighted(rand, statusDist as any);

    const serial = `GT-DEMO-${String(i + 1).padStart(6, '0')}`;
    const commissioned_at = daysAgoIso(rand, 30, 900);
    const decommissioned_at = lifecycle === 'scrapped' || status === 'decommissioned' ? daysAgoIso(rand, 1, 120) : null;

    towerRows.push({
      id,
      serial_number: serial,
      name: `Tower ${city} ${String(i + 1).padStart(4, '0')}`,
      description: null,
      address_street: null,
      address_city: city,
      address_zip: null,
      address_country: c.name,
      latitude: lat,
      longitude: lng,
      status,
      config: {},
      commissioned_at,
      decommissioned_at,
      lifecycle_status: lifecycle,
      created_by: admin.id,
    });
  }

  if (args.dryRun) {
    console.log(`[seed:demo] DRY-RUN: would insert towers=${towerRows.length}`);
    console.log(`[seed:demo] DRY-RUN: would insert tickets=${args.tickets}, documents=${args.documents}, images=${args.withImages ? 'per tower 1-4' : 0}`);
    console.log(`[seed:demo] DRY-RUN: withHistory=${args.withHistory}`);
    return;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    console.log(`[seed:demo] Inserting towers (${towerRows.length})...`);
    const towerChunks = chunk(towerRows, args.batchSize);
    for (let idx = 0; idx < towerChunks.length; idx++) {
      const part = towerChunks[idx];
      await insertBatch(client, 'towers', [
        'id','serial_number','name','description','address_street','address_city','address_zip','address_country',
        'latitude','longitude','status','config','commissioned_at','decommissioned_at','lifecycle_status','created_by',
      ], part.map(t => [
        t.id, t.serial_number, t.name, t.description, t.address_street, t.address_city, t.address_zip, t.address_country,
        t.latitude, t.longitude, t.status, JSON.stringify(t.config), t.commissioned_at, t.decommissioned_at, t.lifecycle_status, t.created_by,
      ]));
      if ((idx + 1) % Math.max(1, Math.floor(500 / args.batchSize)) === 0) {
        console.log(`[seed:demo]  towers batch ${idx + 1}/${towerChunks.length}`);
      }
    }

    // Tickets (Batch Insert, no service logic needed)
    if (args.tickets > 0) {
      console.log(`[seed:demo] Inserting tickets (${args.tickets})...`);
      const ticketRows: any[][] = [];
      const ticketCols = ['id','tower_id','ticket_number','title','description','ticket_type','priority','status','created_by','created_at','updated_at','resolved_at'];
      const ticketStatusDist = [
        { value: 'open', weight: 45 },
        { value: 'in_progress', weight: 35 },
        { value: 'closed', weight: 20 },
      ];
      const ticketTypeDist = [
        { value: 'maintenance', weight: 55 },
        { value: 'incident', weight: 30 },
        { value: 'inspection', weight: 15 },
      ];
      const priorityDist = [
        { value: 'low', weight: 20 },
        { value: 'medium', weight: 50 },
        { value: 'high', weight: 25 },
        { value: 'critical', weight: 5 },
      ];
      const titles = [
        'Antenne neu ausrichten',
        'Batterie-Check erforderlich',
        'Stromversorgung instabil',
        'Gehäuseprüfung nach Sturm',
        'Signalqualität prüfen',
        'Firmware-Update planen',
        'Kabelverbindung kontrollieren',
      ];

      for (let i = 0; i < args.tickets; i++) {
        const id = deterministicUuid(args.seed, 'ticket', i);
        const tower = towerRows[Math.floor(rand() * towerRows.length)];
        const st = pickWeighted(rand, ticketStatusDist as any);
        const tt = pickWeighted(rand, ticketTypeDist as any);
        const pr = pickWeighted(rand, priorityDist as any);
        const created_at = daysAgoIso(rand, 1, 180);
        const resolved_at = st === 'closed' ? daysAgoIso(rand, 0, 60) : null;
        const ticketNumber = `DEMO-${String(i + 1).padStart(7, '0')}`;
        const title = titles[Math.floor(rand() * titles.length)];
        const desc = st === 'closed'
          ? 'Ticket abgeschlossen; Ergebnis dokumentiert.'
          : st === 'in_progress'
            ? 'Bearbeitung läuft; nächste Schritte geplant.'
            : 'Neu gemeldet; erste Analyse steht aus.';

        ticketRows.push([id, tower.id, ticketNumber, title, desc, tt, pr, st, admin.id, created_at, created_at, resolved_at]);
      }

      for (const part of chunk(ticketRows, args.batchSize)) {
        await insertBatch(client, 'service_tickets', ticketCols, part);
      }
    }

    if (args.withHistory) {
      console.log('[seed:demo] Inserting history (status + lifecycle)...');

      const statusCols = ['tower_id','old_status','new_status','reason','changed_by','source','changed_at'];
      const lifecycleCols = ['tower_id','old_status','new_status','reason','changed_by','source','changed_at'];

      const statusRows: any[][] = [];
      const lifecycleRows: any[][] = [];

      const allowedLifecycle: Record<string, string[]> = {
        production: ['delivery'],
        delivery: ['storage', 'rented'],
        storage: ['rented'],
        rented: ['return_delivery', 'repair'],
        return_delivery: ['repair', 'reconditioning', 'end_of_life'],
        repair: ['reconditioning', 'end_of_life'],
        reconditioning: ['storage', 'rented', 'end_of_life'],
        end_of_life: ['scrapped'],
        scrapped: [],
      };

      for (let ti = 0; ti < towerRows.length; ti++) {
        const t = towerRows[ti];
        const statusEvents = 10 + Math.floor(rand() * 41); // 10..50
        const lifeEvents = 5 + Math.floor(rand() * 16); // 5..20

        // Status history
        let currentStatus = pickWeighted(rand, statusDist as any);
        let ts = Date.now() - (120 + Math.floor(rand() * 900)) * 24 * 60 * 60 * 1000; // 4..30 months ago
        for (let j = 0; j < statusEvents; j++) {
          const nextStatus = pickWeighted(rand, statusDist as any);
          const changedAt = new Date(ts).toISOString();
          statusRows.push([
            t.id,
            j === 0 ? null : currentStatus,
            nextStatus,
            nextStatus === 'maintenance' ? 'Wartung geplant' : nextStatus === 'offline' ? 'Kein Heartbeat' : null,
            rand() < 0.7 ? admin.id : null,
            rand() < 0.6 ? 'manual' : 'system',
            changedAt,
          ]);
          currentStatus = nextStatus;
          ts += (2 + Math.floor(rand() * 20)) * 24 * 60 * 60 * 1000;
          if (ts > Date.now()) ts = Date.now() - Math.floor(rand() * 3) * 24 * 60 * 60 * 1000;
        }

        // Lifecycle history
        let currentLife = 'production';
        let lt = Date.now() - (200 + Math.floor(rand() * 1200)) * 24 * 60 * 60 * 1000;
        for (let j = 0; j < lifeEvents; j++) {
          const allowed = allowedLifecycle[currentLife] || [];
          const next = allowed.length ? allowed[Math.floor(rand() * allowed.length)] : currentLife;
          const changedAt = new Date(lt).toISOString();
          lifecycleRows.push([
            t.id,
            j === 0 ? null : currentLife,
            next,
            next === 'scrapped' ? 'End of Life' : null,
            admin.id,
            'manual',
            changedAt,
          ]);
          currentLife = next;
          lt += (7 + Math.floor(rand() * 45)) * 24 * 60 * 60 * 1000;
          if (currentLife === 'scrapped') break;
          if (lt > Date.now()) lt = Date.now() - Math.floor(rand() * 5) * 24 * 60 * 60 * 1000;
        }
      }

      console.log(`[seed:demo]  status history rows=${statusRows.length}`);
      for (const part of chunk(statusRows, 1000)) await insertBatch(client, 'tower_status_history', statusCols, part);

      console.log(`[seed:demo]  lifecycle history rows=${lifecycleRows.length}`);
      for (const part of chunk(lifecycleRows, 1000)) await insertBatch(client, 'tower_lifecycle_history', lifecycleCols, part);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Documents + images: use existing documentService (storage + DB)
  if (args.documents > 0 || args.withImages) {
    console.log('[seed:demo] Creating documents/images via documentService (storage writes)...');
  }

  const docTypes = ['report', 'manual', 'other'] as const;
  const docNames = ['Prüfbericht', 'Protokoll', 'Messbericht', 'Wartungsnotiz', 'Standortbericht'];

  async function withConcurrency<T>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<void>) {
    let i = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        await fn(items[idx], idx);
      }
    });
    await Promise.all(workers);
  }

  if (args.documents > 0) {
    const docJobs = Array.from({ length: args.documents }, (_, i) => i);
    await withConcurrency(docJobs, 8, async (_n, i) => {
      const tower = towerRows[Math.floor(rand() * towerRows.length)];
      const size = 10_000 + Math.floor(rand() * 70_000); // <100KB
      const header = Buffer.from('%PDF-1.4\n% Demo\n');
      const body = Buffer.alloc(Math.max(0, size - header.length), 0x20);
      const buf = Buffer.concat([header, body]);

      const title = `${docNames[Math.floor(rand() * docNames.length)]} ${String(i + 1).padStart(5, '0')}`;
      const documentType = docTypes[Math.floor(rand() * docTypes.length)];

      // Express.Multer.File minimal (buffer wird von create() genutzt)
      const f = {
        fieldname: 'file',
        originalname: `demo-${String(i + 1).padStart(5, '0')}.pdf`,
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: buf.length,
        buffer: buf,
        destination: '',
        filename: '',
        path: '',
        stream: undefined as any,
      } as any;

      await documentService.create(f, { towerId: tower.id, title, description: null as any, documentType }, admin.id);
      if ((i + 1) % 500 === 0) console.log(`[seed:demo]  documents ${i + 1}/${args.documents}`);
    });
  }

  if (args.withImages) {
    // 1–4 Bilder pro Tower
    const jobs: Array<{ towerId: string; idx: number; total: number }> = [];
    let total = 0;
    for (const t of towerRows) total += 1 + Math.floor(rand() * 4);
    let cursor = 0;
    for (const t of towerRows) {
      const n = 1 + Math.floor(rand() * 4);
      for (let j = 0; j < n; j++) jobs.push({ towerId: t.id, idx: cursor++, total });
    }

    // Kleines gültiges JPG (Startgröße), Thumbnail wird im documentService best-effort erzeugt.
    // Hier genügt ein minimales, gültiges JPEG (keine echten Fotos).
    const jpegStub = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEA8QFQ8QDw8QDw8PEA8QFREWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGi0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAEAAQAMBIgACEQEDEQH/xAAZAAEAAwEBAAAAAAAAAAAAAAAABQYHBAH/xAAtEAACAQMDAwMDBQEAAAAAAAAAAQIDBBEABRIhMQYTQVEHFCJhcYGRocH/xAAYAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/EAB8RAQEBAAIDAQEAAAAAAAAAAAABEQIhMQMSQVEiUf/aAAwDAQACEQMRAD8A3tKpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlSpUqVKlf/2Q==',
      'base64',
    );

    await withConcurrency(jobs, 6, async (job) => {
      const pad = Buffer.alloc(50_000 + Math.floor(rand() * 50_000), 0x00); // 50–100KB (Pseudo-Padding)
      const buf = Buffer.concat([jpegStub, pad]);

      const f = {
        fieldname: 'file',
        originalname: `image-${String(job.idx + 1).padStart(6, '0')}.jpg`,
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: buf.length,
        buffer: buf,
        destination: '',
        filename: '',
        path: '',
        stream: undefined as any,
      } as any;

      await documentService.create(f, { towerId: job.towerId, title: 'Tower Foto', description: null as any, documentType: 'image' }, admin.id);
      if ((job.idx + 1) % 500 === 0) console.log(`[seed:demo]  images ${job.idx + 1}/${job.total}`);
    });
  }

  console.log('[seed:demo] Done');
}

main().catch((e) => {
  console.error('[seed:demo] FAILED:', e);
  process.exit(1);
});
