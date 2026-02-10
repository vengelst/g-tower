-- =============================================================================
-- seed.sql – Testdaten für die Entwicklungsumgebung
-- =============================================================================
-- Zweck:         Befüllt die Datenbank mit realistischen Testdaten:
--                4 Benutzer (je Rolle einer), 50 Towers europaweit,
--                Status-Historien, Service-Tickets, Dokumente,
--                System-Check-Mockdaten und Lifecycle-Historien.
-- Rolle:         Wird NUR in der Entwicklungsumgebung geladen via
--                docker-compose.override.yml als 02_seed.sql
--                (nach 01_schema = init.sql).
-- Abhängigkeiten: init.sql muss vorher gelaufen sein (Tabellen + Rollen)
-- Wichtige Annahmen:
--   - DARF NIEMALS in Produktion verwendet werden (enthält Klartextpasswörter
--     als bcrypt-Hashes und deterministische UUIDs)
--   - UUIDs sind deterministisch gewählt (a0... für User, b0... für Towers,
--     d0... für Dokumente) für einfaches Debugging und Cross-Referencing
--   - Läuft nur bei jungfräulicher DB (docker-entrypoint-initdb.d-Mechanismus)
--   - Zusätzlich existiert backend/scripts/seed_500_towers.ts für 500 weitere
--     generierte Towers (separates Script, nicht Teil von seed.sql)
-- Änderungshinweise:
--   - Neue Seed-Daten am Ende der jeweiligen Sektion einfügen
--   - Bei Änderungen: docker compose down -v && docker compose up -d
-- =============================================================================

-- ========== BENUTZER ==========
-- Vier Testbenutzer, einer pro Rolle. Passwörter als bcrypt-Hashes.
-- Logins: admin@gtower.local/admin123, operator@gtower.local/operator123,
--         service@gtower.local/service123, viewer@gtower.local/viewer123
INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin@gtower.local',    '$2a$10$ajAJ3eQUI0rcaK58WCOhXeEBHW7ZZagITYttOkV6tA7ECMcHTj8RS', 'System', 'Administrator'),
    ('a0000000-0000-0000-0000-000000000002', 'operator@gtower.local', '$2a$10$bu6VFkG7vtBO4pnjc3jsvuD4jsaHnSJ/WnScrpY/kK3XsHiChecKO', 'Max', 'Operator'),
    ('a0000000-0000-0000-0000-000000000003', 'service@gtower.local',  '$2a$10$oTA0I6ldugXAAZsXxbtuhuOTdkXEqXDp7HhPvK01O5DuzTI5PuFYW', 'Anna', 'Service'),
    ('a0000000-0000-0000-0000-000000000004', 'viewer@gtower.local',   '$2a$10$IUvNENS2DLoxYhTEsKsfTO5cdE/vZowI5D7QbOOKhwr2XGmzlSw0C', 'Klaus', 'Viewer');

-- Rollenzuweisung: Jeder Benutzer bekommt genau eine Rolle
INSERT INTO user_roles (user_id, role_id) VALUES
    ('a0000000-0000-0000-0000-000000000001', (SELECT id FROM roles WHERE name='admin')),
    ('a0000000-0000-0000-0000-000000000002', (SELECT id FROM roles WHERE name='operator')),
    ('a0000000-0000-0000-0000-000000000003', (SELECT id FROM roles WHERE name='service')),
    ('a0000000-0000-0000-0000-000000000004', (SELECT id FROM roles WHERE name='viewer'));

-- ========== 50 TOWERS IN GANZ EUROPA ==========
-- 50 Türme verteilt über 15 Länder mit realen GPS-Koordinaten.
-- Status-Verteilung: ~33 active, 6 maintenance, 5 offline, 1 decommissioned
-- (warning/critical werden vom Scheduler basierend auf config-Werten gesetzt)
-- IDs: b0000000-...-000000000001 bis b0000000-...-000000000050
-- Seriennummern: GT-2024-001 bis GT-2024-050

-- Deutschland (10)
INSERT INTO towers (id, serial_number, name, address_street, address_city, address_zip, address_country, latitude, longitude, status, commissioned_at, created_by) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'GT-2024-001', 'Tower Berlin Mitte',        'Alexanderplatz 1',      'Berlin',      '10115', 'Deutschland', 52.520008, 13.404954, 'active',          '2024-01-15T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000002', 'GT-2024-002', 'Tower Hamburg Hafen',        'Hafenstraße 12',        'Hamburg',     '20457', 'Deutschland', 53.545899,  9.966598, 'active',          '2024-02-01T10:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000003', 'GT-2024-003', 'Tower München Zentrum',      'Marienplatz 5',         'München',     '80331', 'Deutschland', 48.137154, 11.576124, 'active',          '2024-02-20T09:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000004', 'GT-2024-004', 'Tower Frankfurt Main',       'Mainzer Landstr. 50',   'Frankfurt',   '60311', 'Deutschland', 50.110922,  8.682127, 'maintenance',     '2024-03-10T11:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000005', 'GT-2024-005', 'Tower Köln Dom',             'Domkloster 4',          'Köln',        '50667', 'Deutschland', 50.941278,  6.958281, 'active',          '2024-03-25T14:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000006', 'GT-2024-006', 'Tower Stuttgart Schloss',    'Schloßplatz 1',         'Stuttgart',   '70173', 'Deutschland', 48.778449,  9.180013, 'active',          '2024-04-05T08:30:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000007', 'GT-2024-007', 'Tower Düsseldorf Rhein',     'Rheinuferpromenade 1',  'Düsseldorf',  '40213', 'Deutschland', 51.227741,  6.773456, 'offline',         '2024-04-18T10:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000008', 'GT-2024-008', 'Tower Dresden Altstadt',     'Neumarkt 2',            'Dresden',     '01067', 'Deutschland', 51.049999, 13.737262, 'active',          '2024-05-02T09:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000009', 'GT-2024-009', 'Tower Leipzig Zentrum',      'Augustusplatz 10',      'Leipzig',     '04109', 'Deutschland', 51.340199, 12.360103, 'active',          '2024-05-15T07:30:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000010', 'GT-2024-010', 'Tower Nürnberg Burg',        'Burgstraße 13',         'Nürnberg',    '90403', 'Deutschland', 49.457420, 11.077420, 'decommissioned',  '2024-01-10T06:00:00Z', 'a0000000-0000-0000-0000-000000000001'),

-- Österreich (5)
    ('b0000000-0000-0000-0000-000000000011', 'GT-2024-011', 'Tower Wien Stephansplatz',   'Stephansplatz 1',       'Wien',        '1010',  'Österreich',  48.208174, 16.373819, 'active',          '2024-06-01T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000012', 'GT-2024-012', 'Tower Salzburg Altstadt',    'Getreidegasse 9',       'Salzburg',    '5020',  'Österreich',  47.800499, 13.043980, 'active',          '2024-06-15T10:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000013', 'GT-2024-013', 'Tower Graz Schlossberg',     'Schloßbergplatz 1',     'Graz',        '8010',  'Österreich',  47.076668, 15.421371, 'maintenance',     '2024-07-01T09:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000014', 'GT-2024-014', 'Tower Innsbruck Goldenes',   'Herzog-Friedrich-Str.', 'Innsbruck',   '6020',  'Österreich',  47.268700, 11.393522, 'active',          '2024-07-20T11:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000015', 'GT-2024-015', 'Tower Linz Hauptplatz',      'Hauptplatz 1',          'Linz',        '4020',  'Österreich',  48.306940, 14.285830, 'active',          '2024-08-01T08:30:00Z', 'a0000000-0000-0000-0000-000000000001'),

-- Schweiz (4)
    ('b0000000-0000-0000-0000-000000000016', 'GT-2024-016', 'Tower Zürich Bahnhof',       'Bahnhofstrasse 1',      'Zürich',      '8001',  'Schweiz',     47.376887,  8.541694, 'active',          '2024-08-15T10:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000017', 'GT-2024-017', 'Tower Bern Bundeshaus',      'Bundesplatz 3',         'Bern',        '3005',  'Schweiz',     46.946755,  7.444165, 'active',          '2024-09-01T09:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000018', 'GT-2024-018', 'Tower Genf Jet d''Eau',      'Quai Gustave-Ador',     'Genf',        '1207',  'Schweiz',     46.207340,  6.155220, 'offline',         '2024-09-20T11:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000019', 'GT-2024-019', 'Tower Basel Münster',        'Münsterplatz 9',        'Basel',       '4051',  'Schweiz',     47.556160,  7.592410, 'active',          '2024-10-01T08:00:00Z', 'a0000000-0000-0000-0000-000000000002'),

-- Frankreich (5)
    ('b0000000-0000-0000-0000-000000000020', 'GT-2024-020', 'Tower Paris Eiffel',         'Champ de Mars 5',       'Paris',       '75007', 'Frankreich',  48.858370,  2.294481, 'active',          '2024-03-01T10:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000021', 'GT-2024-021', 'Tower Lyon Bellecour',       'Place Bellecour',       'Lyon',        '69002', 'Frankreich',  45.757814,  4.832011, 'active',          '2024-04-01T09:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000022', 'GT-2024-022', 'Tower Marseille Hafen',      'Quai du Port 1',        'Marseille',   '13002', 'Frankreich',  43.296482,  5.369780, 'maintenance',     '2024-05-01T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000023', 'GT-2024-023', 'Tower Strasbourg Münster',   'Place de la Cathédrale', 'Strasbourg', '67000', 'Frankreich',  48.581940,  7.750990, 'active',          '2024-06-01T10:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000024', 'GT-2024-024', 'Tower Nizza Promenade',      'Promenade des Anglais',  'Nizza',      '06000', 'Frankreich',  43.695949,  7.265280, 'active',          '2024-07-01T11:00:00Z', 'a0000000-0000-0000-0000-000000000001'),

-- Niederlande (4)
    ('b0000000-0000-0000-0000-000000000025', 'GT-2024-025', 'Tower Amsterdam Centraal',   'Stationsplein 1',       'Amsterdam',   '1012',  'Niederlande', 52.378901,  4.900270, 'active',          '2024-03-15T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000026', 'GT-2024-026', 'Tower Rotterdam Hafen',      'Wilhelminakade 1',      'Rotterdam',   '3072',  'Niederlande', 51.905446,  4.486257, 'active',          '2024-04-10T09:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000027', 'GT-2024-027', 'Tower Den Haag Binnenhof',   'Binnenhof 1',           'Den Haag',    '2513',  'Niederlande', 52.079780,  4.313260, 'offline',         '2024-05-20T10:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000028', 'GT-2024-028', 'Tower Utrecht Dom',          'Domplein 9',            'Utrecht',     '3512',  'Niederlande', 52.090736,  5.121420, 'active',          '2024-06-10T08:30:00Z', 'a0000000-0000-0000-0000-000000000002'),

-- Belgien (3)
    ('b0000000-0000-0000-0000-000000000029', 'GT-2024-029', 'Tower Brüssel Grand-Place',  'Grand-Place 1',         'Brüssel',     '1000',  'Belgien',     50.846557,  4.352010, 'active',          '2024-04-20T09:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000030', 'GT-2024-030', 'Tower Antwerpen Hafen',      'Grote Markt 1',         'Antwerpen',   '2000',  'Belgien',     51.221100,  4.399708, 'active',          '2024-05-15T10:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000031', 'GT-2024-031', 'Tower Gent Belfried',        'Sint-Baafsplein 1',     'Gent',        '9000',  'Belgien',     51.053961,  3.725150, 'maintenance',     '2024-06-20T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),

-- Italien (4)
    ('b0000000-0000-0000-0000-000000000032', 'GT-2024-032', 'Tower Rom Kolosseum',        'Piazza del Colosseo 1', 'Rom',         '00184', 'Italien',     41.890210, 12.492231, 'active',          '2024-03-20T10:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000033', 'GT-2024-033', 'Tower Mailand Dom',          'Piazza del Duomo 1',    'Mailand',     '20122', 'Italien',     45.464204,  9.191916, 'active',          '2024-04-15T09:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000034', 'GT-2024-034', 'Tower Florenz Ponte Vecchio','Ponte Vecchio 1',       'Florenz',     '50125', 'Italien',     43.768060, 11.253120, 'offline',         '2024-05-10T11:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000035', 'GT-2024-035', 'Tower Venedig Markus',       'Piazza San Marco 1',    'Venedig',     '30124', 'Italien',     45.434336, 12.338784, 'active',          '2024-06-05T08:00:00Z', 'a0000000-0000-0000-0000-000000000002'),

-- Spanien (4)
    ('b0000000-0000-0000-0000-000000000036', 'GT-2024-036', 'Tower Madrid Sol',           'Puerta del Sol 1',      'Madrid',      '28013', 'Spanien',     40.416775, -3.703790, 'active',          '2024-04-01T10:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000037', 'GT-2024-037', 'Tower Barcelona Sagrada',    'Carrer de Mallorca 401','Barcelona',   '08013', 'Spanien',     41.403629,  2.174356, 'active',          '2024-05-01T09:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000038', 'GT-2024-038', 'Tower Sevilla Alcazar',      'Patio de Banderas 1',   'Sevilla',     '41004', 'Spanien',     37.383800, -5.990000, 'maintenance',     '2024-06-01T11:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000039', 'GT-2024-039', 'Tower Valencia Hafen',       'Paseo de la Alameda 1', 'Valencia',    '46023', 'Spanien',     39.469907, -0.376288, 'active',          '2024-07-15T08:00:00Z', 'a0000000-0000-0000-0000-000000000002'),

-- Skandinavien (4)
    ('b0000000-0000-0000-0000-000000000040', 'GT-2024-040', 'Tower Kopenhagen Nyhavn',    'Nyhavn 1',              'Kopenhagen',  '1051',  'Dänemark',    55.679565, 12.590359, 'active',          '2024-05-01T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000041', 'GT-2024-041', 'Tower Stockholm Gamla Stan', 'Stortorget 1',          'Stockholm',   '11129', 'Schweden',    59.325117, 18.070722, 'active',          '2024-06-01T09:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000042', 'GT-2024-042', 'Tower Oslo Opera',           'Kirsten Flagstads Pl.', 'Oslo',        '0150',  'Norwegen',    59.907350, 10.753280, 'offline',         '2024-07-01T10:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000043', 'GT-2024-043', 'Tower Helsinki Senatsplatz', 'Senaatintori 1',        'Helsinki',    '00170', 'Finnland',    60.169857, 24.952780, 'active',          '2024-08-01T08:30:00Z', 'a0000000-0000-0000-0000-000000000002'),

-- Osteuropa (4)
    ('b0000000-0000-0000-0000-000000000044', 'GT-2024-044', 'Tower Prag Altstadt',        'Staroměstské nám. 1',   'Prag',        '11000', 'Tschechien',  50.087465, 14.421252, 'active',          '2024-04-10T09:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000045', 'GT-2024-045', 'Tower Warschau Altstadt',    'Rynek Starego Miasta',  'Warschau',    '00-001','Polen',       52.249990, 21.012290, 'active',          '2024-05-20T10:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000046', 'GT-2024-046', 'Tower Budapest Burgviertel', 'Szent György tér 2',    'Budapest',    '1014',  'Ungarn',      47.496178, 19.039894, 'maintenance',     '2024-06-15T11:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000047', 'GT-2024-047', 'Tower Wien Prater',          'Prater 1',              'Wien',        '1020',  'Österreich',  48.216271, 16.395881, 'active',          '2024-07-10T08:00:00Z', 'a0000000-0000-0000-0000-000000000002'),

-- Weitere (3)
    ('b0000000-0000-0000-0000-000000000048', 'GT-2024-048', 'Tower Dublin Custom House',  'Custom House Quay',     'Dublin',      'D01',   'Irland',      53.347230, -6.251200, 'active',          '2024-08-10T09:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000049', 'GT-2024-049', 'Tower Lissabon Belém',       'Praça do Império',      'Lissabon',    '1400',  'Portugal',    38.697600, -9.206200, 'active',          '2024-09-01T10:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000050', 'GT-2024-050', 'Tower Athen Akropolis',      'Dionysiou Areopagitou', 'Athen',       '10558', 'Griechenland',37.971530, 23.725750, 'active',          '2024-09-15T11:00:00Z', 'a0000000-0000-0000-0000-000000000001');

-- ========== OPERATIVE STATUS-HISTORIE ==========
-- Jeder Tower hat mindestens einen Eintrag: die Erstinbetriebnahme (old_status=NULL).
-- Danach folgen Statuswechsel zu maintenance, offline und decommissioned.
-- source: 'manual' = Benutzer-Aktion, 'system' = automatische Erkennung
-- HINWEIS: Dies ist die OPERATIVE Status-Historie, nicht die Lifecycle-Historie!

INSERT INTO tower_status_history (tower_id, old_status, new_status, reason, changed_by, source, changed_at) VALUES
    -- Erstinbetriebnahme aller 50 Towers (old_status = NULL → erster Eintrag)
    ('b0000000-0000-0000-0000-000000000001', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-01-15T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000002', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-02-01T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000003', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-02-20T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000004', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-03-10T11:00:00Z'),
    ('b0000000-0000-0000-0000-000000000005', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-03-25T14:00:00Z'),
    ('b0000000-0000-0000-0000-000000000006', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-04-05T08:30:00Z'),
    ('b0000000-0000-0000-0000-000000000007', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-04-18T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000008', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-05-02T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000009', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-05-15T07:30:00Z'),
    ('b0000000-0000-0000-0000-000000000010', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-01-10T06:00:00Z'),
    ('b0000000-0000-0000-0000-000000000011', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-06-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000012', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-06-15T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000013', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-07-01T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000014', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-07-20T11:00:00Z'),
    ('b0000000-0000-0000-0000-000000000015', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-08-01T08:30:00Z'),
    ('b0000000-0000-0000-0000-000000000016', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-08-15T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000017', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-09-01T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000018', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-09-20T11:00:00Z'),
    ('b0000000-0000-0000-0000-000000000019', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-10-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000020', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-03-01T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000021', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-04-01T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000022', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-05-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000023', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-06-01T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000024', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-07-01T11:00:00Z'),
    ('b0000000-0000-0000-0000-000000000025', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-03-15T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000026', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-04-10T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000027', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-05-20T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000028', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-06-10T08:30:00Z'),
    ('b0000000-0000-0000-0000-000000000029', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-04-20T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000030', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-05-15T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000031', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-06-20T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000032', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-03-20T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000033', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-04-15T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000034', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-05-10T11:00:00Z'),
    ('b0000000-0000-0000-0000-000000000035', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-06-05T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000036', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-04-01T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000037', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-05-01T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000038', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-06-01T11:00:00Z'),
    ('b0000000-0000-0000-0000-000000000039', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-07-15T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000040', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-05-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000041', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-06-01T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000042', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-07-01T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000043', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-08-01T08:30:00Z'),
    ('b0000000-0000-0000-0000-000000000044', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-04-10T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000045', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-05-20T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000046', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-06-15T11:00:00Z'),
    ('b0000000-0000-0000-0000-000000000047', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-07-10T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000048', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-08-10T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000049', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000002', 'manual', '2024-09-01T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000050', NULL, 'active', 'Erstinbetriebnahme', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-09-15T11:00:00Z'),

    -- Statuswechsel: Towers die jetzt maintenance sind
    ('b0000000-0000-0000-0000-000000000004', 'active', 'maintenance', 'Kameraausfall - Wartung erforderlich',           'a0000000-0000-0000-0000-000000000001', 'manual',  '2024-11-05T14:20:00Z'),
    ('b0000000-0000-0000-0000-000000000013', 'active', 'maintenance', 'Sensoraustausch geplant',                        'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-12-01T09:15:00Z'),
    ('b0000000-0000-0000-0000-000000000022', 'active', 'maintenance', 'Korrosionsschäden am Mast, Inspektion nötig',     'a0000000-0000-0000-0000-000000000001', 'manual',  '2024-11-20T16:00:00Z'),
    ('b0000000-0000-0000-0000-000000000031', 'active', 'maintenance', 'Firmware-Update erforderlich, Vor-Ort-Eingriff',  'a0000000-0000-0000-0000-000000000002', 'manual',  '2024-12-10T10:30:00Z'),
    ('b0000000-0000-0000-0000-000000000038', 'active', 'maintenance', 'Stromversorgung instabil, Wechselrichter prüfen', 'a0000000-0000-0000-0000-000000000003', 'manual',  '2025-01-08T13:45:00Z'),
    ('b0000000-0000-0000-0000-000000000046', 'active', 'maintenance', 'Antennenjustierung nach Sturm',                  'a0000000-0000-0000-0000-000000000001', 'manual',  '2025-01-15T11:00:00Z'),

    -- Statuswechsel: Towers die jetzt offline sind
    ('b0000000-0000-0000-0000-000000000007', 'active', 'offline',     'Netzwerkausfall, Provider informiert',            'a0000000-0000-0000-0000-000000000001', 'system',  '2025-01-20T03:14:00Z'),
    ('b0000000-0000-0000-0000-000000000018', 'active', 'offline',     'Stromausfall Region Genf',                       'a0000000-0000-0000-0000-000000000001', 'system',  '2025-01-25T22:30:00Z'),
    ('b0000000-0000-0000-0000-000000000027', 'active', 'offline',     'Hardware-Defekt Mainboard',                      'a0000000-0000-0000-0000-000000000002', 'system',  '2025-01-18T04:55:00Z'),
    ('b0000000-0000-0000-0000-000000000034', 'active', 'offline',     'Überflutungsschaden, Tower abgeschaltet',         'a0000000-0000-0000-0000-000000000001', 'manual',  '2025-01-10T17:20:00Z'),
    ('b0000000-0000-0000-0000-000000000042', 'active', 'offline',     'Blitzschlag, Elektronik beschädigt',             'a0000000-0000-0000-0000-000000000001', 'system',  '2025-01-22T01:12:00Z'),

    -- Statuswechsel: Tower 10 → decommissioned
    ('b0000000-0000-0000-0000-000000000010', 'active', 'maintenance', 'Geplante Außerbetriebnahme eingeleitet',          'a0000000-0000-0000-0000-000000000001', 'manual',  '2024-10-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000010', 'maintenance', 'decommissioned', 'Tower endgültig stillgelegt, Abbau beauftragt', 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-11-15T14:00:00Z'),

    -- Zusätzliche Historie: Tower Berlin (viel Aktivität)
    ('b0000000-0000-0000-0000-000000000001', 'active', 'maintenance', 'Planmäßige Quartalswartung Q1',                   'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-04-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'maintenance', 'active', 'Wartung abgeschlossen, alle Systeme OK',          'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-04-01T16:30:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'active', 'offline',     'Kurzer Netzwerkausfall',                          'a0000000-0000-0000-0000-000000000001', 'system',  '2024-06-15T02:10:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'offline', 'active',     'Netzwerk wiederhergestellt',                      'a0000000-0000-0000-0000-000000000001', 'system',  '2024-06-15T02:45:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'active', 'maintenance', 'Planmäßige Quartalswartung Q2',                   'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-07-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'maintenance', 'active', 'Wartung abgeschlossen',                           'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-07-01T14:00:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'active', 'maintenance', 'Planmäßige Quartalswartung Q3',                   'a0000000-0000-0000-0000-000000000002', 'manual',  '2024-10-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'maintenance', 'active', 'Wartung abgeschlossen, Sensor kalibriert',        'a0000000-0000-0000-0000-000000000002', 'manual',  '2024-10-01T17:00:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'active', 'offline',     'Spannungsschwankung detektiert',                  'a0000000-0000-0000-0000-000000000001', 'system',  '2024-12-20T23:15:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'offline', 'active',     'Stromversorgung stabilisiert',                    'a0000000-0000-0000-0000-000000000001', 'system',  '2024-12-21T00:02:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'active', 'maintenance', 'Planmäßige Quartalswartung Q4',                   'a0000000-0000-0000-0000-000000000003', 'manual',  '2025-01-06T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'maintenance', 'active', 'Wartung abgeschlossen, neuer Filter eingebaut',   'a0000000-0000-0000-0000-000000000003', 'manual',  '2025-01-06T15:30:00Z'),

    -- Zusätzliche Historie: Tower Hamburg
    ('b0000000-0000-0000-0000-000000000002', 'active', 'offline',     'Sturmschaden, Antenne verrutscht',                'a0000000-0000-0000-0000-000000000001', 'system',  '2024-10-28T04:20:00Z'),
    ('b0000000-0000-0000-0000-000000000002', 'offline', 'maintenance','Reparaturteam unterwegs',                         'a0000000-0000-0000-0000-000000000002', 'manual',  '2024-10-28T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000002', 'maintenance', 'active', 'Antenne neu justiert, Tower online',              'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-10-29T14:30:00Z'),

    -- Zusätzliche Historie: Tower München
    ('b0000000-0000-0000-0000-000000000003', 'active', 'maintenance', 'Software-Update v3.2',                            'a0000000-0000-0000-0000-000000000002', 'manual',  '2024-09-15T06:00:00Z'),
    ('b0000000-0000-0000-0000-000000000003', 'maintenance', 'active', 'Update erfolgreich, Neustart abgeschlossen',      'a0000000-0000-0000-0000-000000000002', 'manual',  '2024-09-15T06:45:00Z'),
    ('b0000000-0000-0000-0000-000000000003', 'active', 'offline',     'Heartbeat-Verlust, automatisch als offline markiert', 'a0000000-0000-0000-0000-000000000001', 'system', '2025-01-03T18:30:00Z'),
    ('b0000000-0000-0000-0000-000000000003', 'offline', 'active',     'Heartbeat wiederhergestellt nach Netzwerk-Reboot','a0000000-0000-0000-0000-000000000001', 'system',  '2025-01-03T18:42:00Z'),

    -- Zusätzliche Historie: Tower Paris
    ('b0000000-0000-0000-0000-000000000020', 'active', 'maintenance', 'Halbjährliche Inspektion',                        'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-09-01T07:00:00Z'),
    ('b0000000-0000-0000-0000-000000000020', 'maintenance', 'active', 'Inspektion bestanden, alle Werte im Normbereich', 'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-09-01T16:00:00Z'),
    ('b0000000-0000-0000-0000-000000000020', 'active', 'offline',     'DDoS-Alarm, Tower präventiv isoliert',            'a0000000-0000-0000-0000-000000000001', 'system',  '2024-11-12T14:05:00Z'),
    ('b0000000-0000-0000-0000-000000000020', 'offline', 'active',     'Entwarnung, Netzwerk-Firewall aktualisiert',      'a0000000-0000-0000-0000-000000000001', 'system',  '2024-11-12T15:20:00Z'),

    -- Zusätzliche Historie: Tower Amsterdam
    ('b0000000-0000-0000-0000-000000000025', 'active', 'maintenance', 'Kamera-Upgrade auf 4K-Modul',                     'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-08-20T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000025', 'maintenance', 'active', 'Kamera-Upgrade abgeschlossen',                    'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-08-20T12:00:00Z'),

    -- Zusätzliche Historie: Tower Rom
    ('b0000000-0000-0000-0000-000000000032', 'active', 'offline',     'Hitzeschutz-Abschaltung bei 45°C',                'a0000000-0000-0000-0000-000000000001', 'system',  '2024-08-10T14:30:00Z'),
    ('b0000000-0000-0000-0000-000000000032', 'offline', 'active',     'Temperatur normalisiert, automatischer Neustart', 'a0000000-0000-0000-0000-000000000001', 'system',  '2024-08-10T20:15:00Z'),

    -- Zusätzliche Historie: Tower Kopenhagen
    ('b0000000-0000-0000-0000-000000000040', 'active', 'maintenance', 'Winterfestmachung und Heizungsprüfung',           'a0000000-0000-0000-0000-000000000002', 'manual',  '2024-11-01T09:00:00Z'),
    ('b0000000-0000-0000-0000-000000000040', 'maintenance', 'active', 'Winterfestmachung abgeschlossen',                 'a0000000-0000-0000-0000-000000000002', 'manual',  '2024-11-01T15:00:00Z'),

    -- Zusätzliche Historie: Tower Prag
    ('b0000000-0000-0000-0000-000000000044', 'active', 'offline',     'Vandalismus gemeldet, Tower gesperrt',             'a0000000-0000-0000-0000-000000000001', 'manual',  '2024-10-05T22:00:00Z'),
    ('b0000000-0000-0000-0000-000000000044', 'offline', 'maintenance','Schadensaufnahme und Reparatur eingeleitet',       'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-10-06T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000044', 'maintenance', 'active', 'Reparatur abgeschlossen, Gehäuse ausgetauscht',   'a0000000-0000-0000-0000-000000000003', 'manual',  '2024-10-08T16:00:00Z');

-- ========== SERVICE-TICKETS ==========
-- 10 Beispiel-Tickets: Wartungen, Störungen, Inspektionen.
-- Verschiedene Status (open, pending, in_progress, closed) und Prioritäten.
-- 3 Tickets wurden bereits resolved (UPDATE am Ende des Blocks)

INSERT INTO service_tickets (tower_id, ticket_number, title, description, ticket_type, priority, status, assigned_to, assigned_at, created_by) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'TKT-2024-001', 'Routinewartung Q1',              'Planmäßige Quartalswartung Tower Berlin',           'maintenance',  'medium',   'closed',       'a0000000-0000-0000-0000-000000000003', '2024-03-28T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000004', 'TKT-2024-002', 'Kameraausfall Cam-3',            'Kamera 3 liefert kein Bild seit 03.02.',            'incident',     'high',     'in_progress',  'a0000000-0000-0000-0000-000000000003', '2024-11-06T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000002', 'TKT-2024-003', 'Firmware-Update v2.5',           'Firmware-Update auf allen Sensoren durchführen',     'maintenance',  'low',      'closed',       NULL,                                    NULL,                    'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000007', 'TKT-2024-004', 'Netzwerkausfall Düsseldorf',     'Provider-Ticket erstellt, Eskalation nötig',        'incident',     'critical', 'open',         'a0000000-0000-0000-0000-000000000002', '2025-01-20T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000034', 'TKT-2024-005', 'Überflutungsschaden Florenz',    'Elektronik prüfen und ggf. austauschen',            'incident',     'critical', 'in_progress',  'a0000000-0000-0000-0000-000000000003', '2025-01-11T08:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000042', 'TKT-2024-006', 'Blitzschaden Oslo',              'Mainboard und Netzteil austauschen',                'incident',     'high',     'open',         NULL,                                    NULL,                    'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000022', 'TKT-2024-007', 'Korrosion Marseille',            'Salzwasser-Korrosion am Mast dokumentiert',         'inspection',   'medium',   'in_progress',  'a0000000-0000-0000-0000-000000000003', '2024-11-21T09:00:00Z', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000010', 'TKT-2024-008', 'Abbau Tower Nürnberg',           'Tower demontieren und Standort räumen',             'maintenance',  'low',      'pending',      'a0000000-0000-0000-0000-000000000002', '2024-11-16T08:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000020', 'TKT-2024-009', 'Firewall-Update Paris',          'Netzwerk-Firewall nach DDoS-Vorfall aktualisieren', 'maintenance',  'high',     'closed',       'a0000000-0000-0000-0000-000000000002', '2024-11-12T16:00:00Z', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000046', 'TKT-2024-010', 'Antennenjustierung Budapest',    'Antenne nach Sturm neu ausrichten',                 'maintenance',  'medium',   'open',         'a0000000-0000-0000-0000-000000000003', '2025-01-15T12:00:00Z', 'a0000000-0000-0000-0000-000000000002');

UPDATE service_tickets SET resolution='Wartung erfolgreich durchgeführt', resolved_at='2024-04-01T16:30:00Z' WHERE ticket_number='TKT-2024-001';
UPDATE service_tickets SET resolution='Update erfolgreich durchgeführt', resolved_at='2024-10-29T14:30:00Z' WHERE ticket_number='TKT-2024-003';
UPDATE service_tickets SET resolution='Firewall aktualisiert, Regelwerk verschärft', resolved_at='2024-11-13T10:00:00Z' WHERE ticket_number='TKT-2024-009';

-- ========== DOKUMENTE ==========
-- 20 Beispiel-Dokumente: Berichte, Handbücher, Zertifikate, Protokolle.
-- Physische Dateien (seed-doc-XXX.txt) existieren als Platzhalter im Container.
-- filename = UUID-basierter Name auf dem Dateisystem
-- file_path = vollständiger Pfad im Container (/app/uploads/)
-- tower_id = NULL bei allgemeinen Dokumenten ohne Tower-Bezug

INSERT INTO documents (id, tower_id, filename, original_filename, mime_type, file_size, file_path, title, description, document_type, version, uploaded_by, created_at) VALUES
    -- Berlin (3 Dokumente)
    ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'seed-doc-001.txt', 'Inbetriebnahme_Berlin_Mitte.txt',         'text/plain', 761,  '/app/uploads/seed-doc-001.txt', 'Inbetriebnahmeprotokoll',        'Protokoll der Erstinbetriebnahme Tower Berlin Mitte am 15.01.2024. Alle Systeme geprüft und freigegeben.',  'report',      1, 'a0000000-0000-0000-0000-000000000001', '2024-01-15T10:00:00Z'),
    ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'seed-doc-002.txt', 'Wartungshandbuch_GT-2024-001.txt',        'text/plain', 606,   '/app/uploads/seed-doc-002.txt', 'Wartungshandbuch v2.1',          'Vollständiges Wartungshandbuch für Tower-Typ GT-2024. Enthält Checklisten, Intervalle und Ersatzteillisten.', 'manual',   1, 'a0000000-0000-0000-0000-000000000001', '2024-01-20T08:00:00Z'),
    ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'seed-doc-003.txt', 'TÜV_Zertifikat_2024_Berlin.txt',          'text/plain', 476,   '/app/uploads/seed-doc-003.txt', 'TÜV-Zertifikat 2024',           'TÜV-Prüfbericht und Zertifizierung gemäß DIN EN 62305 (Blitzschutz) und DIN 4131 (Stahltürme).',            'certificate', 1, 'a0000000-0000-0000-0000-000000000002', '2024-03-10T14:00:00Z'),

    -- Hamburg (2 Dokumente)
    ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'seed-doc-004.txt', 'Sturmschadenbericht_Hamburg_2024.txt',     'text/plain', 620,   '/app/uploads/seed-doc-004.txt', 'Sturmschadenbericht Okt 2024',  'Dokumentation des Sturmschadens vom 28.10.2024. Antenne verrutscht, Gehäuse intakt, keine strukturellen Schäden.', 'report', 1, 'a0000000-0000-0000-0000-000000000003', '2024-10-29T16:00:00Z'),
    ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'seed-doc-005.txt', 'Reparaturprotokoll_Hamburg_Antenne.txt',   'text/plain', 595,   '/app/uploads/seed-doc-005.txt', 'Reparaturprotokoll Antenne',    'Antenne neu justiert und fixiert. Signalstärke getestet: -42 dBm (Soll: < -50 dBm). Freigabe erteilt.',      'report',      1, 'a0000000-0000-0000-0000-000000000003', '2024-10-30T10:00:00Z'),

    -- München (2 Dokumente)
    ('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000003', 'seed-doc-006.txt', 'Firmware_Changelog_v3.2.txt',             'text/plain', 571,   '/app/uploads/seed-doc-006.txt', 'Firmware Changelog v3.2',       'Release Notes: Verbesserter Heartbeat-Mechanismus, optimierte Stromsparmodi, Bugfix Sensorabfrage bei Frost.', 'manual',  1, 'a0000000-0000-0000-0000-000000000002', '2024-09-14T16:00:00Z'),
    ('d0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 'seed-doc-007.txt', 'Standortgutachten_München_Zentrum.txt',    'text/plain', 619,   '/app/uploads/seed-doc-007.txt', 'Standortgutachten',             'Gutachten zur Standorteignung Marienplatz. Bodenbeschaffenheit, Windlast, EMV-Verträglichkeit geprüft.',      'report',      1, 'a0000000-0000-0000-0000-000000000001', '2024-02-10T09:00:00Z'),

    -- Frankfurt (2 Dokumente)
    ('d0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', 'seed-doc-008.txt', 'Kamera_Defektanalyse_Frankfurt.txt',      'text/plain', 609,   '/app/uploads/seed-doc-008.txt', 'Defektanalyse Kamera Cam-3',    'Analyse des Kameraausfalls: Korrodierter Stecker am Anschlussmodul. Austausch Stecker + Kabel empfohlen.',    'report',      1, 'a0000000-0000-0000-0000-000000000003', '2024-11-07T11:00:00Z'),
    ('d0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000004', 'seed-doc-009.txt', 'Ersatzteilliste_GT-2024.txt',             'text/plain', 521,   '/app/uploads/seed-doc-009.txt', 'Ersatzteilliste 2024',          'Vollständige Ersatzteilliste mit Bestellnummern, Lieferanten und Lieferzeiten für alle Tower-Komponenten.',   'manual',      1, 'a0000000-0000-0000-0000-000000000001', '2024-03-15T08:00:00Z'),

    -- Paris (2 Dokumente)
    ('d0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000020', 'seed-doc-010.txt', 'Sicherheitsbericht_DDoS_Paris.txt',       'text/plain', 572,   '/app/uploads/seed-doc-010.txt', 'Sicherheitsbericht DDoS-Vorfall', 'Incident Report: DDoS-Angriff am 12.11.2024, 14:05 UTC. Automatische Isolation nach 23 Sekunden. Kein Datenverlust.', 'report', 1, 'a0000000-0000-0000-0000-000000000001', '2024-11-13T09:00:00Z'),
    ('d0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000020', 'seed-doc-011.txt', 'Netzwerk_Topologie_Paris.txt',            'text/plain', 557,   '/app/uploads/seed-doc-011.txt', 'Netzwerk-Topologie',            'Netzwerkplan Tower Paris: Primärer Uplink via Glasfaser (1 Gbit/s), Fallback 5G-Modem, lokales VLAN-Setup.',  'manual',      1, 'a0000000-0000-0000-0000-000000000002', '2024-03-05T10:00:00Z'),

    -- Florenz (1 Dokument)
    ('d0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000034', 'seed-doc-012.txt', 'Schadensgutachten_Florenz_Überflutung.txt','text/plain', 499,   '/app/uploads/seed-doc-012.txt', 'Schadensgutachten Überflutung', 'Gutachten nach Überflutung am 10.01.2025. Elektronik-Modul komplett beschädigt, Mast und Fundament intakt.', 'report',      1, 'a0000000-0000-0000-0000-000000000003', '2025-01-12T14:00:00Z'),

    -- Nürnberg (1 Dokument - decommissioned)
    ('d0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000010', 'seed-doc-013.txt', 'Stilllegungsprotokoll_Nürnberg.txt',      'text/plain', 494,   '/app/uploads/seed-doc-013.txt', 'Stilllegungsprotokoll',         'Protokoll der ordnungsgemäßen Stilllegung. Stromversorgung getrennt, Daten gesichert, Abbau-Auftrag erteilt.', 'report',   1, 'a0000000-0000-0000-0000-000000000001', '2024-11-15T16:00:00Z'),

    -- Amsterdam (1 Dokument)
    ('d0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000025', 'seed-doc-014.txt', 'Upgrade_Bericht_4K_Amsterdam.txt',        'text/plain', 447,   '/app/uploads/seed-doc-014.txt', 'Upgrade-Bericht 4K-Kamera',     'Dokumentation des Kamera-Upgrades auf 4K-Modul. Alte Kamera: 1080p/30fps, neue Kamera: 4K/60fps. Bildqualität verifiziert.', 'report', 1, 'a0000000-0000-0000-0000-000000000003', '2024-08-21T09:00:00Z'),

    -- Prag (1 Dokument)
    ('d0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000044', 'seed-doc-015.txt', 'Vandalismus_Polizeibericht_Prag.txt',     'text/plain', 473,   '/app/uploads/seed-doc-015.txt', 'Polizeibericht Vandalismus',    'Polizeiliche Anzeige und Schadensdokumentation. Gehäuse aufgebrochen, keine Daten kompromittiert.',            'report',      1, 'a0000000-0000-0000-0000-000000000001', '2024-10-06T10:00:00Z'),

    -- Allgemeine Dokumente (nicht towerspezifisch → tower_id NULL)
    ('d0000000-0000-0000-0000-000000000016', NULL,                                   'seed-doc-016.txt', 'Sicherheitsrichtlinie_G-Tower_2024.txt',  'text/plain', 493,   '/app/uploads/seed-doc-016.txt', 'Sicherheitsrichtlinie 2024',    'Unternehmensweite Sicherheitsrichtlinie für den Betrieb von G-Tower-Anlagen. Zugangsregelungen, Notfallpläne, Eskalationsstufen.', 'manual', 1, 'a0000000-0000-0000-0000-000000000001', '2024-01-05T08:00:00Z'),
    ('d0000000-0000-0000-0000-000000000017', NULL,                                   'seed-doc-017.txt', 'Wartungsintervalle_Übersicht_2024.txt',   'text/plain', 467,   '/app/uploads/seed-doc-017.txt', 'Wartungsintervalle Übersicht',  'Tabellarische Übersicht aller Wartungsintervalle nach Komponente: Kamera (6 Mo.), Antenne (12 Mo.), Stromversorgung (3 Mo.).', 'manual', 1, 'a0000000-0000-0000-0000-000000000001', '2024-01-08T09:00:00Z'),

    -- Weitere Tower-Dokumente
    ('d0000000-0000-0000-0000-000000000018', 'b0000000-0000-0000-0000-000000000032', 'seed-doc-018.txt', 'Hitzeschutz_Protokoll_Rom.txt',           'text/plain', 441,   '/app/uploads/seed-doc-018.txt', 'Hitzeschutz-Abschaltprotokoll', 'Automatische Abschaltung bei 45°C Innentemperatur am 10.08.2024. Kühlungssystem Empfehlung: Zusatzlüfter.',  'report',      1, 'a0000000-0000-0000-0000-000000000002', '2024-08-11T08:00:00Z'),
    ('d0000000-0000-0000-0000-000000000019', 'b0000000-0000-0000-0000-000000000040', 'seed-doc-019.txt', 'Winterfestmachung_Kopenhagen.txt',        'text/plain', 445,   '/app/uploads/seed-doc-019.txt', 'Winterfestmachung Checkliste',  'Checkliste Winterfestmachung: Heizung OK, Dichtungen erneuert, Entwässerung geprüft, Frostschutz aufgefüllt.', 'report',  1, 'a0000000-0000-0000-0000-000000000002', '2024-11-01T16:00:00Z'),
    ('d0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000022', 'seed-doc-020.txt', 'Korrosionsbericht_Marseille.txt',         'text/plain', 712,   '/app/uploads/seed-doc-020.txt', 'Korrosionsbericht',             'Salzwasser-Korrosion am Mastfuß dokumentiert. Korrosionsgrad: C4 nach ISO 12944. Sanierung innerhalb 3 Monaten empfohlen.', 'report', 1, 'a0000000-0000-0000-0000-000000000003', '2024-11-22T10:00:00Z');

-- ========== PHASE 3: SYSTEM-CHECK MOCKDATEN ==========
-- Setzt battery_level und last_heartbeat in tower.config (JSONB),
-- damit der Scheduler (systemChecks.ts) beim nächsten Lauf Status-Änderungen
-- auslösen kann. Die Regeln im Scheduler:
--   - battery_level ≤ 5  → critical (höchste Priorität)
--   - battery_level ≤ 20 → warning
--   - heartbeat > 15 Min → offline
-- Geschützte Status (maintenance, decommissioned) werden NICHT überschrieben!
-- HINWEIS: NOW() wird zum Zeitpunkt des SQL-Ausführens evaluiert.

-- Gesunde Tower (aktueller Heartbeat, guter Batteriestand → bleiben active)
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb(NOW()::text)), '{battery_level}', '85') WHERE id = 'b0000000-0000-0000-0000-000000000001';
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb(NOW()::text)), '{battery_level}', '92') WHERE id = 'b0000000-0000-0000-0000-000000000002';
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb(NOW()::text)), '{battery_level}', '78') WHERE id = 'b0000000-0000-0000-0000-000000000005';
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb(NOW()::text)), '{battery_level}', '65') WHERE id = 'b0000000-0000-0000-0000-000000000006';
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb(NOW()::text)), '{battery_level}', '71') WHERE id = 'b0000000-0000-0000-0000-000000000008';
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb(NOW()::text)), '{battery_level}', '88') WHERE id = 'b0000000-0000-0000-0000-000000000009';

-- TRIGGER: battery_low → warning (Paris, Batterie 15%)
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb(NOW()::text)), '{battery_level}', '15') WHERE id = 'b0000000-0000-0000-0000-000000000020';

-- TRIGGER: battery_critical → critical (Amsterdam, Batterie 3%)
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb(NOW()::text)), '{battery_level}', '3') WHERE id = 'b0000000-0000-0000-0000-000000000025';

-- TRIGGER: heartbeat_missing → offline (Madrid, Heartbeat 30 Min. alt)
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb((NOW() - INTERVAL '30 minutes')::text)), '{battery_level}', '70') WHERE id = 'b0000000-0000-0000-0000-000000000036';

-- TRIGGER: battery_critical + heartbeat_missing → critical gewinnt (Barcelona, Batterie 2%, Heartbeat 20 Min.)
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb((NOW() - INTERVAL '20 minutes')::text)), '{battery_level}', '2') WHERE id = 'b0000000-0000-0000-0000-000000000037';

-- KEIN TRIGGER: maintenance-Tower mit schlechter Batterie (Frankfurt, geschützter Status)
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb(NOW()::text)), '{battery_level}', '4') WHERE id = 'b0000000-0000-0000-0000-000000000004';

-- KEIN TRIGGER: decommissioned-Tower mit altem Heartbeat (Nürnberg, geschützter Status)
UPDATE towers SET config = jsonb_set(jsonb_set(config, '{last_heartbeat}', to_jsonb((NOW() - INTERVAL '2 hours')::text)), '{battery_level}', '1') WHERE id = 'b0000000-0000-0000-0000-000000000010';

-- ========== LIFECYCLE-STATUS & LIFECYCLE-HISTORIE ==========
-- Setzt lifecycle_status für 8 ausgewählte Towers und erzeugt passende
-- Lifecycle-History-Einträge mit validen Übergangsketten.
-- WICHTIG: Die Übergänge müssen der State Machine in lifecycleService.ts
-- entsprechen. Erlaubte Übergänge siehe dort (VALID_TRANSITIONS Map).
-- scrapped ist ein Endzustand – wird hier nicht als Seed verwendet.
-- Alle übrigen Towers bleiben auf dem Default 'production'.

-- Berlin: rented (production → delivery → rented)
UPDATE towers SET lifecycle_status = 'rented' WHERE id = 'b0000000-0000-0000-0000-000000000001';
-- Hamburg: rented (production → delivery → storage → rented)
UPDATE towers SET lifecycle_status = 'rented' WHERE id = 'b0000000-0000-0000-0000-000000000002';
-- Frankfurt: repair (production → delivery → rented → repair)
UPDATE towers SET lifecycle_status = 'repair' WHERE id = 'b0000000-0000-0000-0000-000000000004';
-- Nürnberg: end_of_life (production → delivery → rented → return_delivery → end_of_life)
UPDATE towers SET lifecycle_status = 'end_of_life' WHERE id = 'b0000000-0000-0000-0000-000000000010';
-- Paris: rented (production → delivery → rented)
UPDATE towers SET lifecycle_status = 'rented' WHERE id = 'b0000000-0000-0000-0000-000000000020';
-- Amsterdam: storage (production → delivery → storage)
UPDATE towers SET lifecycle_status = 'storage' WHERE id = 'b0000000-0000-0000-0000-000000000025';
-- Rom: reconditioning (production → delivery → rented → return_delivery → reconditioning)
UPDATE towers SET lifecycle_status = 'reconditioning' WHERE id = 'b0000000-0000-0000-0000-000000000032';
-- Kopenhagen: delivery (production → delivery)
UPDATE towers SET lifecycle_status = 'delivery' WHERE id = 'b0000000-0000-0000-0000-000000000040';

-- Lifecycle-History-Einträge
INSERT INTO tower_lifecycle_history (tower_id, old_status, new_status, reason, changed_by, source, changed_at) VALUES
    -- Berlin: production → delivery → rented
    ('b0000000-0000-0000-0000-000000000001', NULL,          'production', 'Tower produziert',                    'a0000000-0000-0000-0000-000000000001', 'manual', '2023-11-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'production',  'delivery',   'Auslieferung an Kundenstandort Berlin','a0000000-0000-0000-0000-000000000001', 'manual', '2024-01-10T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000001', 'delivery',    'rented',     'Mietvertrag MV-2024-001 aktiv',       'a0000000-0000-0000-0000-000000000002', 'manual', '2024-01-15T08:00:00Z'),

    -- Hamburg: production → delivery → storage → rented
    ('b0000000-0000-0000-0000-000000000002', NULL,          'production', 'Tower produziert',                    'a0000000-0000-0000-0000-000000000001', 'manual', '2023-10-15T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000002', 'production',  'delivery',   'Versand an Zwischenlager Nord',       'a0000000-0000-0000-0000-000000000001', 'manual', '2023-12-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000002', 'delivery',    'storage',    'Einlagerung Lager Hamburg-Süd',       'a0000000-0000-0000-0000-000000000002', 'manual', '2023-12-05T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000002', 'storage',     'rented',     'Mietvertrag MV-2024-002 aktiv',       'a0000000-0000-0000-0000-000000000002', 'manual', '2024-02-01T10:00:00Z'),

    -- Frankfurt: production → delivery → rented → repair
    ('b0000000-0000-0000-0000-000000000004', NULL,          'production', 'Tower produziert',                    'a0000000-0000-0000-0000-000000000001', 'manual', '2023-12-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000004', 'production',  'delivery',   'Auslieferung Standort Frankfurt',     'a0000000-0000-0000-0000-000000000001', 'manual', '2024-03-05T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000004', 'delivery',    'rented',     'Mietvertrag MV-2024-004 aktiv',       'a0000000-0000-0000-0000-000000000002', 'manual', '2024-03-10T11:00:00Z'),
    ('b0000000-0000-0000-0000-000000000004', 'rented',      'repair',     'Kameradefekt, Reparatur eingeleitet', 'a0000000-0000-0000-0000-000000000003', 'manual', '2024-11-05T14:20:00Z'),

    -- Nürnberg: production → delivery → rented → return_delivery → end_of_life
    ('b0000000-0000-0000-0000-000000000010', NULL,          'production',      'Tower produziert',                          'a0000000-0000-0000-0000-000000000001', 'manual', '2023-08-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000010', 'production',  'delivery',        'Auslieferung Standort Nürnberg',            'a0000000-0000-0000-0000-000000000001', 'manual', '2023-12-15T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000010', 'delivery',    'rented',          'Mietvertrag MV-2023-010 aktiv',             'a0000000-0000-0000-0000-000000000002', 'manual', '2024-01-10T06:00:00Z'),
    ('b0000000-0000-0000-0000-000000000010', 'rented',      'return_delivery', 'Mietvertrag beendet, Rückholung beauftragt','a0000000-0000-0000-0000-000000000002', 'manual', '2024-10-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000010', 'return_delivery','end_of_life',  'Wirtschaftliche Reparatur nicht möglich',   'a0000000-0000-0000-0000-000000000001', 'manual', '2024-11-15T14:00:00Z'),

    -- Paris: production → delivery → rented
    ('b0000000-0000-0000-0000-000000000020', NULL,          'production', 'Tower produziert',                    'a0000000-0000-0000-0000-000000000001', 'manual', '2023-12-15T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000020', 'production',  'delivery',   'Auslieferung Standort Paris',         'a0000000-0000-0000-0000-000000000001', 'manual', '2024-02-20T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000020', 'delivery',    'rented',     'Mietvertrag MV-2024-020 aktiv',       'a0000000-0000-0000-0000-000000000002', 'manual', '2024-03-01T10:00:00Z'),

    -- Amsterdam: production → delivery → storage
    ('b0000000-0000-0000-0000-000000000025', NULL,          'production', 'Tower produziert',                    'a0000000-0000-0000-0000-000000000001', 'manual', '2024-01-10T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000025', 'production',  'delivery',   'Versand an Lager Amsterdam',          'a0000000-0000-0000-0000-000000000001', 'manual', '2024-03-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000025', 'delivery',    'storage',    'Einlagerung Lager Amsterdam-West',    'a0000000-0000-0000-0000-000000000002', 'manual', '2024-03-05T10:00:00Z'),

    -- Rom: production → delivery → rented → return_delivery → reconditioning
    ('b0000000-0000-0000-0000-000000000032', NULL,          'production',      'Tower produziert',                          'a0000000-0000-0000-0000-000000000001', 'manual', '2023-11-15T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000032', 'production',  'delivery',        'Auslieferung Standort Rom',                 'a0000000-0000-0000-0000-000000000001', 'manual', '2024-03-10T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000032', 'delivery',    'rented',          'Mietvertrag MV-2024-032 aktiv',             'a0000000-0000-0000-0000-000000000002', 'manual', '2024-03-20T10:00:00Z'),
    ('b0000000-0000-0000-0000-000000000032', 'rented',      'return_delivery', 'Hitzeschaden, Rückholung',                  'a0000000-0000-0000-0000-000000000003', 'manual', '2024-08-15T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000032', 'return_delivery','reconditioning','Aufbereitung im Werk gestartet',           'a0000000-0000-0000-0000-000000000001', 'manual', '2024-09-01T08:00:00Z'),

    -- Kopenhagen: production → delivery
    ('b0000000-0000-0000-0000-000000000040', NULL,          'production', 'Tower produziert',                    'a0000000-0000-0000-0000-000000000001', 'manual', '2024-03-01T08:00:00Z'),
    ('b0000000-0000-0000-0000-000000000040', 'production',  'delivery',   'Auslieferung Standort Kopenhagen',    'a0000000-0000-0000-0000-000000000001', 'manual', '2024-04-20T08:00:00Z');
