import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALENDLY_CSS, CALENDLY_SCRIPT, loadCalendly, openCalendly, resetCalendlyLoader } from './calendly';

interface FakeEl {
  tag: string;
  src?: string;
  href?: string;
  rel?: string;
  async?: boolean;
  onload?: () => void;
  onerror?: () => void;
}

function fakeDocument() {
  const appended: FakeEl[] = [];
  const win: { Calendly?: { initPopupWidget: (o: { url: string }) => void } } = {};
  const doc = {
    defaultView: win,
    head: { appendChild: (el: FakeEl) => appended.push(el) },
    createElement: (tag: string): FakeEl => ({ tag }),
    querySelector: (sel: string) =>
      appended.find((el) => el.tag === 'link' && sel.includes(el.href ?? '\0')) ?? null,
  };
  const scripts = () => appended.filter((el) => el.tag === 'script');
  return { doc: doc as unknown as Document, win, appended, scripts };
}

beforeEach(() => resetCalendlyLoader());
afterEach(() => vi.useRealTimers());

describe('loadCalendly', () => {
  it('injects script and stylesheet once and shares the promise between concurrent calls', async () => {
    const { doc, win, appended, scripts } = fakeDocument();
    const a = loadCalendly(doc);
    const b = loadCalendly(doc);
    expect(a).toBe(b);
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0]!.src).toBe(CALENDLY_SCRIPT);
    expect(appended.filter((el) => el.tag === 'link').map((el) => el.href)).toEqual([CALENDLY_CSS]);

    const api = { initPopupWidget: vi.fn() };
    win.Calendly = api;
    scripts()[0]!.onload!();
    await expect(a).resolves.toBe(api);
    await expect(loadCalendly(doc)).resolves.toBe(api);
    expect(scripts()).toHaveLength(1);
  });

  it('rejects on script error and allows a retry without duplicating the stylesheet', async () => {
    const { doc, appended, scripts } = fakeDocument();
    const first = loadCalendly(doc);
    scripts()[0]!.onerror!();
    await expect(first).rejects.toThrow('failed');
    void loadCalendly(doc).catch(() => {});
    expect(scripts()).toHaveLength(2);
    expect(appended.filter((el) => el.tag === 'link')).toHaveLength(1);
  });

  it('rejects when the script never loads within the timeout', async () => {
    vi.useFakeTimers();
    const { doc } = fakeDocument();
    const p = loadCalendly(doc, 1000);
    vi.advanceTimersByTime(1000);
    await expect(p).rejects.toThrow('timeout');
  });
});

describe('openCalendly', () => {
  const url = 'https://calendly.example.com/janedoe/30min';

  it('opens the popup when the widget loads', async () => {
    const api = { initPopupWidget: vi.fn() };
    const fallback = vi.fn();
    await expect(openCalendly(url, () => Promise.resolve(api), fallback)).resolves.toBe('popup');
    expect(api.initPopupWidget).toHaveBeenCalledWith({ url });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('opens the link normally when the widget fails to load', async () => {
    const fallback = vi.fn();
    await expect(openCalendly(url, () => Promise.reject(new Error('x')), fallback)).resolves.toBe('fallback');
    expect(fallback).toHaveBeenCalledWith(url);
  });
});
