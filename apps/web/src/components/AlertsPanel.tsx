import { useEffect, useState, type FormEvent } from 'react';
import { LOG_LEVELS, type Alert, type AlertRule, type AlertRuleInput, type LogLevel } from '@logs/shared';
import type { WsClient } from '../lib/ws-client';
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
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm">
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded border border-red-700 bg-red-950/90 px-3 py-2 text-xs text-red-100 shadow-lg"
          >
            <strong>{t.ruleName}</strong>: {t.count} eventos en {t.windowSeconds}s (umbral {t.threshold})
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-slate-400">Nueva regla</h2>
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-2 rounded border border-slate-800 bg-slate-900 p-3"
        >
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="nombre"
            required
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
          <div className="flex gap-1">
            {LOG_LEVELS.map((level) => (
              <button
                type="button"
                key={level}
                onClick={() => toggleLevel(level)}
                className={`rounded px-2 py-1 text-[10px] font-semibold ${
                  form.levels.includes(level) ? 'bg-red-800 text-red-50' : 'bg-slate-800 text-slate-400'
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
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
          <div className="flex gap-2">
            <label className="flex-1 text-[10px] text-slate-400">
              Umbral
              <input
                type="number"
                min={1}
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>
            <label className="flex-1 text-[10px] text-slate-400">
              Ventana (s)
              <input
                type="number"
                min={1}
                value={form.windowSeconds}
                onChange={(e) => setForm((f) => ({ ...f, windowSeconds: Number(e.target.value) }))}
                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>
            <label className="flex-1 text-[10px] text-slate-400">
              Cooldown (s)
              <input
                type="number"
                min={0}
                value={form.cooldownSeconds}
                onChange={(e) => setForm((f) => ({ ...f, cooldownSeconds: Number(e.target.value) }))}
                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-indigo-800 px-2 py-1 text-xs font-semibold text-indigo-50 hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear regla'}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-slate-400">Reglas</h2>
        <ul className="flex flex-col gap-1.5">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs"
            >
              <div>
                <span className="font-semibold">{rule.name}</span>{' '}
                <span className="text-slate-500">
                  {rule.levels.join(',')} {rule.service ? `@ ${rule.service}` : ''} - {rule.threshold}/
                  {rule.windowSeconds}s
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleToggleEnabled(rule)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    rule.enabled ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {rule.enabled ? 'activa' : 'inactiva'}
                </button>
                <button
                  onClick={() => handleDelete(rule)}
                  className="rounded bg-red-950 px-1.5 py-0.5 text-[10px] font-semibold text-red-300"
                >
                  borrar
                </button>
              </div>
            </li>
          ))}
          {rules.length === 0 && <p className="text-xs text-slate-500">Sin reglas todavia.</p>}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-slate-400">Historial</h2>
        <ul className="flex flex-col gap-1">
          {history.map((alert) => (
            <li
              key={alert.id}
              className="rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
            >
              <span className="text-slate-500">{new Date(alert.triggeredAt).toLocaleString('es-AR')}</span>{' '}
              <strong>{alert.ruleName}</strong>: {alert.count}/{alert.threshold} en {alert.windowSeconds}s
            </li>
          ))}
          {history.length === 0 && <p className="text-xs text-slate-500">Sin alertas todavia.</p>}
        </ul>
      </section>
    </div>
  );
}
