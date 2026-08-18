import { useEffect, useState, type FormEvent } from 'react';
import {
  LOG_LEVELS,
  type Alert,
  type AlertRule,
  type AlertRuleInput,
  type LogLevel,
} from '@logs/shared';
import type { WsClient } from '../lib/ws-client';
import { LEVEL_CHIP_CLASSES } from '../lib/level-styles';
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertHistory,
  fetchAlertRules,
  updateAlertRule,
} from '../lib/api';

const EMPTY_FORM: AlertRuleInput = {
  name: '',
  levels: ['ERROR'],
  service: null,
  threshold: 10,
  windowSeconds: 60,
  cooldownSeconds: 60,
  enabled: true,
};

const TOAST_LIFETIME_MS = 8000;

export function AlertsPanel({ wsClient }: { wsClient: WsClient }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<Alert[]>([]);
  const [toasts, setToasts] = useState<Alert[]>([]);
  const [form, setForm] = useState<AlertRuleInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const [r, h] = await Promise.all([fetchAlertRules(), fetchAlertHistory(50)]);
      setRules(r.rules);
      setHistory(h.alerts);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Live alerts arrive over the same WS connection as logs - no separate polling.
  useEffect(() => {
    return wsClient.onAlert((alert) => {
      setHistory((prev) => [alert, ...prev].slice(0, 50));
      setToasts((prev) => [...prev, alert]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((a) => a.id !== alert.id));
      }, TOAST_LIFETIME_MS);
    });
  }, [wsClient]);

  function toggleLevel(level: LogLevel): void {
    setForm((f) => ({
      ...f,
      levels: f.levels.includes(level) ? f.levels.filter((l) => l !== level) : [...f.levels, level],
    }));
  }

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (form.levels.length === 0) {
      setError('Elegi al menos un nivel');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAlertRule(form);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled(rule: AlertRule): Promise<void> {
    await updateAlertRule(rule.id, { enabled: !rule.enabled });
    await refresh();
  }

  async function handleDelete(rule: AlertRule): Promise<void> {
    await deleteAlertRule(rule.id);
    await refresh();
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-surface-low p-4 text-sm text-on-surface">
      {/* Sanctioned glass surface #1 (settled decision 6) - toasts genuinely
          float over content, unlike the static panel surfaces below. */}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-lg border border-error/40 bg-error-container/80 px-3 py-2 text-xs text-on-error-container shadow-lg backdrop-blur-sm"
          >
            <strong>{t.ruleName}</strong>: {t.count} eventos en {t.windowSeconds}s (umbral{' '}
            {t.threshold})
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Nueva regla
        </h2>
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-2 rounded-lg border border-outline-variant/40 bg-surface-container p-3"
        >
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="nombre"
            required
            className="rounded-md border border-outline-variant/40 bg-surface-highest px-2 py-1 text-xs text-on-surface placeholder:text-on-surface-variant/60"
          />
          <div className="flex gap-1">
            {LOG_LEVELS.map((level) => (
              <button
                type="button"
                key={level}
                onClick={() => toggleLevel(level)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                  form.levels.includes(level)
                    ? LEVEL_CHIP_CLASSES[level]
                    : 'bg-surface-highest text-on-surface-variant'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          <input
            value={form.service ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, service: e.target.value || null }))}
            placeholder="servicio (vacio = cualquiera)"
            className="rounded-md border border-outline-variant/40 bg-surface-highest px-2 py-1 text-xs text-on-surface placeholder:text-on-surface-variant/60"
          />
          <div className="flex gap-2">
            <label className="flex-1 text-[10px] text-on-surface-variant">
              Umbral
              <input
                type="number"
                min={1}
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                className="mt-0.5 w-full rounded-md border border-outline-variant/40 bg-surface-highest px-2 py-1 text-xs text-on-surface"
              />
            </label>
            <label className="flex-1 text-[10px] text-on-surface-variant">
              Ventana (s)
              <input
                type="number"
                min={1}
                value={form.windowSeconds}
                onChange={(e) => setForm((f) => ({ ...f, windowSeconds: Number(e.target.value) }))}
                className="mt-0.5 w-full rounded-md border border-outline-variant/40 bg-surface-highest px-2 py-1 text-xs text-on-surface"
              />
            </label>
            <label className="flex-1 text-[10px] text-on-surface-variant">
              Cooldown (s)
              <input
                type="number"
                min={0}
                value={form.cooldownSeconds}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cooldownSeconds: Number(e.target.value) }))
                }
                className="mt-0.5 w-full rounded-md border border-outline-variant/40 bg-surface-highest px-2 py-1 text-xs text-on-surface"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-container px-2 py-1 text-xs font-semibold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear regla'}
          </button>
          {error && <p className="text-xs text-error">{error}</p>}
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Reglas
        </h2>
        <ul className="flex flex-col gap-1.5">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-container px-2 py-1.5 text-xs"
            >
              <div>
                <span className="font-semibold text-on-surface">{rule.name}</span>{' '}
                <span className="text-on-surface-variant/70">
                  {rule.levels.join(',')} {rule.service ? `@ ${rule.service}` : ''} -{' '}
                  {rule.threshold}/{rule.windowSeconds}s
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleToggleEnabled(rule)}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    rule.enabled
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-highest text-on-surface-variant/60'
                  }`}
                >
                  {rule.enabled ? 'activa' : 'inactiva'}
                </button>
                <button
                  onClick={() => handleDelete(rule)}
                  className="rounded-md bg-error/15 px-1.5 py-0.5 text-[10px] font-semibold text-error"
                >
                  borrar
                </button>
              </div>
            </li>
          ))}
          {rules.length === 0 && (
            <p className="text-xs text-on-surface-variant/60">Sin reglas todavia.</p>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Historial
        </h2>
        <ul className="flex flex-col gap-1">
          {history.map((alert) => (
            <li
              key={alert.id}
              className="rounded-lg border border-outline-variant/40 bg-surface-container px-2 py-1.5 text-xs text-on-surface-variant"
            >
              <span className="text-on-surface-variant/60">
                {new Date(alert.triggeredAt).toLocaleString('es-AR')}
              </span>{' '}
              <strong className="text-on-surface">{alert.ruleName}</strong>: {alert.count}/
              {alert.threshold} en {alert.windowSeconds}s
            </li>
          ))}
          {history.length === 0 && (
            <p className="text-xs text-on-surface-variant/60">Sin alertas todavia.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
