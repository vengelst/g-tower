-- G-Tower Seed Data
-- Logins: admin@gtower.local/admin123, operator@gtower.local/operator123, service@gtower.local/service123, viewer@gtower.local/viewer123

INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin@gtower.local',    '$2a$10$ajAJ3eQUI0rcaK58WCOhXeEBHW7ZZagITYttOkV6tA7ECMcHTj8RS', 'System', 'Administrator'),
    ('a0000000-0000-0000-0000-000000000002', 'operator@gtower.local', '$2a$10$bu6VFkG7vtBO4pnjc3jsvuD4jsaHnSJ/WnScrpY/kK3XsHiChecKO', 'Max', 'Operator'),
    ('a0000000-0000-0000-0000-000000000003', 'service@gtower.local',  '$2a$10$oTA0I6ldugXAAZsXxbtuhuOTdkXEqXDp7HhPvK01O5DuzTI5PuFYW', 'Anna', 'Service'),
    ('a0000000-0000-0000-0000-000000000004', 'viewer@gtower.local',   '$2a$10$IUvNENS2DLoxYhTEsKsfTO5cdE/vZowI5D7QbOOKhwr2XGmzlSw0C', 'Klaus', 'Viewer');

INSERT INTO user_roles (user_id, role_id) VALUES
    ('a0000000-0000-0000-0000-000000000001', (SELECT id FROM roles WHERE name='admin')),
    ('a0000000-0000-0000-0000-000000000002', (SELECT id FROM roles WHERE name='operator')),
    ('a0000000-0000-0000-0000-000000000003', (SELECT id FROM roles WHERE name='service')),
    ('a0000000-0000-0000-0000-000000000004', (SELECT id FROM roles WHERE name='viewer'));

INSERT INTO towers (id, serial_number, name, address_city, address_zip, latitude, longitude, status, commissioned_at, created_by) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'GT-2024-001', 'Tower Berlin Mitte',     'Berlin',    '10115', 52.520008,  13.404954, 'active',      NOW(), 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000002', 'GT-2024-002', 'Tower Hamburg Hafen',     'Hamburg',   '20457', 53.545899,   9.966598, 'active',      NOW(), 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000003', 'GT-2024-003', 'Tower München Zentrum',   'München',   '80331', 48.137154,  11.576124, 'active',      NOW(), 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000004', 'GT-2024-004', 'Tower Frankfurt Main',    'Frankfurt', '60311', 50.110922,   8.682127, 'maintenance', NOW(), 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000005', 'GT-2024-005', 'Tower Köln Dom',          'Köln',      '50667', 50.941278,   6.958281, 'active',      NOW(), 'a0000000-0000-0000-0000-000000000001');

INSERT INTO tower_status_history (tower_id, new_status, reason, changed_by) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'active',      'Erstinbetriebnahme',                   'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000002', 'active',      'Erstinbetriebnahme',                   'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000003', 'active',      'Erstinbetriebnahme',                   'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000004', 'maintenance', 'Kameraausfall - Wartung erforderlich', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000005', 'active',      'Erstinbetriebnahme',                   'a0000000-0000-0000-0000-000000000001');

INSERT INTO service_tickets (tower_id, ticket_number, title, description, ticket_type, priority, status, assigned_to, assigned_at, created_by) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'TKT-DEMO001', 'Routinewartung Q1',   'Planmäßige Quartalswartung',                    'maintenance', 'medium', 'open',        NULL, NULL, 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000004', 'TKT-DEMO002', 'Kameraausfall Cam-3',  'Kamera 3 liefert kein Bild seit 03.02.',        'incident',    'high',   'in_progress', 'a0000000-0000-0000-0000-000000000003', NOW(), 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000002', 'TKT-DEMO003', 'Firmware-Update v2.5', 'Firmware-Update auf allen Sensoren durchführen', 'maintenance', 'low',    'closed',      NULL, NULL, 'a0000000-0000-0000-0000-000000000001');

UPDATE service_tickets SET resolution='Update erfolgreich durchgeführt', resolved_at=NOW() WHERE ticket_number='TKT-DEMO003';
