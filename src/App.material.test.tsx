import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const storage = vi.hoisted(() => ({
  getPacks: vi.fn(), getSettings: vi.fn(), savePack: vi.fn().mockResolvedValue(undefined),
  downloadPack: vi.fn().mockRejectedValue(new Error('Offline')), saveSettings: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./storage', () => storage);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('approved material startup', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('bq-search-walkthrough-v1', 'dismissed');
    window.matchMedia = (media: string) => ({ matches: false, media, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    storage.getPacks.mockResolvedValue([]); storage.getSettings.mockResolvedValue(undefined);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  async function render() {
    await act(async () => { root.render(<App />); await new Promise(resolve => setTimeout(resolve, 30)); });
  }
  it('uses approved bundled material on a fresh offline startup', async () => {
    await render();
    expect(storage.savePack).toHaveBeenCalledWith(expect.objectContaining({ id: 'season-2027-v1' }));
    expect(host.textContent).not.toContain('Demonstration');
    expect(host.querySelector('input[aria-label="Search Scripture"]')).not.toBeNull();
  });
  it('migrates saved demo selections and unsupported legacy divisions', async () => {
    storage.getPacks.mockResolvedValue([{ id: 'demo-2026', status: 'demo' }]);
    storage.getSettings.mockResolvedValue({ installedPackId: 'demo-2026', seasonId: 'demo-season-2026', division: 'Seniors', studyStart: 1, studyEnd: 999 });
    await render();
    expect(host.textContent).not.toContain('Demonstration');
    expect(host.textContent).toContain('Intermediate');
    expect(storage.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ installedPackId: 'season-2027-v1', division: 'Intermediate' }));
  });
  it('keeps approved material available when local storage fails', async () => {
    storage.getPacks.mockRejectedValue(new Error('Unavailable storage'));
    await render();
    expect(host.querySelector('input[aria-label="Search Scripture"]')).not.toBeNull();
    expect(host.textContent).not.toContain('Demonstration');
  });
});
