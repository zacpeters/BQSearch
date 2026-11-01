import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Download, FileJson, FileText, Globe2, HelpCircle, Plus, RefreshCw, StopCircle, Upload, X } from 'lucide-react';
import { expandReference, parseImportFiles, parseImportText, reviewReferences, suggestDivisionFromFilename } from '../material/importer';
import { parseKJVText } from '../material/kjv';
import { BIBLE_API_SOURCE, BibleApiKjvProvider, RetrievalCache, retrieveKJVText, type RetrievalProgress } from '../material/retrieval';
import { generatePack, packJson, validateImportedReferences } from '../material/pack';
import { verifyPackIntegrity } from '../material/pack';
import { savePack, saveSettings } from '../storage';
import { analysisJson, analyzeScriptureDivision, type AnalysisReport } from '../analysis';
import { projectVersesForDivision } from '../division';
import { buildReleaseZip, includedDivisions, suggestedReleaseFilename, validateReleaseBundle } from '../material/release';
import { suggestedAnalysisFilename, suggestedMaterialFilename } from '../material/filenames';
import { discardMaterialDraft, getMaterialDraft, loadMaterialManagerOptions, materialDraftBackupJson, parseMaterialDraftBackup, saveMaterialDraft, saveMaterialManagerOptions, type MaterialDraftSnapshot } from './drafts';
import { FormattingEditor } from './FormattingEditor';
import { loadPresentationConfig, savePresentationConfig, ADMIN_PRESENTATION_CONFIG_KEY, type PresentationConfig } from '../formatting';
import type { ImportReview, ImportSourceFile } from '../material/types';
import type { Division, ScripturePack } from '../types';

const sourceNotes = 'King James Version as identified by bible-api.com; provider does not independently specify a 1769 edition. Selected verse text only; API terms prohibit downloading an entire Bible. Maintainer review required before redistribution.';
const defaultInput = '';
const workflowStages = ['import', 'validate', 'analyze', 'review', 'export'] as const;
type WorkflowStage = typeof workflowStages[number];
const stageLabel = (stage: WorkflowStage) => stage === 'export' ? 'Import / Export' : stage[0].toUpperCase() + stage.slice(1);

export function AdminApp() {
  const recentOptions = useMemo(() => loadMaterialManagerOptions(), []);
  const [input, setInput] = useState(defaultInput); const [format, setFormat] = useState<'auto'|'txt'|'csv'|'json'>(recentOptions.format ?? 'auto'); const [sourceFiles, setSourceFiles] = useState<ImportSourceFile[]>([]); const [corpusText, setCorpusText] = useState(''); const [corpusError, setCorpusError] = useState(''); const [review, setReview] = useState<ImportReview | null>(null); const [corrections, setCorrections] = useState<Record<string, string>>({}); const [retrieved, setRetrieved] = useState<Record<string, { text: string; source: 'api' | 'cache' }>>({}); const [retrievalFailures, setRetrievalFailures] = useState<Record<string, string>>({}); const [retrievalProgress, setRetrievalProgress] = useState<RetrievalProgress | null>(null); const [message, setMessage] = useState(''); const [fetching, setFetching] = useState(false); const controllerRef = useRef<AbortController | null>(null); const cacheRef = useRef(new RetrievalCache());
  const [pack, setPack] = useState({ id: 'season-2027-v1', title: '2027 Beginner', version: '1.0.0', seasonId: 'season-2027', seasonName: '2027', year: recentOptions.year ?? 2027 }); const [importDivision, setImportDivision] = useState<Division>(recentOptions.importDivision ?? 'Beginner'); const [connectionMessage, setConnectionMessage] = useState(''); const [analysis, setAnalysis] = useState<AnalysisReport | null>(null); const [analysisReports, setAnalysisReports] = useState<Partial<Record<Division, AnalysisReport>>>({}); const [releasePack, setReleasePack] = useState<ScripturePack | null>(null); const [releaseValidation, setReleaseValidation] = useState<Awaited<ReturnType<typeof validateReleaseBundle>> | null>(null); const [releaseFilename, setReleaseFilename] = useState(''); const [packFilename, setPackFilename] = useState(''); const [analysisFilename, setAnalysisFilename] = useState(''); const [analysisMessage, setAnalysisMessage] = useState(''); const [analysisRunning, setAnalysisRunning] = useState(false);
  const [packTitleEdited, setPackTitleEdited] = useState(false);
  const [activeStage, setActiveStage] = useState<WorkflowStage>('import'); const [showOptionsHelp, setShowOptionsHelp] = useState(false); const [showHelp, setShowHelp] = useState(false); const [draftResolved, setDraftResolved] = useState(false); const [draftCandidate, setDraftCandidate] = useState<MaterialDraftSnapshot | null>(null); const [draftChoiceMade, setDraftChoiceMade] = useState(false); const [recomputeDraftReview, setRecomputeDraftReview] = useState(false); const [presentationConfig, setPresentationConfig] = useState<PresentationConfig>(() => loadPresentationConfig(ADMIN_PRESENTATION_CONFIG_KEY));
  const filenamePack = { title: pack.title, season: { year: pack.year } };
  useEffect(() => { void getMaterialDraft().then(draft => { setDraftCandidate(draft ?? null); setDraftResolved(true); }).catch(() => setDraftResolved(true)); }, []);
  useEffect(() => { if (!draftResolved || (draftCandidate && !draftChoiceMade)) return; saveMaterialManagerOptions({ format, importDivision, year: pack.year }); void saveMaterialDraft({ input, format, sourceFiles, corpusText, corrections, retrieved, pack, importDivision }).catch(() => undefined); }, [draftResolved, draftCandidate, draftChoiceMade, input, format, sourceFiles, corpusText, corrections, retrieved, pack, importDivision]);
  const resumeDraft = () => { if (!draftCandidate) return; setInput(draftCandidate.input); setFormat(draftCandidate.format); setSourceFiles(draftCandidate.sourceFiles); setCorpusText(draftCandidate.corpusText); setCorrections(draftCandidate.corrections); setRetrieved(draftCandidate.retrieved); setPack(draftCandidate.pack); setImportDivision(draftCandidate.importDivision); setDraftCandidate(null); setDraftChoiceMade(true); setRecomputeDraftReview(true); setMessage('Draft restored. Recomputing validation from the restored inputs.'); };
  const exportDraftBackup = () => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([materialDraftBackupJson({ input, format, sourceFiles, corpusText, corrections, retrieved, pack, importDivision })], { type: 'application/json' })); link.download = 'bq-search-material-draft.json'; link.click(); URL.revokeObjectURL(link.href); setMessage('Unencrypted draft backup downloaded.'); };
  const importDraftBackup = async (file: File) => { try { const draft = parseMaterialDraftBackup(JSON.parse(await file.text())); setInput(draft.input); setFormat(draft.format); setSourceFiles(draft.sourceFiles); setCorpusText(draft.corpusText); setCorrections(draft.corrections); setRetrieved(draft.retrieved); setPack(draft.pack); setImportDivision(draft.importDivision); setReview(null); setAnalysis(null); setAnalysisReports({}); setReleasePack(null); setReleaseValidation(null); setDraftCandidate(null); setDraftChoiceMade(true); setRecomputeDraftReview(true); setMessage('Draft backup restored. Recomputing validation.'); } catch (error) { setMessage(`Draft restore failed: ${error instanceof Error ? error.message : String(error)}`); } };
  const startNewDraft = () => { void discardMaterialDraft(); setDraftCandidate(null); setDraftChoiceMade(true); setInput(''); setSourceFiles([]); setCorpusText(''); setCorrections({}); setRetrieved({}); setReview(null); setAnalysis(null); setAnalysisReports({}); setReleasePack(null); setReleaseValidation(null); setMessage('Started a new Material Manager draft.'); };
  const parsed = useMemo(() => sourceFiles.length ? parseImportFiles(sourceFiles) : parseImportText(input, format, { defaultDivision: importDivision, assignSequentialStudies: true }), [input, format, importDivision, sourceFiles]); const report = review ? validateImportedReferences(review.references, review.issues) : null; const sourceReports = useMemo(() => sourceFiles.map(file => ({ ...file, parsed: file.division ? parseImportText(file.text, 'txt', { defaultDivision: file.division, assignSequentialStudies: true }) : { specs: [], issues: [] } })), [sourceFiles]); const divisionSummary = useMemo(() => ['Beginner', 'Junior', 'Intermediate', 'Experienced'].map(division => { const rows = review ? review.references.filter(row => row.divisions.includes(division as Division)) : parsed.specs.filter(spec => spec.divisions.includes(division as Division)).flatMap(spec => expandReference(spec).map(reference => ({ canonicalReference: reference }))); const issues = parsed.issues.filter(issue => !issue.division || issue.division === division); const unique = new Set(rows.map(row => row.canonicalReference)); return { division, rows: rows.length, unique: unique.size, invalid: issues.filter(issue => issue.kind === 'invalid-reference').length, duplicates: (review?.issues ?? parsed.issues).filter(issue => issue.kind === 'duplicate-reference' && (!issue.division || issue.division === division)).length, warnings: issues.filter(issue => issue.kind !== 'invalid-reference').length }; }), [parsed, review]);
  const localCorpus = () => parseKJVText(corpusText); const buildReview = (nextRetrieved = retrieved, nextCorrections = corrections, extraIssues = review?.issues.filter(issue => issue.kind !== 'retrieval-error') ?? []) => { try { const corpus = localCorpus(); const sourceOverrides = Object.fromEntries(Object.entries(nextRetrieved).map(([reference, value]) => [reference, value.source])); const nextReview = reviewReferences(parsed.specs, { get: reference => nextRetrieved[reference]?.text ?? corpus.get(reference) }, nextCorrections, sourceOverrides); nextReview.issues = [...parsed.issues, ...nextReview.issues, ...extraIssues.filter(issue => issue.kind === 'retrieval-error')]; setReview(nextReview); setCorpusError(''); } catch (error) { setCorpusError(error instanceof Error ? error.message : String(error)); const nextReview = reviewReferences(parsed.specs, { get: reference => nextRetrieved[reference]?.text }, nextCorrections); nextReview.issues = [...parsed.issues, ...nextReview.issues]; setReview(nextReview); } };
  useEffect(() => { if (!recomputeDraftReview) return; buildReview(retrieved, corrections); setRecomputeDraftReview(false); setActiveStage('validate'); }, [recomputeDraftReview, parsed]);
  useEffect(() => { const divisions = new Set([...sourceFiles.map(file => file.division), ...parsed.specs.flatMap(spec => spec.divisions)].filter(Boolean)); if (!packTitleEdited && divisions.size > 1) setPack(current => ({ ...current, title: `${current.seasonName} Complete Material` })); }, [sourceFiles, parsed, packTitleEdited]);
  const runReview = () => { setMessage(''); buildReview(); setActiveStage('validate'); };
  const loadFile = async (file: File, setter: (value: string) => void) => setter(await file.text());
  const loadMultipleTextFiles = async (files: FileList | File[]) => { const loaded = await Promise.all(Array.from(files).map(async file => ({ fileName: file.name, text: await file.text(), division: suggestDivisionFromFilename(file.name) }))); setSourceFiles(loaded); setReview(null); setMessage(''); };
  const updateSourceDivision = (fileName: string, division: Division | '') => setSourceFiles(files => files.map(file => file.fileName === fileName ? { ...file, division: division || undefined } : file));
  const addCorrection = () => { if (!correctionRef || !correctionText) return; const next = { ...corrections, [correctionRef]: correctionText }; setCorrections(next); cacheRef.current.setManual(correctionRef, correctionText); setCorrectionRef(''); setCorrectionText(''); buildReview(retrieved, next); };
  const [correctionRef, setCorrectionRef] = useState(''); const [correctionText, setCorrectionText] = useState('');
  const fetchText = async (onlyReferences?: string[]) => { const references = onlyReferences ?? [...new Set(parsed.specs.flatMap(expandReference))]; if (!references.length) return; const controller = new AbortController(); controllerRef.current = controller; setFetching(true); setMessage(''); setRetrievalFailures({}); try { const result = await retrieveKJVText(references.filter(reference => !corrections[reference]), new BibleApiKjvProvider(), { signal: controller.signal, cache: cacheRef.current, onProgress: setRetrievalProgress }); const next = { ...retrieved }; result.verses.forEach(verse => { next[verse.reference] = { text: verse.text, source: verse.source }; }); const failures = Object.fromEntries(result.failures.map(failure => [failure.reference, failure.message])); setRetrieved(next); setRetrievalFailures(failures); buildReview(next, corrections, result.failures.map(failure => ({ kind: 'retrieval-error' as const, message: `${failure.reference}: ${failure.message}`, reference: failure.reference }))); if (result.cancelled) setMessage('Retrieval cancelled. Completed verses remain available for review.'); else setMessage(`Fetched ${result.verses.length} verse result${result.verses.length === 1 ? '' : 's'}; ${result.failures.length} failed.`); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setFetching(false); controllerRef.current = null; } };
  const testConnection = async () => { setConnectionMessage('Testing Psalms 3:1…'); try { const result = await new BibleApiKjvProvider().fetchPassage(['Psalms 3:1'], new AbortController().signal); setConnectionMessage(`OK: ${result[0]?.reference} returned from ${result[0]?.translationName}.`); } catch (error) { setConnectionMessage(`Failed: ${error instanceof Error ? error.message : String(error)}`); } };
  const installPackFile = async (file: File) => { try { const imported = JSON.parse(await file.text()) as ScripturePack; if (!imported.id || !imported.season || !Array.isArray(imported.verses)) throw new Error('Pack is missing required schema fields.'); if (!(await verifyPackIntegrity(imported))) throw new Error('Pack integrity checksum is missing or invalid.'); if (!['approved', 'published'].includes(imported.status)) throw new Error('Only approved or published packs can be installed.'); const divisionsInPack = imported.verses.flatMap(verse => verse.divisions); const division = (divisionsInPack.find(value => ['Beginner', 'Junior', 'Intermediate', 'Experienced', 'Juniors', 'Seniors'].includes(value)) ?? 'Beginner') as Division; await savePack(imported); await saveSettings({ seasonId: imported.season.id, division, studyStart: 1, studyEnd: 999, installedPackId: imported.id }); setMessage(`Installed ${imported.title} locally. Reload the public lookup tab to search it.`); } catch (error) { setMessage(`Install failed: ${error instanceof Error ? error.message : String(error)}`); } };
  const buildPreparedPack = async (deterministic = false) => { if (!review) throw new Error('Review imported material before generating a pack.'); const provenance = sourceFiles.length ? `Source files: ${sourceFiles.map(file => `${file.fileName} → ${file.division ?? 'unassigned'}`).join('; ')}.` : 'Single-file or pasted import.'; const source = { name: BIBLE_API_SOURCE.name, url: BIBLE_API_SOURCE.url, license: sourceNotes, retrievedAt: deterministic ? 'local-preparation' : new Date().toISOString(), ...(corpusText ? { corpusChecksum: localCorpus().checksum } : {}), notes: `Prepared locally; API retrieval is selected-verse only and maintainer approval is required. ${provenance}` }; return generatePack({ ...pack, references: review.references, source }); };
  const runAnalysis = async () => { if (!review) { setAnalysisMessage('Review imported material before running analysis.'); return; } setAnalysisRunning(true); setActiveStage('analyze'); try { const prepared = await buildPreparedPack(true); const verses = projectVersesForDivision(prepared.verses, importDivision); const result = analyzeScriptureDivision(verses, importDivision, { id: prepared.id, version: prepared.version, integrityChecksum: prepared.integrityChecksum }); const missing = review.issues.filter(issue => issue.kind === 'missing-verse' || issue.kind === 'retrieval-error').map(issue => issue.message); result.report.errors.push(...missing); setReleasePack(prepared); setAnalysis(result.report); setAnalysisReports(reports => ({ ...reports, [importDivision]: result.report })); setReleaseValidation(null); setAnalysisMessage(`Analyzed ${result.report.summary.versesAnalyzed} ${importDivision} verses locally.`); } catch (error) { setAnalysisMessage(error instanceof Error ? error.message : String(error)); } finally { setAnalysisRunning(false); } };
  const runAllAnalysis = async () => { if (!review || !releaseReady) { setAnalysisMessage('Resolve all import and review issues before analyzing the release.'); return; } setAnalysisRunning(true); setActiveStage('analyze'); setAnalysisMessage('Generating division analysis…'); try { const prepared = await buildPreparedPack(true); const reports: Partial<Record<Division, AnalysisReport>> = {}; const divisions = includedDivisions(prepared); for (const division of divisions) { const result = analyzeScriptureDivision(projectVersesForDivision(prepared.verses, division), division, { id: prepared.id, version: prepared.version, integrityChecksum: prepared.integrityChecksum }); reports[division] = result.report; } const validation = await validateReleaseBundle(prepared, reports, sourceFiles.map(file => file.fileName), divisions); setReleasePack(prepared); setAnalysisReports(reports); setAnalysis(reports[importDivision] ?? null); setReleaseValidation(validation); setReleaseFilename(suggestedReleaseFilename(prepared, divisions)); setAnalysisFilename(suggestedAnalysisFilename(filenamePack, importDivision)); setPackFilename(suggestedMaterialFilename(filenamePack)); setActiveStage('review'); setAnalysisMessage(validation.valid ? `Analyzed ${divisions.length} division${divisions.length === 1 ? '' : 's'} and validated the release.` : `Analysis completed with ${validation.errors.length} release error${validation.errors.length === 1 ? '' : 's'}.`); } catch (error) { setAnalysisMessage(error instanceof Error ? error.message : String(error)); } finally { setAnalysisRunning(false); } };
  const exportAnalysis = () => { if (!analysis) return; const blob = new Blob([analysisJson(analysis)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = analysisFilename || suggestedAnalysisFilename(filenamePack, importDivision, analysis.analysisVersion); link.click(); URL.revokeObjectURL(link.href); setAnalysisMessage('Deterministic analysis report exported.'); };
  const exportRelease = async () => { if (!releasePack || !Object.keys(analysisReports).length) return; try { const validation = await validateReleaseBundle(releasePack, analysisReports, sourceFiles.map(file => file.fileName), includedDivisions(releasePack)); setReleaseValidation(validation); if (!validation.valid) { setAnalysisMessage(`Release blocked: ${validation.errors.join(' ')}`); return; } const zip = await buildReleaseZip(validation); const zipBuffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([zipBuffer], { type: 'application/zip' })); link.download = releaseFilename || suggestedReleaseFilename(releasePack, includedDivisions(releasePack)); link.click(); URL.revokeObjectURL(link.href); setActiveStage('export'); setAnalysisMessage(`Release bundle downloaded: ${link.download}`); } catch (error) { setAnalysisMessage(`Release export failed: ${error instanceof Error ? error.message : String(error)}`); } };
  const releaseReady = Boolean(review && report?.valid && report.warnings.length === 0 && (!sourceFiles.length || sourceFiles.every(file => file.division)));
  const exportPack = async () => { if (!review || !releaseReady) return; const provenance = sourceFiles.length ? `Source files: ${sourceFiles.map(file => `${file.fileName} → ${file.division ?? 'unassigned'}`).join('; ')}.` : 'Single-file or pasted import.'; const created = await generatePack({ ...pack, references: review.references, source: { name: BIBLE_API_SOURCE.name, url: BIBLE_API_SOURCE.url, license: sourceNotes, retrievedAt: new Date().toISOString(), corpusChecksum: localCorpus().checksum, notes: `Prepared locally; API retrieval is selected-verse only and maintainer approval is required. ${provenance}` } }); const blob = new Blob([packJson(created)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = packFilename || suggestedMaterialFilename({ title: created.title, season: created.season }); link.click(); URL.revokeObjectURL(link.href); setMessage(`Validated draft exported. Integrity checksum: ${created.integrityChecksum}`); };
  const stageStatus = useMemo(() => ({
    import: parsed.specs.length > 0 && parsed.issues.filter(issue => issue.kind === 'input-error' || issue.kind === 'invalid-reference').length === 0,
    validate: Boolean(review && report?.valid),
    analyze: Object.keys(analysisReports).length > 0,
    review: Boolean(releaseValidation),
    export: Boolean(releaseValidation?.valid),
  }), [analysisReports, parsed, releaseValidation, report, review]);
  const selectStage = (stage: WorkflowStage) => {
    setActiveStage(stage);
  };
  const continueStage = () => { const next = workflowStages[workflowStages.indexOf(activeStage) + 1]; if (next) setActiveStage(next); };
  const previousStage = () => { const previous = workflowStages[workflowStages.indexOf(activeStage) - 1]; if (previous) setActiveStage(previous); };
  const parsedReferences = [...new Set(parsed.specs.flatMap(expandReference))]; const failedReferences = Object.keys(retrievalFailures);
  return <div className="admin-shell">
<header className="admin-header">
<div>
<span className="admin-mark">
<FileJson size={17}/>
</span>
<div>
<strong>BQ Search Material Manager</strong>
<small>Prepare and review material for maintainer approval</small>
</div>
</div>
<div className="admin-header-actions"><span className="admin-lock">
<Globe2 size={14}/> Browser-based preparation tool</span><button className="admin-help-button" onClick={() => setShowHelp(true)} aria-label="Open Material Manager help"><HelpCircle size={16}/> Help</button></div>
</header>
<main className="admin-main" data-workflow-stage={activeStage}>
<div className="admin-intro">
<span className="admin-kicker">MATERIAL PREPARATION</span>
<h1>Prepare a Scripture pack</h1>
<p>Import references, verify Scripture text, analyze the divisions, review the release, and download files for maintainer approval.</p>
</div>
{draftCandidate && <section className="draft-banner" aria-label="Saved draft available"><div><strong>Unfinished draft available</strong><span>Saved {new Date(draftCandidate.savedAt).toLocaleString()} · {draftCandidate.sourceFiles.length ? `${draftCandidate.sourceFiles.length} source files` : 'pasted material'}</span></div><div><button className="primary-button" onClick={resumeDraft}>Resume Existing Work</button><button className="secondary-button" onClick={startNewDraft}>Start New Material</button><button className="text-button" onClick={() => { void discardMaterialDraft(); setDraftCandidate(null); setDraftChoiceMade(true); setMessage('Saved draft discarded.'); }}>Discard Draft</button></div></section>}
<nav className="workflow-nav" aria-label="Material preparation workflow">{workflowStages.map((stage, index) => <button key={stage} className={activeStage === stage ? 'workflow-step active' : 'workflow-step'} aria-current={activeStage === stage ? 'step' : undefined} onClick={() => selectStage(stage)}><span>{index + 1}</span><strong>{stageLabel(stage)}</strong><small>{stageStatus[stage] ? 'Complete' : stage === 'export' ? 'Blocked' : 'In progress'}</small></button>)}</nav>
<div className="workflow-controls"><button className="secondary-button" disabled={activeStage === 'import'} onClick={previousStage}>← Back</button><span>Step {workflowStages.indexOf(activeStage) + 1} of {workflowStages.length}: <strong>{stageLabel(activeStage)}</strong></span><button className="primary-button" disabled={activeStage === 'export'} onClick={continueStage}>Continue →</button></div>
<section className="options-card" aria-label="Options and help"><div className="options-heading"><strong>Options</strong><span>Recent non-sensitive choices are saved in this browser.</span><button className="text-button" onClick={() => setShowOptionsHelp(value => !value)} aria-expanded={showOptionsHelp}>Help</button></div>{showOptionsHelp && <div className="options-help"><p><strong>Import:</strong> use one TXT file per division, or keep using a single pasted/TXT/CSV/JSON import. Filename suggestions can be changed before processing.</p><p><strong>Text sources:</strong> Fetch KJV Text retrieves selected passages during preparation. Load local KJV text is the offline fallback. Neither source is used by the public lookup app at runtime.</p><p><strong>Validate and analyze:</strong> missing text, invalid references, and input errors block release. Duplicate references are shown as warnings. Analysis covers the complete division, not just a visible range; unresolved boundaries remain review warnings.</p><p><strong>Export:</strong> the release ZIP contains the unified pack, one analysis report per division, a manifest, and a validation report. Download it, inspect it, and manually copy approved files into the repository. This browser tool never publishes automatically.</p><p><strong>Offline:</strong> local parsing, validation, analysis, and export work offline. API retrieval and live connection testing require internet access.</p><p><strong>Data protection:</strong> working drafts are browser-local and unencrypted. Clearing browser data can remove drafts and preferences. Exported draft backups are unencrypted JSON.</p></div>}<details className="advanced-tools"><summary>Formatting defaults</summary><FormattingEditor value={presentationConfig} onChange={next => { setPresentationConfig(next); savePresentationConfig(next, ADMIN_PRESENTATION_CONFIG_KEY); }}/></details><div className="draft-backup-actions"><button className="secondary-button" onClick={exportDraftBackup}><Download size={14}/> Export unencrypted draft backup</button><label className="file-button"><Upload size={14}/> Restore draft backup<input type="file" accept=".json" onChange={event => event.target.files?.[0] && void importDraftBackup(event.target.files[0])}/></label></div></section>
<section className="admin-card" data-workflow-stage="import" data-active={activeStage === 'import' || undefined}>
<div className="card-heading">
<div>
<span className="step">01</span>
<div>
<h2>Import references</h2>
<p>TXT, CSV, JSON, or pasted references. Use one TXT file per division for a unified pack; the existing single-file workflow remains available.</p>
</div>
</div>
<div className="import-file-actions"><label className="file-button">
<Upload size={15}/> Load file<input type="file" accept=".txt,.csv,.json" onChange={e => { const file = e.target.files?.[0]; if (file) { setSourceFiles([]); void loadFile(file, setInput); } }}/>
</label><label className="file-button">
<Upload size={15}/> Load TXT files<input type="file" accept=".txt" multiple onChange={e => e.target.files && void loadMultipleTextFiles(e.target.files)}/>
</label></div>
</div>
<div className="input-row">
<label>Season<select value={pack.year} onChange={e => setPack({ ...pack, year: Number(e.target.value), seasonName: e.target.value, seasonId: `season-${e.target.value}` })}>
<option value={2027}>2027</option>
<option value={2026}>2026</option>
</select>
</label>
<label>Division<select value={importDivision} onChange={e => setImportDivision(e.target.value as Division)}>
<option>Beginner</option>
<option>Junior</option>
<option>Intermediate</option>
<option>Experienced</option>
</select>
</label>
<select value={format} onChange={e => setFormat(e.target.value as typeof format)}>
<option value="auto">Auto detect</option>
<option value="txt">TXT</option>
<option value="csv">CSV</option>
<option value="json">JSON</option>
</select>
<span>{parsed.specs.length} reference rows · {parsedReferences.length} verses · {parsed.issues.length} input issues</span>
</div>
{sourceFiles.length > 0 && <div className="source-file-list" aria-label="Imported source files"><strong>Division files</strong>{sourceFiles.map(file => <div className="source-file-row" key={file.fileName}><span>{file.fileName}</span><select aria-label={`Division for ${file.fileName}`} value={file.division ?? ''} onChange={e => updateSourceDivision(file.fileName, e.target.value as Division | '')}><option value="">Assign division…</option><option value="Beginner" disabled={sourceFiles.some(other => other.fileName !== file.fileName && other.division === 'Beginner')}>Beginner</option><option value="Junior" disabled={sourceFiles.some(other => other.fileName !== file.fileName && other.division === 'Junior')}>Junior</option><option value="Intermediate" disabled={sourceFiles.some(other => other.fileName !== file.fileName && other.division === 'Intermediate')}>Intermediate</option><option value="Experienced" disabled={sourceFiles.some(other => other.fileName !== file.fileName && other.division === 'Experienced')}>Experienced</option></select>{file.division && <small>{sourceReports.find(report => report.fileName === file.fileName)?.parsed.specs.length ?? 0} rows · {sourceReports.find(report => report.fileName === file.fileName)?.parsed.issues.length ?? 0} issues</small>}</div>)}</div>}
<textarea className="large-input" value={input} onChange={e => setInput(e.target.value)} aria-label="Reference import"/>
<details>
<summary>Accepted formats</summary>
<code>John 3:16{`\n`}Beginner: Psalms 3:1{`\n`}CSV: reference,division,study{`\n`}JSON: [{`{"reference":"John 3:16","division":"Beginner","studyNumber":1}`} ]</code>
</details>
</section>
<section className="admin-card" data-workflow-stage="validate" data-active={activeStage === 'validate' || undefined}>
<div className="card-heading">
<div>
<span className="step">02</span>
<div>
<h2>Fetch KJV text</h2>
<p>Retrieves only the normalized imported passages from bible-api.com's KJV endpoint. Results are cached locally and verified against the requested references.</p>
</div>
</div>
<div className="fetch-actions">{fetching ? <button className="danger-button" onClick={() => controllerRef.current?.abort()}>
<StopCircle size={15}/> Cancel</button> : <>
<button className="connection-button" onClick={() => void testConnection()}>Test API Connection</button>
<button className="primary-button" disabled={!parsedReferences.length} onClick={() => void fetchText()}>
<RefreshCw size={15}/> Fetch KJV Text</button>
</>}</div>
</div>
<div className="source-callout">
<strong>Provider</strong>
<span>bible-api.com · KJV · no key · 15 requests / 30 seconds</span>
<a href="https://bible-api.com/" target="_blank" rel="noreferrer">Terms and API docs</a>
</div>{connectionMessage && <div className="connection-message">{connectionMessage}</div>}{retrievalProgress && <div className="progress-box">
<div>
<span>{retrievalProgress.completed}/{retrievalProgress.total} processed</span>
<span>{retrievalProgress.cached} cached · {retrievalProgress.failed} failed</span>
</div>
<progress value={retrievalProgress.completed} max={retrievalProgress.total || 1}/>
</div>}{failedReferences.length > 0 && !fetching && <button className="retry-button" onClick={() => void fetchText(failedReferences)}>
<RefreshCw size={14}/> Retry {failedReferences.length} failed verse{failedReferences.length === 1 ? '' : 's'}</button>}{message && <div className="success-line">
<CheckCircle2 size={15}/>{message}</div>}</section>
<section className="admin-card" data-workflow-stage="validate" data-active={activeStage === 'validate' || undefined}>
<div className="card-heading">
<div>
<span className="step">03</span>
<div>
<h2>Local KJV text fallback</h2>
<p>Optional fallback for offline preparation or when the API is unavailable. It never replaces a retrieved or manual correction silently.</p>
</div>
</div>
<label className="file-button">
<FileText size={15}/> Load local KJV text<input type="file" accept=".txt,.json,.usfm" onChange={e => e.target.files?.[0] && loadFile(e.target.files[0], setCorpusText)}/>
</label>
</div>
<textarea className="corpus-input" value={corpusText} onChange={e => setCorpusText(e.target.value)} placeholder={'Paste or load local KJV text like:\nJohn 3:16 | For God so loved the world…'} aria-label="Local KJV text"/>{corpusError && <div className="error-line">
<AlertTriangle size={15}/>{corpusError}</div>}<button className="secondary-button" onClick={runReview}>Review imported material</button>
</section>{review && <section className="admin-card" data-workflow-stage="review" data-active={activeStage === 'review' || undefined}>
<div className="card-heading">
<div>
<span className="step">04</span>
<div>
<h2>Review and correct</h2>
<p>{pack.seasonName} · {importDivision} · {review.references.length} expanded verse rows · missing and failed requests are never hidden.</p>
</div>
</div>
<span className={releaseReady ? 'valid-badge' : 'invalid-badge'}>{releaseReady ? <>
<CheckCircle2 size={15}/> Ready</> : <>
<AlertTriangle size={15}/> Blocked</>}</span>
</div>
<div className="review-summary">
<span>{report?.errors.length ?? 0} errors</span>
<span>{report?.warnings.length ?? 0} duplicate warnings</span>
<span>{Object.keys(corrections).length} manual corrections</span>
</div>
<div className="division-summary" aria-label="Division review summary">{divisionSummary.map(item => <div key={item.division}><strong>{item.division}</strong><span>{item.unique} unique verses · {item.rows} rows</span><small>{item.invalid} invalid · {item.duplicates} duplicates · {item.warnings} warnings</small></div>)}</div>
<div className="review-table">{review.issues.slice(0, 30).map((issue, index) => <div className="issue-row" key={`${issue.message}-${index}`}>
<AlertTriangle size={14}/>
<span>{issue.sourceFileName ? `${issue.sourceFileName}: ` : ''}{issue.message}</span>
</div>)}{review.references.slice(0, 100).map((row, index) => <div className="review-row" key={`${row.canonicalReference}-${row.divisions[0]}-${index}`}>
<strong>{row.canonicalReference}</strong>
<span>#{row.studyNumbers[row.divisions[0]] ?? '—'} · {row.divisions[0]}</span>
<p>{row.text ?? 'Missing verified text'}</p>
<small>{row.source === 'api' ? 'Retrieved API' : row.source === 'cache' ? 'Cached API' : row.source === 'manual' ? 'Manual correction' : 'Local KJV text'}</small>
</div>)}</div>
<div className="correction-form">
<input placeholder="Missing reference e.g. John 3:16" value={correctionRef} onChange={e => setCorrectionRef(e.target.value)}/>
<input placeholder="Verified KJV text" value={correctionText} onChange={e => setCorrectionText(e.target.value)}/>
<button onClick={addCorrection}>
<Plus size={15}/> Add audited correction</button>
</div>
</section>}<section className="admin-card" data-workflow-stage="analyze" data-active={activeStage === 'analyze' || undefined}>
<div className="card-heading">
<div>
<span className="step">05</span>
<div>
<h2>Analyze Scripture</h2>
<p>Run the deterministic division-wide analyzer locally. This creates a separate report and never changes Scripture text or the public pack.</p>
</div>
</div>
<div className="fetch-actions">
<button className="secondary-button" onClick={() => void runAnalysis()} disabled={!review || analysisRunning}>Run selected division</button><button className="secondary-button" onClick={() => void runAllAnalysis()} disabled={!review || analysisRunning}>Run all included divisions</button>{analysis && <button className="secondary-button" onClick={exportAnalysis}>
<Download size={15}/> Export analysis JSON</button>}</div>
</div>{analysisMessage && <div className="success-line">
<CheckCircle2 size={15}/>{analysisMessage}</div>}{analysis && <>
<label className="release-filename">Analysis filename<input value={analysisFilename || suggestedAnalysisFilename(filenamePack, importDivision, analysis.analysisVersion)} onChange={e => setAnalysisFilename(e.target.value)} /></label>
<div className="review-summary">
<span>{analysis.summary.versesAnalyzed} verses</span>
<span>{analysis.summary.uniqueBeginningsFound} unique beginnings · {analysis.summary.unresolvedBeginnings} unresolved</span>
<span>{analysis.summary.uniqueEndingsFound} unique endings · {analysis.summary.unresolvedEndings} unresolved</span>
<span>{analysis.summary.frequency1Words}/{analysis.summary.frequency2Words}/{analysis.summary.frequency3Words} words at frequency 1/2/3</span>
<span>{analysis.summary.annotations} annotations</span>
</div>{analysis.errors.length > 0 && <div className="error-line">
<AlertTriangle size={15}/>{analysis.errors.length} validation issues</div>}<div className="review-table analysis-review">{analysis.unresolved.slice(0, 100).map(item => <div className="issue-row" key={item.verseId}>
<AlertTriangle size={14}/>
<span>{item.kind}: {item.reference} — {item.reason}</span>
</div>)}{analysis.beginnings.filter(item => item.status === 'unique').slice(0, 30).map(item => <div className="review-row" key={item.verseId}>
<strong>{item.reference}</strong>
<span>#{item.studyNumber} · unique beginning</span>
<p>{item.phrase}</p>
<small>{item.start}–{item.end}</small>
</div>)}</div>
</>}</section>
{Object.keys(analysisReports).length > 0 && <section className="admin-card release-card"><div className="card-heading"><div><span className="step">06</span><div><h2>Release bundle</h2><p>One deterministic ZIP containing the unified pack, schema 1.1 division sidecars, manifest, and validation report.</p></div></div><span className={releaseValidation?.valid ? 'valid-badge' : 'invalid-badge'}>{releaseValidation?.valid ? <><CheckCircle2 size={15}/> Release ready</> : <><AlertTriangle size={15}/> Review required</>}</span></div><div className="division-summary">{Object.entries(analysisReports).map(([division, report]) => <div key={division}><strong>{division}</strong><span>{report.summary.versesAnalyzed} verses · {report.summary.annotations} annotations</span><small>{report.unresolved.length} unresolved boundaries</small></div>)}</div>{releaseValidation?.warnings.map(warning => <div className="warning-line" key={warning}><AlertTriangle size={14}/>{warning}</div>)}{releaseValidation?.errors.map(error => <div className="error-line" key={error}><AlertTriangle size={14}/>{error}</div>)}<label className="release-filename">ZIP filename<input value={releaseFilename} onChange={e => setReleaseFilename(e.target.value)} /></label><button className="export-button" disabled={!releaseValidation?.valid || analysisRunning} onClick={() => void exportRelease()}><Download size={16}/> Download release ZIP</button></section>}
<section className="admin-card">
<div className="card-heading">
<div>
<span className="step">07</span>
<div>
<h2>Export or install existing material</h2>
<p>New pack export requires valid references and verified text. You can independently install a previously exported approved pack into this browser without fetching Scripture or running analysis.</p>
</div>
</div>
</div>
<div className="pack-fields">
<label>Pack ID<input value={pack.id} onChange={e => setPack({ ...pack, id: e.target.value })}/>
</label>
<label>Title<input value={pack.title} onChange={e => { setPackTitleEdited(true); setPack({ ...pack, title: e.target.value }); }}/>
</label>
<label>Version<input value={pack.version} onChange={e => setPack({ ...pack, version: e.target.value })}/>
</label>
<label>Season<input value={pack.seasonName} onChange={e => setPack({ ...pack, seasonName: e.target.value })}/>
</label>
<label>Year<input type="number" value={pack.year} onChange={e => setPack({ ...pack, year: Number(e.target.value) })}/>
</label>
</div>
<div className="export-actions">
{!releaseReady && <div className="warning-line">New material export is unavailable until validation succeeds. Existing-pack installation remains available below.</div>}
<label className="release-filename">Pack filename<input value={packFilename || suggestedMaterialFilename(filenamePack)} onChange={e => setPackFilename(e.target.value)} /></label><button className="export-button" disabled={!releaseReady} onClick={exportPack}>
<Download size={16}/> Export versioned JSON pack</button>
<label className="file-button">
<Upload size={15}/> Install exported pack locally<input type="file" accept=".json" onChange={e => e.target.files?.[0] && void installPackFile(e.target.files[0])}/>
</label>
</div>
</section>
</main>
{showHelp && <AdminHelp onClose={() => setShowHelp(false)} />}
</div>;
}

export function AdminHelp({ onClose }: { onClose: () => void }) {
  return <div className="admin-help-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admin-help-panel" role="dialog" aria-modal="true" aria-labelledby="admin-help-title">
      <div className="admin-help-heading"><div><span className="admin-kicker">BQ SEARCH</span><h2 id="admin-help-title">Material Manager help</h2><p>Prepare files in your browser, then download them for a maintainer to add to the public app.</p></div><button className="icon-button" onClick={onClose} aria-label="Close help"><X size={17}/></button></div>
      <div className="admin-help-grid">
        <article><h3>Getting started</h3><p>If you see saved work, choose Resume Existing Work or Start New Material. Otherwise begin with Import. Work through Import, Validate, Analyze, Review, and Import / Export; you can visit any step at any time.</p></article>
        <article><h3>Start a material year</h3><p>Prepare one TXT reference file per division, load the files together, check the suggested assignments, fetch Scripture text or load a local KJV file, validate, run analysis, review warnings, and download the complete release ZIP.</p></article>
        <article><h3>Update existing material</h3><p>Install an approved material pack from Import / Export without running preparation again. For corrections, keep the original download safe, import a copy, review every warning, and generate a new version.</p></article>
        <article><h3>What gets downloaded</h3><p>A complete release contains the material pack, one analysis file per included division, a file list, and a validation report. Downloads do not publish anything and never write to GitHub.</p></article>
        <article><h3>Color Coding</h3><p>Formatting defaults are edited under Options. Unique beginnings and endings, 1x/2x/3x words, presets, and live previews are separate from Scripture text. Re-run analysis when the material changes.</p></article>
        <article><h3>Drafts and backups</h3><p>Unfinished work is saved in this browser. Use the draft backup controls in Options to move work between computers; those JSON backups are unencrypted. Clearing browser data can remove drafts and preferences.</p></article>
        <article><h3>Troubleshooting</h3><p>Missing text or failed retrieval must be corrected before export. Check division assignments and duplicates in Validate. If a release is rejected, read the exact warnings and errors in Review, then rerun analysis.</p></article>
        <article><h3>Offline limits</h3><p>Parsing, validation, analysis, and release generation work offline once the app is loaded. Fetch KJV Text and Test API Connection need internet access. A local KJV file is the offline fallback.</p></article>
      </div>
      <p className="admin-help-footer">To update BQ Search, download the approved files and manually copy them into <code>public/packs/</code>, <code>public/analysis/</code>, and the release registry under <code>public/releases/</code>. Run the documented validation and build commands before publishing.</p>
    </section>
  </div>;
}
