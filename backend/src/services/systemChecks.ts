/**
 * @module systemChecks
 *
 * Zweck:
 *   Automatische Ueberwachung aller Tower – prueft Batteriestatus und
 *   Heartbeat-Zeitstempel und setzt bei Bedarf den **operativen Status**.
 *
 * Rolle im Gesamtsystem:
 *   Wird periodisch vom Scheduler (z.B. Cron/setInterval) aufgerufen.
 *   Nutzt towerService.updateStatus() mit source='system', um Status-Aenderungen
 *   in der gleichen Transaktion+Historie zu protokollieren wie manuelle Aenderungen.
 *
 *   WICHTIG: Dieser Service aendert NIEMALS den Lifecycle-Status. Er operiert
 *   ausschliesslich auf dem operativen Status.
 *
 * Abhängigkeiten:
 *   - database.query: Lesen aller zu pruefenden Tower
 *   - towerService.updateStatus(): Schreiben von Status-Aenderungen (mit Historie)
 *   - TowerStatus (Typ): Erlaubte operative Status-Werte
 *
 * Wichtige Annahmen:
 *   - Geschuetzte Status (maintenance, decommissioned) werden per SQL-WHERE
 *     komplett ausgeschlossen – sie werden weder geprueft noch ueberschrieben.
 *   - Regeln werden in Prioritaetsreihenfolge ausgewertet:
 *       1. battery_critical (battery_level <= 5%)  → Status "critical"
 *       2. battery_low      (battery_level <= 20%) → Status "warning"
 *       3. heartbeat_missing (> 5 Minuten)         → Status "offline"
 *   - Es gewinnt immer die Regel mit der hoechsten Prioritaet (STATUS_PRIORITY).
 *   - Ein Status wird nur dann geaendert, wenn der neue Status eine HOEHERE
 *     Prioritaet hat als der aktuelle (Verschlechterung). Verbesserungen
 *     (z.B. critical → active) werden NICHT automatisch vorgenommen.
 *   - battery_level und last_heartbeat werden aus dem JSON-Feld "config" gelesen.
 *   - Ein Parallel-Run-Guard (isRunning) verhindert ueberlappende Ausfuehrungen.
 *
 * Änderungshinweise:
 *   - Neue Pruefregel: Funktion erstellen und in das rules-Array einfuegen.
 *     Die Reihenfolge im Array bestimmt die Evaluierungsreihenfolge, aber
 *     letztlich entscheidet STATUS_PRIORITY, welche Regel gewinnt.
 *   - HEARTBEAT_TIMEOUT_MINUTES ist per Umgebungsvariable konfigurierbar.
 *   - Bei neuen geschuetzten Status: SQL-WHERE in runSystemChecks() anpassen.
 */
import { query } from '../config/database.js';
import { towerService } from './towerService.js';
import type { TowerStatus } from '../models/types.js';

// ── Configuration ──────────────────────────────────────
/** Heartbeat-Timeout in Minuten – konfigurierbar ueber Umgebungsvariable */
const HEARTBEAT_TIMEOUT_MINUTES = parseInt(process.env.HEARTBEAT_TIMEOUT_MINUTES || '5', 10);

// ── Priority map (higher = more urgent) ────────────────
/**
 * Prioritaetskarte fuer operative Status-Werte.
 * Hoehere Zahl = dringender. maintenance und decommissioned haben
 * Prioritaet 99, damit sie nie durch automatische Regeln ueberschrieben werden.
 */
const STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  offline: 1,
  warning: 2,
  critical: 3,
  maintenance: 99,
  decommissioned: 99,
};

// ── Parallel-run guard ─────────────────────────────────
/** Verhindert ueberlappende Ausfuehrungen, falls der Scheduler schneller tickt als der Check laeuft */
let isRunning = false;

// ── Types ──────────────────────────────────────────────
interface TowerRow {
  id: string;
  status: TowerStatus;
  config: Record<string, unknown>;
}

interface CheckResult {
  targetStatus: TowerStatus;
  reason: string;
}

// ── Rule functions ─────────────────────────────────────

/**
 * Regel 1 (hoechste Prioritaet): Batterie kritisch niedrig (<=5%).
 * Setzt den Status auf "critical".
 */
function checkBatteryCritical(config: Record<string, unknown>): CheckResult | null {
  const level = typeof config.battery_level === 'number' ? config.battery_level : null;
  if (level === null || level >= 5) return null;
  return { targetStatus: 'critical', reason: `Batteriestand kritisch: ${level}%` };
}

/**
 * Regel 2: Batterie niedrig (<=20%, aber >5%).
 * Setzt den Status auf "warning".
 * Hinweis: Wird nur relevant, wenn checkBatteryCritical() nicht greift,
 * da die Prioritaet von "critical" hoeher ist als "warning".
 */
function checkBatteryLow(config: Record<string, unknown>): CheckResult | null {
  const level = typeof config.battery_level === 'number' ? config.battery_level : null;
  if (level === null || level >= 20) return null;
  return { targetStatus: 'warning', reason: `Batteriestand niedrig: ${level}%` };
}

/**
 * Regel 3 (niedrigste Prioritaet): Heartbeat fehlt seit >5 Minuten.
 * Setzt den Status auf "offline".
 */
function checkHeartbeatMissing(config: Record<string, unknown>): CheckResult | null {
  const lastHb = typeof config.last_heartbeat === 'string' ? config.last_heartbeat : null;
  if (!lastHb) return null;
  const hbDate = new Date(lastHb);
  if (isNaN(hbDate.getTime())) return null;
  /* Differenz in Minuten berechnen */
  const diffMin = (Date.now() - hbDate.getTime()) / 60_000;
  if (diffMin <= HEARTBEAT_TIMEOUT_MINUTES) return null;
  return { targetStatus: 'offline', reason: `Kein Heartbeat seit ${Math.round(diffMin)} Minuten` };
}

// ── Rules in priority order ────────────────────────────
/** Alle Prueregeln in der Reihenfolge ihrer Auswertung */
const rules = [checkBatteryCritical, checkBatteryLow, checkHeartbeatMissing];

// ── Main entry point ───────────────────────────────────
/**
 * Hauptfunktion: Prueft alle nicht-geschuetzten Tower und aktualisiert
 * bei Bedarf den operativen Status.
 *
 * Ablauf pro Tower:
 *   1. Alle Regeln auswerten und das Ergebnis mit der hoechsten Prioritaet waehlen.
 *   2. Nur aendern, wenn der neue Status eine hoehere Prioritaet hat als der aktuelle
 *      (d.h. nur Verschlechterungen, keine automatischen Verbesserungen).
 *   3. Status-Aenderung ueber towerService.updateStatus() mit source='system' ausfuehren.
 */
export async function runSystemChecks(): Promise<void> {
  /* Parallel-Run-Guard: Ueberspringen, wenn bereits eine Pruefung laeuft */
  if (isRunning) {
    console.log('[SystemChecks] Skipped — previous run still in progress');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    /*
     * Nur Tower laden, die NICHT im geschuetzten Status sind.
     * maintenance und decommissioned werden bewusst ausgeschlossen,
     * damit der Scheduler diese nie automatisch aendert.
     */
    const { rows: towers } = await query(
      `SELECT id, status, config FROM towers WHERE status NOT IN ('maintenance', 'decommissioned')`
    );

    let changed = 0;

    for (const tower of towers as TowerRow[]) {
      let bestResult: CheckResult | null = null;

      /* Alle Regeln auswerten und das Ergebnis mit hoechster Prioritaet waehlen */
      for (const rule of rules) {
        const result = rule(tower.config || {});
        if (result === null) continue;
        if (bestResult === null || STATUS_PRIORITY[result.targetStatus] > STATUS_PRIORITY[bestResult.targetStatus]) {
          bestResult = result;
        }
      }

      /* Kein Regelverstoß erkannt → Tower unveraendert lassen */
      if (!bestResult) continue;
      /* Status ist bereits der Ziel-Status → nichts zu tun */
      if (tower.status === bestResult.targetStatus) continue;
      /*
       * Nur Verschlechterungen anwenden: Wenn der aktuelle Status bereits
       * eine gleich hohe oder hoehere Prioritaet hat, nicht aendern.
       * Beispiel: Ein Tower im Status "critical" wird nicht auf "warning" gesetzt.
       */
      if (STATUS_PRIORITY[tower.status] >= STATUS_PRIORITY[bestResult.targetStatus]) continue;

      try {
        /* Status-Aenderung ueber towerService (mit Transaktion und Historie) */
        await towerService.updateStatus(tower.id, bestResult.targetStatus, bestResult.reason, null, 'system');
        changed++;
      } catch (err) {
        console.error(`[SystemChecks] Failed to update tower ${tower.id}:`, err);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SystemChecks] Completed in ${elapsed}ms — ${towers.length} towers checked, ${changed} status changes`);
  } catch (err) {
    console.error('[SystemChecks] Error during system checks:', err);
  } finally {
    isRunning = false;
  }
}
