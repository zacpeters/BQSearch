import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ADMIN_PRESENTATION_CONFIG_KEY, builtInPresentationConfig, clonePresentationConfig, loadPresentationConfig, presentationPresets, PRESENTATION_CONFIG_KEY } from './formatting';
import { FormattingEditor } from './material-manager/FormattingEditor';

describe('presentation configuration', () => {
  it('keeps category edits isolated and declarative', () => {
    const next = clonePresentationConfig(builtInPresentationConfig);
    next.categories.frequency2.color = '#000';
    expect(next.categories.frequency1.color).toBe(builtInPresentationConfig.categories.frequency1.color);
    expect(next.categories.uniqueBeginning.marker).toBe(true);
  });
  it('provides the supported formatting presets', () => {
    expect(Object.keys(presentationPresets)).toEqual(['classic', 'pastel', 'high-contrast', 'minimal']);
  });
  it('resolves public settings through admin defaults when no user override exists', () => {
    localStorage.clear();
    const admin = clonePresentationConfig(builtInPresentationConfig); admin.categories.frequency2.color = '#123456';
    localStorage.setItem(ADMIN_PRESENTATION_CONFIG_KEY, JSON.stringify(admin));
    expect(loadPresentationConfig(PRESENTATION_CONFIG_KEY).categories.frequency2.color).toBe('#123456');
  });
  it('renders the independent WYSIWYG category controls and preview', () => {
    const html = renderToStaticMarkup(createElement(FormattingEditor, { value: builtInPresentationConfig, onChange: () => undefined }));
    expect(html).toContain('Unique Beginnings');
    expect(html).toContain('3x Words');
    expect(html).toContain('Live Scripture preview');
  });
});
