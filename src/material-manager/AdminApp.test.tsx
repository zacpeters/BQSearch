// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './AdminApp';

describe('Material Manager Stage 1 workflow UI', () => {
  it('shows the guided workflow, draft-safe options help, and filename controls', () => {
    const html = renderToStaticMarkup(<AdminApp />);
    expect(html).toContain('Import');
    expect(html).toContain('Validate');
    expect(html).toContain('Analyze');
    expect(html).toContain('Review');
    expect(html).toContain('Export');
    expect(html).toContain('Options');
    expect(html).toContain('Recent non-sensitive choices');
    expect(html).toContain('Pack filename');
    expect(html).toContain('Continue →');
    expect(html).toContain('Export or install existing material');
    expect(html).toContain('Install exported pack locally');
    expect(html).toContain('Open Material Manager help');
    expect(html).toContain('Help');
  });

  it('provides the plain-language Help Center from the header', async () => {
    const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(createElement(AdminApp)); });
    const help = container.querySelector<HTMLButtonElement>('[aria-label="Open Material Manager help"]');
    expect(help).toBeTruthy();
    await act(async () => { help?.click(); });
    expect(container.textContent).toContain('Material Manager help');
    expect(container.textContent).toContain('Start a material year');
    expect(container.textContent).toContain('Drafts and backups');
    const close = container.querySelector<HTMLButtonElement>('[aria-label="Close help"]');
    await act(async () => { close?.click(); });
    expect(container.textContent).not.toContain('Material Manager help');
    root.unmount(); container.remove();
  });

  it('allows direct navigation to Export before any material is prepared', async () => {
    const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(createElement(AdminApp)); });
    const exportStep = [...container.querySelectorAll<HTMLButtonElement>('.workflow-step')].find(button => button.textContent?.includes('Export'));
    expect(exportStep).toBeTruthy();
    await act(async () => { exportStep?.click(); });
    expect(container.querySelector('.admin-main')?.getAttribute('data-workflow-stage')).toBe('export');
    expect(container.textContent).toContain('Install exported pack locally');
    root.unmount(); container.remove();
  });
});
