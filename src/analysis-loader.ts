import { validateAnalysisReport, type AnalysisReport } from './analysis';
import type { Division, ScripturePack } from './types';

export type AnalysisLoadStatus = 'available' | 'not-installed' | 'incompatible' | 'unable-to-load';
export interface AnalysisLoadResult { status: AnalysisLoadStatus; report?: AnalysisReport; message?: string; }

const supportedVersion = '1.1';
const divisions: Division[] = ['Beginner', 'Junior', 'Intermediate', 'Experienced'];

export function analysisAssetUrl(packId: string, division: Division, baseUrl = import.meta.env.BASE_URL): string {
  return `${baseUrl.replace(/\/$/, '/') }analysis/${encodeURIComponent(packId)}/${encodeURIComponent(division)}.json`;
}

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object'; }

export function validateAnalysisSidecar(value: unknown, pack: ScripturePack, division: Division): { valid: boolean; report?: AnalysisReport; message?: string } {
  if (!isObject(value)) return { valid: false, message: 'Analysis report is not a JSON object.' };
  if (value.analysisVersion !== supportedVersion) return { valid: false, message: `Unsupported analysis version: ${String(value.analysisVersion ?? 'missing')}.` };
  if (value.division !== division) return { valid: false, message: 'Analysis division does not match the active division.' };
  const sourcePack = value.sourcePack;
  if (!isObject(sourcePack) || sourcePack.id !== pack.id || sourcePack.version !== pack.version) return { valid: false, message: 'Analysis report does not match the installed Scripture pack.' };
  if (pack.integrityChecksum && sourcePack.checksum !== pack.integrityChecksum) return { valid: false, message: 'Analysis report checksum does not match the installed Scripture pack.' };
  if (!Array.isArray(value.annotations) || !Array.isArray(value.beginnings) || !Array.isArray(value.endings)) return { valid: false, message: 'Analysis report is missing required arrays.' };
  const report = value as unknown as AnalysisReport;
  const reportErrors = validateAnalysisReport(report, pack.verses);
  if (reportErrors.length) return { valid: false, message: reportErrors[0] };
  const verseIds = new Set(pack.verses.filter(verse => verse.divisions.includes(division)).map(verse => verse.id));
  for (const annotation of report.annotations) {
    if (!isObject(annotation) || annotation.division !== division || typeof annotation.normalizedValue !== 'string' || !verseIds.has(String(annotation.verseId))) return { valid: false, message: 'Analysis report contains an invalid verse, division mapping, or normalized value.' };
    const verse = pack.verses.find(item => item.id === annotation.verseId);
    if (!verse || typeof annotation.start !== 'number' || typeof annotation.end !== 'number' || annotation.start < 0 || annotation.end > verse.text.length || annotation.start >= annotation.end || annotation.value !== verse.text.slice(annotation.start, annotation.end)) return { valid: false, message: 'Analysis report contains an invalid annotation span.' };
  }
  return { valid: true, report };
}

export async function loadAnalysisSidecar(pack: ScripturePack, division: Division, fetcher: typeof fetch = globalThis.fetch, baseUrl = import.meta.env.BASE_URL): Promise<AnalysisLoadResult> {
  if (!divisions.includes(division)) return { status: 'incompatible', message: 'This division does not have a supported analysis sidecar.' };
  try {
    const response = await fetcher(analysisAssetUrl(pack.id, division, baseUrl), { cache: 'no-cache' });
    if (response.status === 404) return { status: 'not-installed', message: 'No compatible analysis report is installed for this pack and division.' };
    if (!response.ok) return { status: 'unable-to-load', message: `Analysis report request failed (${response.status}).` };
    const checked = validateAnalysisSidecar(await response.json(), pack, division);
    return checked.valid ? { status: 'available', report: checked.report } : { status: 'incompatible', message: checked.message };
  } catch (error) { return { status: 'unable-to-load', message: error instanceof Error ? error.message : 'Analysis report could not be loaded.' }; }
}
