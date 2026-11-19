import { useMemo, useRef, useState } from 'react';
import type { GeneratedQuiz, QuizCatalog, UserCollection, UserQuestion } from '../types';
import { displayClassification, formatReference, parseQuestionReferences } from '../v5-format';
import { parseCsvImport, parseJsonImport, type ImportReport } from './importers';
import { commitUserContent, deleteUserCollection, deleteUserQuestion, saveUserCollection, saveUserQuestion } from '../storage/user-storage';

type Props = {
  catalog: QuizCatalog;
  userQuestions: UserQuestion[];
  userCollections: UserCollection[];
  customQuizzes: GeneratedQuiz[];
  onChanged: () => Promise<void>;
  onExport: () => void;
};
const emptyForm = { collectionId: '', rawQuestion: '', rawAnswer: '', pointValue: '10', classification: '', references: '' };

export function QuestionBankV5({ catalog, userQuestions, userCollections, customQuizzes, onChanged, onExport }: Props) {
  const [search, setSearch] = useState('');
  const [collectionId, setCollectionId] = useState('all');
  const [editing, setEditing] = useState<UserQuestion | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [message, setMessage] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const collections = useMemo(() => [...catalog.collections, ...userCollections], [catalog, userCollections]);
  const matches = useMemo(() => [
    ...catalog.questions.map(question => ({ question, userQuestion: undefined })),
    ...userQuestions.map(question => ({ question, userQuestion: question })),
  ].filter(({ question }) => {
    const text = `${question.rawQuestion} ${question.rawAnswer} ${question.references.map(formatReference).join(' ')}`;
    return (collectionId === 'all' || question.collectionId === collectionId) && text.toLowerCase().includes(search.toLowerCase());
  }), [catalog.questions, userQuestions, collectionId, search]);

  const write = async (action: () => Promise<void>) => {
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update quiz data.'); }
  };

  const closeEditor = () => { setEditing(null); setForm(emptyForm); setEditorOpen(false); };
  const beginAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, collectionId: userCollections[0]?.id ?? '' });
    setEditorOpen(true);
  };
  const beginEdit = (q: UserQuestion) => {
    setEditing(q);
    setForm({ collectionId: q.collectionId, rawQuestion: q.rawQuestion, rawAnswer: q.rawAnswer, pointValue: String(q.pointValue), classification: q.classification ?? '', references: q.references.map(formatReference).join('; ') });
    setEditorOpen(true);
  };

  const saveQuestion = () => write(async () => {
    const rawQuestion = form.rawQuestion.trim();
    const rawAnswer = form.rawAnswer.trim();
    const pointValue = Number(form.pointValue) as UserQuestion['pointValue'];
    const target = userCollections.find(collection => collection.id === form.collectionId);
    if (!target || !rawQuestion || !rawAnswer || ![10, 20, 30].includes(pointValue)) throw new Error('Choose a user collection and provide a question, answer, and point value.');
    const references = editing && form.references === editing.references.map(formatReference).join('; ')
      ? editing.references : parseQuestionReferences(form.references);
    const original = editing ?? {
      id: `user-q-${crypto.randomUUID()}`,
      quizNumber: 0,
      originalNumber: userQuestions.filter(q => q.collectionId === target.id).length + 1,
    };
    await saveUserQuestion({
      ...original, collectionId: target.id, rawQuestion, rawAnswer, pointValue, references,
      classification: form.classification.trim() || undefined,
      source: { ...(editing?.source ?? { documentId: 'user-created', page: 0 }), publisher: target.publisher, collection: target.name },
      textRevision: editing ? `${editing.textRevision}-edit` : 'user-v1',
    });
    closeEditor();
    setMessage('Question saved locally.');
    await onChanged();
  });

  const duplicate = (q: UserQuestion) => write(async () => {
    await saveUserQuestion({ ...q, id: `user-q-${crypto.randomUUID()}`, originalNumber: userQuestions.length + 1, textRevision: 'user-v1' });
    await onChanged();
  });

  const removeQuestion = (q: UserQuestion) => write(async () => {
    if (!confirm('Delete this user question? Saved practice history remains.')) return;
    await deleteUserQuestion(q.id);
    if (editing?.id === q.id) closeEditor();
    await onChanged();
  });

  const editCollection = (collection?: UserCollection) => write(async () => {
    const name = prompt('Collection name', collection?.name)?.trim();
    if (!name) return;
    const publisher = prompt('Publisher/source', collection?.publisher ?? 'Personal')?.trim() || collection?.publisher || 'Personal';
    const defaultYear = collection?.year ?? new Date().getFullYear();
    const year = Number(prompt('Year', String(defaultYear))) || defaultYear;
    await saveUserCollection({
      ...(collection ?? { id: `user-${crypto.randomUUID()}`, sourceFilename: 'user-created', quizIds: [], bundled: false }),
      name, publisher, year,
    });
    await onChanged();
  });

  const removeCollection = (collection: UserCollection) => write(async () => {
    const ownedIds = new Set(userQuestions.filter(q => q.collectionId === collection.id).map(q => q.id));
    const dependent = customQuizzes.filter(quiz => quiz.questionIds.some(id => ownedIds.has(id))).length;
    const warning = dependent ? `This collection is used by ${dependent} saved quiz${dependent === 1 ? '' : 'zes'}. Delete anyway?`
      : `Delete ${collection.name} and its ${ownedIds.size} user question${ownedIds.size === 1 ? '' : 's'}? Saved practice history remains.`;
    if (!confirm(warning)) return;
    await deleteUserCollection(collection.id);
    if (form.collectionId === collection.id) closeEditor();
    if (collectionId === collection.id) setCollectionId('all');
    await onChanged();
  });

  const readImport = async (selected: File) => {
    setPreview(null);
    setMessage('');
    try {
      const text = await selected.text();
      setPreview(selected.name.toLowerCase().endsWith('.csv') ? parseCsvImport(text) : parseJsonImport(JSON.parse(text)));
    } catch {
      setMessage('Unable to read the import file. Choose a valid CSV or JSON file.');
    }
  };

  const importPlan = useMemo(() => {
    if (!preview) return undefined;
    const reservedIds = new Set(catalog.collections.map(collection => collection.id));
    const userIds = new Set(userCollections.map(collection => collection.id));
    const questionIds = new Set([...catalog.questions, ...userQuestions].map(question => question.id));
    const pendingCollections = preview.collections.filter(collection => !reservedIds.has(collection.id) && !userIds.has(collection.id));
    const destinationIds = new Set([...userIds, ...pendingCollections.map(collection => collection.id)]);
    const pendingQuestions = preview.questions.filter(question => !reservedIds.has(question.collectionId) && !questionIds.has(question.id));
    const unknown = pendingQuestions.filter(question => !destinationIds.has(question.collectionId));
    return {
      collections: pendingCollections,
      questions: pendingQuestions,
      errors: [...preview.errors, ...unknown.map(question => `Question ${question.id} refers to a missing user collection.`)],
      skipped: preview.collections.length + preview.questions.length - pendingCollections.length - pendingQuestions.length,
    };
  }, [preview, catalog, userCollections, userQuestions]);

  const commitImport = () => write(async () => {
    if (!importPlan || importPlan.errors.length || preview?.duplicateIds.length) return;
    await commitUserContent(importPlan.collections, importPlan.questions);
    setMessage(`Imported ${importPlan.questions.length} user questions and ${importPlan.collections.length} collections.`);
    setPreview(null);
    await onChanged();
  });

  return (
    <section className="bqquiz-v5 page question-bank-v5">
      <div className="page-title">
        <div><span className="overline">QUESTION BANK</span><h1>Questions</h1><p>{matches.length} matching questions</p></div>
        <div className="bank-actions">
          <button className="button" onClick={() => void editCollection()}>New collection</button>
          <button className="button" onClick={beginAdd}>Add question</button>
          <button className="button" onClick={() => file.current?.click()}>Import</button>
          <button className="button" onClick={onExport}>Export</button>
          <input ref={file} hidden type="file" accept=".csv,.json" onChange={e => {
            const selected = e.target.files?.[0];
            if (selected) void readImport(selected);
            e.target.value = '';
          }}/>
        </div>
      </div>
      <div className="filter-bar">
        <input aria-label="Search questions" placeholder="Search question, answer, or reference" value={search} onChange={e => setSearch(e.target.value)}/>
        <select aria-label="Collection filter" value={collectionId} onChange={e => setCollectionId(e.target.value)}>
          <option value="all">All collections</option>
          {collections.map(c => <option value={c.id} key={c.id}>{c.publisher} · {c.name}</option>)}
        </select>
      </div>
      {userCollections.length > 0 && <div className="collection-tools">
        <strong>My collections</strong>
        {userCollections.map(c => <span key={c.id}>{c.name}
          <button className="text-button" onClick={() => void editCollection(c)}>Edit</button>
          <button className="text-button danger" onClick={() => void removeCollection(c)}>Delete</button>
        </span>)}
      </div>}
      {message && <div className="quiz-message" role="status">{message}<button onClick={() => setMessage('')}>Dismiss</button></div>}
      {editorOpen && <div className="editor-panel">
        <div className="block-heading"><strong>{editing ? 'Edit question' : 'Add question'}</strong><button className="text-button" onClick={closeEditor}>Cancel</button></div>
        <select aria-label="Question collection" value={form.collectionId} onChange={e => setForm({ ...form, collectionId: e.target.value })}>
          <option value="">Select collection</option>
          {userCollections.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
        <textarea aria-label="Question text" placeholder="Question text" value={form.rawQuestion} onChange={e => setForm({ ...form, rawQuestion: e.target.value })}/>
        <textarea aria-label="Answer text" placeholder="Answer text" value={form.rawAnswer} onChange={e => setForm({ ...form, rawAnswer: e.target.value })}/>
        <div className="editor-grid">
          <select aria-label="Point value" value={form.pointValue} onChange={e => setForm({ ...form, pointValue: e.target.value })}>
            {[10, 20, 30].map(points => <option key={points} value={points}>{points} points</option>)}
          </select>
          <input aria-label="Classification" placeholder="Classification" value={form.classification} onChange={e => setForm({ ...form, classification: e.target.value })}/>
          <input aria-label="Scripture references" placeholder="Psalm 5:8; Psalm 18:20" value={form.references} onChange={e => setForm({ ...form, references: e.target.value })}/>
        </div>
        <button className="button primary" onClick={() => void saveQuestion()}>{editing ? 'Save question' : 'Add question'}</button>
      </div>}
      {preview && importPlan && <div className="import-preview">
        <strong>Import preview</strong>
        <span>{preview.collections.length} collections · {preview.questions.length} questions</span>
        <span>{[10, 20, 30].map(point => `${point}: ${preview.questions.filter(q => q.pointValue === point).length}`).join(' · ')}</span>
        {importPlan.skipped > 0 && <span>Existing or published IDs will be skipped: {importPlan.skipped}</span>}
        {preview.duplicateIds.length > 0 && <span>Duplicate IDs: {preview.duplicateIds.join(', ')}</span>}
        {preview.warnings.length > 0 && <pre>{preview.warnings.join('\n')}</pre>}
        {importPlan.errors.length > 0 && <pre>{importPlan.errors.join('\n')}</pre>}
        <button className="button primary" disabled={importPlan.errors.length > 0 || preview.duplicateIds.length > 0} onClick={() => void commitImport()}>Commit import</button>
        <button className="text-button" onClick={() => setPreview(null)}>Cancel</button>
      </div>}
      <div className="counts-strip">
        <span><b>{matches.length}</b> matching</span>
        {[10, 20, 30].map(points => <span key={points}><b>{matches.filter(({ question }) => question.pointValue === points).length}</b> {points}-point</span>)}
      </div>
      <div className="bank-list">{matches.map(({ question: q, userQuestion }) => <details className="bank-item" key={q.id}>
        <summary><span className="bank-number">{q.originalNumber || '—'}</span><span>
          <strong>{q.rawQuestion}</strong>
          <small>{q.source?.publisher ?? 'Imported'} · {q.collectionId} · {q.pointValue} points</small>
        </span></summary>
        <div className="bank-detail">
          <p><b>Answer</b> {q.rawAnswer}</p>
          <p><b>References</b> {q.references.length ? q.references.map(formatReference).join(' · ') : 'None'}</p>
          <p><b>Type</b> {displayClassification(q.classification)}</p>
          {userQuestion && <div>
            <button className="text-button" onClick={() => beginEdit(userQuestion)}>Edit</button>
            <button className="text-button" onClick={() => void duplicate(userQuestion)}>Duplicate</button>
            <button className="text-button danger" onClick={() => void removeQuestion(userQuestion)}>Delete</button>
          </div>}
          <button className="text-button" onClick={() => alert(`${q.rawQuestion}\n\nANS. ${q.rawAnswer}`)}>Preview</button>
        </div>
      </details>)}</div>
    </section>
  );
}
