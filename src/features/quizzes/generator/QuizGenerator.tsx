import { useEffect, useMemo, useRef, useState } from 'react';
import { packReferenceKey } from '../../../integration/scripture-provider';
import type { Division, ScripturePack } from '../../../types';
import { analyzeQuestionPool, DEFAULT_POINT_COUNTS, generateFromPool, generatedQuizFromSelection, POINT_VALUES, questionPublisher, randomSeed, studyOptions, type PointCounts } from '../generator';
import { listCoveragePresets, saveCoveragePreset, saveGeneratedQuiz } from '../storage/generator-storage';
import type { CoveragePreset, GeneratedQuiz, GenerationFilters, GenerationStrategy, QuizCatalog, QuizQuestion, StudyOption, UserCollection, UserQuestion } from '../types';
import { formatReference } from '../v5-format';
import { classificationKey, classificationLabel } from './classifications';
import './quiz-generator.css';

type Props = {
  catalog: QuizCatalog;
  userCollections: UserCollection[];
  userQuestions: UserQuestion[];
  pack: ScripturePack;
  division: Division;
  studyStart: number;
  studyEnd: number;
  onSaved: () => Promise<void>;
  onLaunch: (quiz: GeneratedQuiz) => void;
};

type Choice = { key: string; label: string };
type Preview = { seed: number; key: string; questions: { id: string; revision: string }[] };
type GeneratorDraft = {
  endpoints: { start: string; end: string };
  restrictCoverage: boolean;
  title: string;
  defaultDistribution: boolean;
  counts: PointCounts;
  strategy: GenerationStrategy;
  selectedCollections?: string[];
  selectedPublishers?: string[];
  selectedTypes?: string[];
  presetId: string;
  preview?: Preview;
};
const studyLabel = (option: StudyOption) => `#${option.studyNumber} · ${formatReference(option.reference)}`;
const choices = (labels: Iterable<string>) => [...new Set(labels)].sort((a, b) => a.localeCompare(b)).map(label => ({ key: label, label }));
const selection = (items: Choice[], selected?: string[]) => items.filter(item => !selected || selected.includes(item.key)).map(item => item.key);

function resolveStoredOption(options: StudyOption[], text: string) {
  const input = text.trim().toLowerCase();
  if (!input) return undefined;
  const byId = options.find(item => item.verseId.toLowerCase() === input);
  if (byId) return byId;
  if (/^#?\d+$/.test(input)) return options.find(item => item.studyNumber === Number(input.replace('#', '')));
  const labeled = options.find(item => input === studyLabel(item).toLowerCase());
  if (labeled) return labeled;
  return undefined;
}

function loadDraft(key: string): GeneratorDraft | undefined {
  try {
    const draft: GeneratorDraft | null = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (typeof draft?.endpoints?.start === 'string' && typeof draft.endpoints.end === 'string') return draft;
  } catch {
    // The draft is optional. Start from the active division if it is unavailable.
  }
}

function VerseEndpoint({ label, options, selected, onChange }: {
  label: string; options: StudyOption[]; selected?: StudyOption; onChange: (value: string) => void;
}) {
  return <label className="generator-field generator-endpoint"><span>{label}</span>
    <select aria-label={label} value={selected?.verseId ?? ''} onChange={event => onChange(event.target.value)}>
      <option value="" disabled>Choose a verse</option>
      {options.map(option => <option key={option.verseId} value={option.verseId}>{studyLabel(option)}</option>)}
    </select>
  </label>;
}

function FilterChoices({ label, options, selected, onChange, query }: {
  label: string;
  options: Choice[];
  selected: string[];
  onChange: (value: string[] | undefined) => void;
  query?: string;
}) {
  const search = query?.trim().toLowerCase() ?? '';
  const shown = options.filter(option => option.label.toLowerCase().includes(search));
  return (
    <div className="generator-filter" role="group" aria-label={label}>
      <div className="generator-filter-actions">
        <button type="button" className="quiz-link" onClick={() => onChange(undefined)}>Select all</button>
        <button type="button" className="quiz-link" onClick={() => onChange([])}>Clear all</button>
      </div>
      {shown.length > 0 ? <div className="generator-checklist">{shown.map(option => (
        <label className="generator-check" key={option.key}>
          <input type="checkbox" checked={selected.includes(option.key)} onChange={event => {
            onChange(event.target.checked ? [...selected, option.key] : selected.filter(key => key !== option.key));
          }}/>
          <span>{option.label}</span>
        </label>
      ))}</div> : <p className="generator-note">{search ? 'No matching types.' : 'No options available.'}</p>}
    </div>
  );
}

export function QuizGenerator({ catalog, userCollections, userQuestions, pack, division, studyStart, studyEnd, onSaved, onLaunch }: Props) {
  const questions = useMemo(() => [...catalog.questions, ...userQuestions], [catalog.questions, userQuestions]);
  const collections = useMemo(() => [...catalog.collections, ...userCollections], [catalog.collections, userCollections]);
  const collectionPublishers = useMemo(() => new Map(collections.map(collection => [collection.id, collection.publisher])), [collections]);
  const collectionChoices = useMemo(() => collections.map(collection => ({ key: collection.id, label: `${collection.publisher} · ${collection.name}` })), [collections]);
  const publisherChoices = useMemo(() => choices(questions.map(question => questionPublisher(question, collectionPublishers))), [questions, collectionPublishers]);
  const typeChoices = useMemo(() => [...new Map(questions.map(question => [classificationKey(question.classification), classificationLabel(question.classification)])).entries()]
    .map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label)), [questions]);
  const options = useMemo(() => studyOptions(pack, division), [pack, division]);
  const draftKey = `bqsearch-generator-draft-v1:${JSON.stringify([pack.id, pack.version, division, studyStart, studyEnd])}`;
  const [stored] = useState(() => loadDraft(draftKey));
  const defaultStart = options.find(option => option.studyNumber >= studyStart);
  const endIndex = options.findIndex(option => option.studyNumber > studyEnd);
  const defaultEnd = options[(endIndex < 0 ? options.length : endIndex) - 1];
  const [endpoints, setEndpoints] = useState(stored?.endpoints ?? {
    start: defaultStart?.verseId ?? '',
    end: defaultEnd?.verseId ?? '',
  });
  const [restrictCoverage, setRestrictCoverage] = useState(stored?.restrictCoverage ?? true);
  const [title, setTitle] = useState(stored?.title ?? 'Generated quiz');
  const [defaultDistribution, setDefaultDistribution] = useState(stored?.defaultDistribution ?? true);
  const [counts, setCounts] = useState<PointCounts>(stored?.counts ?? { ...DEFAULT_POINT_COUNTS });
  const [strategy, setStrategy] = useState<GenerationStrategy>(stored?.strategy ?? 'balanced');
  const [selectedCollections, setSelectedCollections] = useState(stored?.selectedCollections);
  const [selectedPublishers, setSelectedPublishers] = useState(stored?.selectedPublishers);
  const [selectedTypes, setSelectedTypes] = useState(stored?.selectedTypes);
  const [typeSearch, setTypeSearch] = useState('');
  const [presets, setPresets] = useState<CoveragePreset[]>([]);
  const [presetId, setPresetId] = useState(stored?.presetId ?? '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(stored?.preview);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const focusPreview = useRef(false);

  useEffect(() => {
    const draft: GeneratorDraft = {
      endpoints, restrictCoverage, title, defaultDistribution, counts, strategy,
      selectedCollections, selectedPublishers, selectedTypes, presetId, preview,
    };
    try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* Draft storage is optional. */ }
  }, [draftKey, endpoints, restrictCoverage, title, defaultDistribution, counts, strategy,
    selectedCollections, selectedPublishers, selectedTypes, presetId, preview]);

  useEffect(() => {
    void listCoveragePresets().then(setPresets, () => setMessage('Unable to load coverage presets.'));
  }, []);

  const start = useMemo(() => resolveStoredOption(options, endpoints.start), [options, endpoints.start]);
  const end = useMemo(() => resolveStoredOption(options, endpoints.end), [options, endpoints.end]);
  const range = useMemo(() => start && end && start.studyNumber <= end.studyNumber ? {
    start: start.reference, end: end.reference, startStudyNumber: start.studyNumber, endStudyNumber: end.studyNumber,
  } : undefined, [start, end]);
  const pointCounts = defaultDistribution ? DEFAULT_POINT_COUNTS : counts;
  const filters = useMemo<GenerationFilters>(() => ({
    collectionIds: selection(collectionChoices, selectedCollections),
    publisherIds: selection(publisherChoices, selectedPublishers),
    classifications: selection(typeChoices, selectedTypes),
    selectionMode: 'explicit', pointCounts, restrictCoverage, coverage: restrictCoverage ? range : undefined,
    strategy, seasonId: pack.season.id, division, packId: pack.id,
  }), [collectionChoices, selectedCollections, publisherChoices, selectedPublishers, typeChoices, selectedTypes,
    pointCounts, restrictCoverage, range, strategy, pack.season.id, division, pack.id]);
  const configurationKey = JSON.stringify([filters, pack.version, catalog.catalogVersion]);
  const availability = useMemo(() => analyzeQuestionPool(questions, filters, pack, collectionPublishers),
    [questions, filters, pack, collectionPublishers]);
  const currentPreview = useMemo(() => {
    if (!preview || preview.key !== configurationKey) return undefined;
    try {
      const selected = generateFromPool(availability, filters, preview.seed);
      if (selected.length === preview.questions.length && selected.every((question, index) =>
        question.id === preview.questions[index].id && question.textRevision === preview.questions[index].revision)) {
        return { seed: preview.seed, questions: selected };
      }
    } catch { /* The pool may have changed since this preview was generated. */ }
    return undefined;
  }, [preview, configurationKey, availability, filters]);
  const questionCount = POINT_VALUES.reduce((sum, point) => sum + pointCounts[point], 0);
  const totalPoints = POINT_VALUES.reduce((sum, point) => sum + pointCounts[point] * point, 0);
  const coveredVerses = range ? options.filter(option => option.studyNumber >= range.startStudyNumber && option.studyNumber <= range.endStudyNumber).length : 0;

  useEffect(() => {
    if (focusPreview.current && currentPreview && previewHeading.current) {
      focusPreview.current = false;
      previewHeading.current.focus({ preventScroll: true });
      previewHeading.current.scrollIntoView({ block: 'start' });
    }
  }, [currentPreview]);

  const generate = () => {
    if (restrictCoverage && !range) {
      setMessage('Choose valid start and end verses in study order.');
      return;
    }
    try {
      const seed = randomSeed();
      const selected = generateFromPool(availability, filters, seed);
      focusPreview.current = true;
      setPreview({ questions: selected.map(question => ({ id: question.id, revision: question.textRevision })), seed, key: configurationKey });
      setMessage('');
    } catch (error) {
      setPreview(undefined);
      setMessage(error instanceof Error ? error.message : 'Unable to generate the quiz.');
    }
  };

  const save = async () => {
    if (!currentPreview || saving) return;
    setSaving(true);
    try {
      const quiz = generatedQuizFromSelection(title, currentPreview.questions, currentPreview.seed, filters, catalog.catalogId, catalog.catalogVersion);
      await saveGeneratedQuiz(quiz);
      setPreview(undefined);
      await onSaved();
    } catch {
      setMessage('Unable to save or open the saved quiz list.');
    } finally {
      setSaving(false);
    }
  };

  const launch = () => {
    if (!currentPreview) return;
    onLaunch(generatedQuizFromSelection(title, currentPreview.questions, currentPreview.seed, filters, catalog.catalogId, catalog.catalogVersion));
  };

  const savePreset = async () => {
    if (!range || !restrictCoverage) return;
    const name = prompt('Preset name')?.trim();
    if (!name) return;
    const preset: CoveragePreset = {
      id: `preset-${crypto.randomUUID()}`, name, range, seasonId: pack.season.id,
      division, packId: pack.id, catalogId: catalog.catalogId, updatedAt: new Date().toISOString(),
    };
    try {
      await saveCoveragePreset(preset);
      setPresets(await listCoveragePresets());
      setPresetId(preset.id);
      setMessage('Coverage preset saved locally.');
    } catch {
      setMessage('Unable to save the coverage preset.');
    }
  };

  const loadPreset = (id: string) => {
    const preset = presets.find(item => item.id === id);
    if (!preset) { setPresetId(''); return; }
    if ((preset.packId && preset.packId !== pack.id) || (preset.division && preset.division !== division) || (preset.seasonId && preset.seasonId !== pack.season.id)) {
      setMessage('This preset belongs to a different season, division, or Scripture pack.');
      return;
    }
    try {
      const find = (reference: StudyOption['reference'], number?: number) => options.find(option =>
        (number === undefined || option.studyNumber === number) && packReferenceKey(option.reference) === packReferenceKey(reference));
      const nextStart = find(preset.range.start, preset.range.startStudyNumber);
      const nextEnd = find(preset.range.end, preset.range.endStudyNumber);
      if (!nextStart || !nextEnd || nextStart.studyNumber > nextEnd.studyNumber) throw new Error();
      setEndpoints({ start: nextStart.verseId, end: nextEnd.verseId });
      setRestrictCoverage(true);
      setPresetId(id);
      setMessage('Coverage preset restored.');
    } catch {
      setMessage('This preset’s references are unavailable in the active pack and division.');
    }
  };

  const changeEndpoint = (key: 'start' | 'end', value: string) => {
    if (endpoints[key] === value) return;
    setEndpoints(previous => ({ ...previous, [key]: value }));
    setPresetId('');
    setMessage('');
  };

  return (
    <section className="quiz-generator" aria-labelledby="generator-heading">
      <div className="quiz-page-heading">
        <div><span className="context-label">QUIZZES · GENERATOR</span><h1 id="generator-heading">Generate quiz</h1></div>
        <div className="generator-total"><strong>{questionCount}</strong><span>questions · {totalPoints} possible points</span></div>
      </div>
      <div className="generator-workspace">
        <div className="generator-setup">
          <label className="generator-field"><span>Title</span><input value={title} onChange={event => setTitle(event.target.value)}/></label>
          <section className="generator-section" aria-labelledby="generator-coverage">
            <div className="generator-section-heading"><h2 id="generator-coverage">Coverage</h2>
              <button className="quiz-link" disabled={!range || !restrictCoverage} onClick={() => void savePreset()}>Save preset</button>
            </div>
            <label className="generator-check">
              <input type="checkbox" checked={restrictCoverage} onChange={event => { setRestrictCoverage(event.target.checked); setPresetId(''); }}/>
              <span>Restrict to selected study range</span>
            </label>
            {restrictCoverage ? <>
              <div className="generator-range-fields">
                <VerseEndpoint label="Start Verse" options={options} selected={start}
                  onChange={value => changeEndpoint('start', value)}/>
                <VerseEndpoint label="End Verse" options={options} selected={end}
                  onChange={value => changeEndpoint('end', value)}/>
              </div>
              <p className="generator-note">{range ? `${coveredVerses} study ${coveredVerses === 1 ? 'verse' : 'verses'} selected` :
                start && end ? 'End Verse must be at or after Start Verse.' :
                  'Enter a reference such as Psalms 3:1 or a study number, or browse the active division.'}</p>
            </> : <p className="generator-note">Unrestricted coverage includes questions without references.</p>}
            {presets.length > 0 && <label className="generator-field"><span>Coverage preset</span>
              <select value={presetId} onChange={event => loadPreset(event.target.value)}><option value="">Choose a saved preset</option>
                {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
            </label>}
          </section>
          <section className="generator-section" aria-labelledby="generator-distribution">
            <h2 id="generator-distribution">Point distribution</h2>
            <label className="generator-check"><input aria-label="Default distribution" type="checkbox" checked={defaultDistribution} onChange={event => {
              setDefaultDistribution(event.target.checked);
              if (event.target.checked) setCounts({ ...DEFAULT_POINT_COUNTS });
            }}/><span>Default distribution (8 / 9 / 3)</span></label>
            <div className="generator-count-fields">{POINT_VALUES.map(point => <label className="generator-field" key={point}>
              <span>{point} points</span><input aria-label={`${point}-point questions`} type="number" min={0} step={1} disabled={defaultDistribution} value={pointCounts[point]}
                onChange={event => setCounts({ ...counts, [point]: event.target.valueAsNumber || 0 })}/>
            </label>)}</div>
          </section>
          <fieldset className="generator-section generator-strategy"><legend>Selection strategy</legend>
            <label className="generator-check"><input name="quiz-strategy" type="radio" checked={strategy === 'balanced'} onChange={() => setStrategy('balanced')}/><span>Balanced across chapters</span></label>
            <label className="generator-check"><input name="quiz-strategy" type="radio" checked={strategy === 'random'} onChange={() => setStrategy('random')}/><span>Fully random</span></label>
          </fieldset>
        </div>
        <div className="generator-filters">
          <section className="generator-section" aria-labelledby="generator-collections">
            <div className="generator-section-heading"><h2 id="generator-collections">Collections</h2><span>{filters.collectionIds.length} selected</span></div>
            <FilterChoices label="Collections" options={collectionChoices} selected={filters.collectionIds} onChange={setSelectedCollections}/>
          </section>
          <section className="generator-section" aria-labelledby="generator-publishers">
            <div className="generator-section-heading"><h2 id="generator-publishers">Publishers</h2><span>{filters.publisherIds.length} selected</span></div>
            <FilterChoices label="Publishers" options={publisherChoices} selected={filters.publisherIds} onChange={setSelectedPublishers}/>
          </section>
          <section className="generator-section generator-type-picker" aria-labelledby="generator-types">
            <div className="generator-section-heading"><h2 id="generator-types">Question types</h2><span>{filters.classifications.length} selected</span></div>
            <label className="generator-field"><span>Search question types</span><input type="search" value={typeSearch} onChange={event => setTypeSearch(event.target.value)}/></label>
            <FilterChoices label="Question types" options={typeChoices} selected={filters.classifications} onChange={setSelectedTypes} query={typeSearch}/>
          </section>
          <div className="generator-section generator-availability" aria-label="Eligible question summary">
            <strong>{availability.pool.length} eligible questions</strong>
            {POINT_VALUES.map(point => <div className={`availability-row ${availability.counts[point] < pointCounts[point] ? 'short' : ''}`} key={point}>
              <span>{point}-point pool</span><b>{availability.counts[point]}</b><small>need {pointCounts[point]}</small>
            </div>)}
            {availability.diagnostics.noStructuredReference > 0 && <p className="generator-note">
              {availability.diagnostics.noStructuredReference} excluded: no structured Scripture reference.
            </p>}
            {availability.diagnostics.unavailableReferences > 0 && <p className="generator-note">
              {availability.diagnostics.unavailableReferences} excluded: references unavailable in the active division.
            </p>}
          </div>
        </div>
        <div className="generator-run">
          <button aria-label="Generate quiz" className="primary-button generator-button" onClick={generate}>Generate selection</button>
          {message && <p className="quiz-message" role="status">{message}</p>}
        </div>
        {currentPreview && <section className="generator-section generator-selection" aria-labelledby="generator-preview">
          <div className="generator-section-heading">
            <h2 id="generator-preview" ref={previewHeading} tabIndex={-1}>Preview</h2>
            <button className="quiz-link" disabled={saving} onClick={generate}>Regenerate</button>
          </div>
          <ol>{currentPreview.questions.map(question => (
            <li key={question.id} data-question-id={question.id}>
              <details>
                <summary><span>{question.rawQuestion}</span><small>{question.pointValue} pts · {classificationLabel(question.classification)}</small></summary>
                <p><b>ANS.</b> {question.rawAnswer}</p>
                <small>{question.source?.publisher && `${question.source.publisher} · `}
                  {question.references.length ? question.references.map(formatReference).join(' · ') : 'No structured reference'}</small>
              </details>
            </li>
          ))}</ol>
          <div className="generator-preview-actions">
            <button className="primary-button" onClick={launch}>Start quiz</button>
            <button aria-label="Save generated quiz" className="secondary-button" disabled={saving} onClick={() => void save()}>Save for later</button>
          </div>
        </section>}
      </div>
    </section>
  );
}
