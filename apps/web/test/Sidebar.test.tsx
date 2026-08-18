// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sidebar } from '../src/components/Sidebar.js';

afterEach(cleanup);

const noop = () => undefined;

describe('Sidebar', () => {
  it('exposes exactly two mode buttons by accessible name', () => {
    render(
      <Sidebar
        mode="live"
        onModeChange={noop}
        status="connected"
        endpoint="ws://localhost:4000/ws"
      />,
    );

    expect(screen.getByRole('button', { name: 'En vivo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Histórico' })).toBeTruthy();
  });

  it('marks the active mode button aria-pressed="true" and the inactive one "false"', () => {
    render(
      <Sidebar
        mode="historical"
        onModeChange={noop}
        status="connected"
        endpoint="ws://localhost:4000/ws"
      />,
    );

    expect(screen.getByRole('button', { name: 'Histórico' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'En vivo' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('calls onModeChange("live") when "En vivo" is clicked from historical mode', () => {
    const onModeChange = vi.fn();
    render(
      <Sidebar
        mode="historical"
        onModeChange={onModeChange}
        status="connected"
        endpoint="ws://localhost:4000/ws"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'En vivo' }));

    expect(onModeChange).toHaveBeenCalledWith('live');
  });

  it('calls onModeChange("historical") when "Histórico" is clicked from live mode', () => {
    const onModeChange = vi.fn();
    render(
      <Sidebar
        mode="live"
        onModeChange={onModeChange}
        status="connected"
        endpoint="ws://localhost:4000/ws"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Histórico' }));

    expect(onModeChange).toHaveBeenCalledWith('historical');
  });
});
