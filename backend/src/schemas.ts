import { z } from 'zod';

// ── Shared ──────────────────────────────────────────────
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID');
const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).passthrough();

const idParams = z.object({ id: uuid });

// ── Auth ────────────────────────────────────────────────
export const loginBody = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort erforderlich'),
});

// ── Towers ──────────────────────────────────────────────
const towerStatus = z.enum(['active', 'offline', 'maintenance', 'decommissioned']);

export const towerListQuery = paginationQuery.extend({
  status: towerStatus.optional(),
  search: z.string().optional(),
  city: z.string().optional(),
  mode: z.enum(['map']).optional(),
});

export const createTowerBody = z.object({
  serialNumber: z.string().min(1, 'Seriennummer erforderlich'),
  name: z.string().min(1, 'Name erforderlich'),
  description: z.string().nullish(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const updateTowerBody = createTowerBody.partial();

export const updateTowerStatusBody = z.object({
  status: towerStatus,
  reason: z.string().optional(),
});

// ── Tickets ─────────────────────────────────────────────
const ticketType = z.enum(['maintenance', 'incident', 'inspection']);
const ticketPriority = z.enum(['low', 'medium', 'high', 'critical']);
const ticketStatus = z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed']);

export const ticketListQuery = paginationQuery.extend({
  towerId: uuid.optional(),
  status: ticketStatus.optional(),
  type: ticketType.optional(),
  priority: ticketPriority.optional(),
  assignedTo: uuid.optional(),
});

export const createTicketBody = z.object({
  towerId: uuid,
  title: z.string().min(1, 'Titel erforderlich'),
  description: z.string().nullish(),
  ticketType: ticketType.default('maintenance'),
  priority: ticketPriority.default('medium'),
  assignedTo: uuid.nullish(),
  dueDate: z.string().datetime().nullish(),
});

export const updateTicketBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullish(),
  ticketType: ticketType.optional(),
  priority: ticketPriority.optional(),
  status: ticketStatus.optional(),
  resolution: z.string().nullish(),
  dueDate: z.string().datetime().nullish(),
});

export const assignTicketBody = z.object({
  assignedTo: uuid,
});

// ── Users ───────────────────────────────────────────────
const roleName = z.enum(['admin', 'operator', 'service', 'viewer']);

export const createUserBody = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen lang sein'),
  firstName: z.string().min(1, 'Vorname erforderlich'),
  lastName: z.string().min(1, 'Nachname erforderlich'),
  roles: z.array(roleName).min(1).default(['viewer']),
});

export const updateUserBody = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  roles: z.array(roleName).min(1).optional(),
});

// ── Documents ───────────────────────────────────────────
const documentType = z.enum(['manual', 'certificate', 'report', 'image', 'other']);

export const documentListQuery = paginationQuery.extend({
  towerId: uuid.optional(),
  type: documentType.optional(),
});

export const uploadDocumentBody = z.object({
  towerId: uuid.optional().or(z.literal('')),
  title: z.string().optional(),
  description: z.string().optional(),
  documentType: documentType.default('other'),
});

// ── Re-exports ──────────────────────────────────────────
export { paginationQuery, idParams };
