import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Clipboard, Download, Moon, Search, Settings2, ShieldCheck, Sun, Wifi, WifiOff, X } from 'lucide-react';
import { demoPack } from './data/demoPack';
import { searchVerses } from './search';
import { downloadPack, getPacks, getSettings, savePack, saveSettings } from './storage';
import type { Division, ScripturePack, SearchResult, TournamentSettings } from './types';

type View = 'search' | 'settings' | 'manager';
const defaults: TournamentSettings = { seasonId: demoPack.season.id, division: 'Seniors', studyStart: 1, studyEnd: 999, installedPackId: demoPack.id };

export default function App() {
  const [view, setView] = useState<View>('search');
  const [query, setQuery] = useState('');
  const [packs, setPacks] = useState<ScripturePack[]>([]);
  const [settings, setSettings] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('scripture-theme') === 'dark');
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('scripture-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => {
    Promise.all([getPacks(), getSettings()]).then(([stored, saved]) => {
      setPacks(stored.length ? stored : [demoPack]); if (!stored.length) void savePack(demoPack); if (saved) setSettings(saved); setReady(true);
      if (!('serviceWorker' in navigator)) setOfflineReady(true); else void navigator.serviceWorker.ready.then(() => setOfflineReady(true));
    }).catch(() => { setPacks([demoPack]); setReady(true); setOfflineReady(false); });
  }, []);
  const activePack = packs.find(p => p.id === settings.installedPackId) ?? demoPack;
  const filteredVerses = useMemo(() => activePack.verses.filter(v => v.divisions.includes(settings.division) && v.studyNumber >= settings.studyStart && v.studyNumber <= settings.studyEnd), [activePack, settings]);
  const results = useMemo(() => searchVerses(filteredVerses, query), [filteredVerses, query]);
  useEffect(() => setSelected(0), [query, settings.division, settings.studyStart, settings.studyEnd]);
  const focusSearch = () => { inputRef.current?.focus(); inputRef.current?.select(); };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); focusSearch(); }
      if (event.key === 'Escape') { setQuery(''); setView('search'); }
      if (view !== 'search' || !results.length) return;
      if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(i => Math.min(i + 1, results.length - 1)); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(i => Math.max(i - 1, 0)); }
      if (event.key === 'Enter' && results[selected]) { event.preventDefault(); document.getElementById(`result-${results[selected].verse.id}`)?.scrollIntoView({ block: 'nearest' }); }
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, [results, selected, view]);
  const updateSettings = (next: Partial<TournamentSettings>) => { const updated = { ...settings, ...next }; setSettings(updated); void saveSettings(updated); };
  const copy = async (value: string, label: string) => { await navigator.clipboard?.writeText(value); setCopied(label); window.setTimeout(() => setCopied(null), 1200); };
  if (!ready) return <div className="loading">Loading local library…</div>;
  return <div className="app-shell">
    <header className="app-toolbar"><button className="app-title" onClick={() => { setView('search'); focusSearch(); }} aria-label="Go to Scripture Search"><span className="app-icon"><BookOpen size={17}/></span><span>Scripture Lookup</span></button><div className="toolbar-status" title={offlineReady ? 'The application shell is ready for offline use' : 'Preparing offline application shell'}>{offlineReady ? <Wifi size={14}/> : <WifiOff size={14}/>}<span>{offlineReady ? 'Offline ready' : 'Preparing…'}</span></div><div className="toolbar-actions"><button className="icon-button" onClick={() => setDark(d => !d)} aria-label={dark ? 'Use light mode' : 'Use dark mode'}>{dark ? <Sun size={16}/> : <Moon size={16}/>}</button><button className="toolbar-button" onClick={() => setView(view === 'settings' ? 'search' : 'settings')} aria-pressed={view === 'settings'}><Settings2 size={15}/>Tournament</button><button className="toolbar-button" onClick={() => setView(view === 'manager' ? 'search' : 'manager')} aria-pressed={view === 'manager'}><ShieldCheck size={15}/>Materials</button></div></header>
    <main className="workspace"><div className="context-bar"><div><span className="context-label">SEASON</span><strong>{activePack.season.name}</strong></div><div><span className="context-label">DIVISION</span><select value={settings.division} onChange={e => updateSettings({ division: e.target.value as Division })} aria-label="Division"><option>Juniors</option><option>Intermediate</option><option>Seniors</option></select></div><div><span className="context-label">STUDY RANGE</span><strong>{settings.studyStart}–{settings.studyEnd === 999 ? '∞' : settings.studyEnd}</strong></div><span className="context-pack">{activePack.title}</span></div>
      {view === 'search' ? <><div className="search-line"><Search size={18}/><input ref={inputRef} autoFocus={typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Scripture…" aria-label="Search Scripture"/><kbd>⌘K</kbd>{query && <button className="clear-button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16}/></button>}</div><div className="search-subline"><span>{query ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Reference, word, phrase, or study number'}</span><span><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>↵</kbd> open</span></div><SearchResults results={results} query={query} selected={selected} onSelect={setSelected} onQuery={setQuery} onCopy={copy} copied={copied}/></> : view === 'settings' ? <Settings settings={settings} packs={packs} onChange={updateSettings}/> : <Manager packs={packs} onInstall={async () => { try { const pack = await downloadPack(`${import.meta.env.BASE_URL}packs/demo-2026.json`); setPacks(current => current.some(p => p.id === pack.id) ? current.map(p => p.id === pack.id ? pack : p) : [...current, pack]); } catch { await savePack(demoPack); setPacks([demoPack]); } }}/>}</main>
    <footer className="app-footer"><span>{filteredVerses.length} verses available</span><span>{dark ? 'Dark' : 'Light'} mode · Local library</span></footer>
  </div>;
}

function highlight(text: string, query: string) { const terms = query.replace(/^start:/i, '').replace(/["*]/g, '').split(/\s+/).filter(term => term.length > 1 && !/^\d/.test(term)); if (!terms.length) return text; const pattern = new RegExp(`(${terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig'); return text.split(pattern).map((part, index) => terms.some(term => term.toLocaleLowerCase() === part.toLocaleLowerCase()) ? <mark key={index}>{part}</mark> : part); }
function SearchResults({ results, query, selected, onSelect, onQuery, onCopy, copied }: { results: SearchResult[]; query: string; selected: number; onSelect: (index: number) => void; onQuery: (query: string) => void; onCopy: (value: string, label: string) => void; copied: string | null }) {
  if (!query) return <div className="empty-state"><Search size={22}/><span>Start typing to search the installed Scripture</span><small>Try <button onClick={() => onQuery('John 3:16')}>John 3:16</button>, <button onClick={() => onQuery('faith')}>faith</button>, or <button onClick={() => onQuery('1-12')}>1–12</button></small></div>;
  if (!results.length) return <div className="empty-state"><Search size={22}/><strong>No matching verses</strong><span>Try a different reference, word, or study range.</span></div>;
  return <div className="result-list" role="listbox" aria-label="Search results">{results.map(({ verse }, index) => { const reference = `${verse.book} ${verse.chapter}:${verse.verse}`; return <article id={`result-${verse.id}`} className={`result-row ${index === selected ? 'selected' : ''}`} key={verse.id} role="option" aria-selected={index === selected} onMouseEnter={() => onSelect(index)} onClick={() => onSelect(index)}><div className="result-leading"><span className="study-tag">#{verse.studyNumber}</span><strong>{highlight(reference, query)}</strong></div><p>{highlight(verse.text, query)}</p><div className="row-actions"><button onClick={e => { e.stopPropagation(); onCopy(reference, verse.id); }} aria-label={`Copy ${reference}`}>{copied === verse.id ? <Check size={14}/> : <Clipboard size={14}/>}<span>{copied === verse.id ? 'Copied' : 'Reference'}</span></button><button onClick={e => { e.stopPropagation(); onCopy(verse.text, `${verse.id}-text`); }} aria-label={`Copy verse text for ${reference}`}><Clipboard size={14}/><span>Text</span></button></div></article>; })}</div>;
}
function Settings({ settings, packs, onChange }: { settings: TournamentSettings; packs: ScripturePack[]; onChange: (next: Partial<TournamentSettings>) => void }) { return <section className="secondary-view"><div className="view-heading"><div><span className="context-label">TOURNAMENT</span><h1>Settings</h1></div><Settings2 size={20}/></div><label>Installed material pack<select value={settings.installedPackId} onChange={e => onChange({ installedPackId: e.target.value })}>{packs.map(p => <option key={p.id} value={p.id}>{p.title} ({p.version})</option>)}</select></label><div className="range-grid"><label>Study number from<input type="number" min="1" value={settings.studyStart} onChange={e => onChange({ studyStart: Number(e.target.value) })}/></label><label>through<input type="number" min="1" value={settings.studyEnd} onChange={e => onChange({ studyEnd: Number(e.target.value) })}/></label></div><div className="settings-note"><Wifi size={15}/> Saved on this device and available without a connection.</div></section>; }
function Manager({ packs, onInstall }: { packs: ScripturePack[]; onInstall: () => void }) { return <section className="secondary-view"><div className="view-heading"><div><span className="context-label">ADMINISTRATIVE PLACEHOLDER</span><h1>Material Manager</h1></div><ShieldCheck size={20}/></div><div className="settings-note warning"><ShieldCheck size={15}/><span>Publishing is unavailable to public users. Future pack publishing requires authorized repository maintainers and server-side validation.</span></div>{packs.map(p => <div className="pack-row" key={p.id}><div><strong>{p.title}</strong><small>{p.season.name} · {p.verses.length} verses · {p.status === 'demo' ? 'Demonstration only' : p.status}</small></div><span className="version-tag">{p.version}</span></div>)}<button className="secondary-button" onClick={onInstall}><Download size={15}/> Reinstall demonstration pack</button></section>; }
