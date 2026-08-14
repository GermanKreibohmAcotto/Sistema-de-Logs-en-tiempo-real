import { useState } from 'react';
import { setDashboardToken } from '../lib/dashboard-token';

/**
 * Asks once for DASHBOARD_TOKEN and persists it. If the API runs open (no
 * token configured server-side) any value works - the server never checks it.
 */
export function TokenGate({ onSubmit }: { onSubmit: () => void }) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setDashboardToken(value);
    onSubmit();
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <form
        onSubmit={handleSubmit}
        className="flex w-72 flex-col gap-3 rounded border border-slate-800 bg-slate-900 p-6"
      >
        <label htmlFor="dashboard-token" className="text-sm font-semibold text-slate-200">
          Token del dashboard
        </label>
        <input
          id="dashboard-token"
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
        />
        <button
          type="submit"
          className="rounded bg-indigo-800 px-3 py-1.5 text-sm font-semibold text-indigo-50 hover:bg-indigo-700"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
