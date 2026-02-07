export type RoleName = 'admin' | 'operator' | 'service' | 'viewer';

export interface User {
  id: string; email: string; first_name: string; last_name: string;
  is_active: boolean; last_login: string | null; roles: RoleName[];
  created_at: string; updated_at: string;
}

export type TowerStatus = 'active' | 'offline' | 'maintenance' | 'decommissioned';

export interface Tower {
  id: string; serial_number: string; name: string; description: string | null;
  address_street: string | null; address_city: string | null; address_zip: string | null; address_country: string;
  latitude: number | null; longitude: number | null; status: TowerStatus;
  config: Record<string, unknown>; commissioned_at: string | null; decommissioned_at: string | null;
  created_at: string; updated_at: string;
}

export interface TowerStatusHistory {
  id: string; tower_id: string; old_status: TowerStatus | null; new_status: TowerStatus;
  reason: string | null; first_name?: string; last_name?: string; changed_at: string;
}

export interface TowerWithHistory extends Tower {
  statusHistory: TowerStatusHistory[];
  tickets: ServiceTicket[];
  documents: Document[];
}

export type TicketType = 'maintenance' | 'incident' | 'inspection';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

export interface ServiceTicket {
  id: string; tower_id: string; ticket_number: string; title: string; description: string | null;
  ticket_type: TicketType; priority: TicketPriority; status: TicketStatus;
  assigned_to: string | null; assigned_at: string | null;
  resolution: string | null; resolved_at: string | null; due_date: string | null;
  created_by: string | null; created_at: string; updated_at: string;
  tower_name?: string; tower_serial?: string; assigned_to_name?: string; created_by_name?: string;
}

export type DocumentType = 'manual' | 'certificate' | 'report' | 'image' | 'other';

export interface Document {
  id: string; tower_id: string | null; original_filename: string;
  mime_type: string; file_size: number; title: string | null; description: string | null;
  document_type: DocumentType | null; version: number; created_at: string; tower_name?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number; };
}

export interface TowerStats { total: number; byStatus: Record<string, number>; }
export interface TicketStats { total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; }
export interface AuthResponse { token: string; user: User; }
