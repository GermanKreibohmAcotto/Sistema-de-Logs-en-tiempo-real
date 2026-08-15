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
    // Sanctioned glass surface #2 (settled decision 6): the overlay blurs
    // the app shell behind it while no token is set.
    <div className="flex h-screen items-center justify-center bg-background/80 backdrop-blur-md">
      <form
        onSubmit={handleSubmit}
        className="flex w-72 flex-col gap-3 rounded-xl border border-outline-variant/40 bg-surface-container p-6"
      >
        <label htmlFor="dashboard-token" className="text-sm font-semibold text-on-surface">
          Token del dashboard
        </label>
        <input
          id="dashboard-token"
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md border border-outline-variant/40 bg-surface-highest px-2 py-1.5 text-sm text-on-surface"
        />
        <button
          type="submit"
          className="rounded-md bg-primary-container px-3 py-1.5 text-sm font-semibold text-on-primary hover:bg-primary"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
