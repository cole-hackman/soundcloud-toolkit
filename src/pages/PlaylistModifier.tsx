import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, GripVertical, Trash2, Save, ChevronDown, Check, Undo, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { emitToast } from '../lib/toast';
import { Link } from 'react-router-dom';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

type PlaylistLite = { id: number; title: string; coverUrl?: string };
type Track = { id: number; title: string; duration?: number; artwork_url?: string; user?: { username?: string }; bpm?: number };
type ViewTrack = Track & { originalIndex: number };
type SortKey = 'manual' | 'title-asc' | 'title-desc' | 'artist-asc' | 'artist-desc' | 'date-new' | 'date-old' | 'dur-short' | 'dur-long' | 'bpm-low' | 'bpm-high';

function PlaylistModifier() {
  const [playlists, setPlaylists] = useState<PlaylistLite[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [viewTracks, setViewTracks] = useState<ViewTrack[]>([]);
  const [initialIds, setInitialIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('manual');
  const [applyMode, setApplyMode] = useState<boolean>(false);
  const [lastAppliedOrder, setLastAppliedOrder] = useState<ViewTrack[] | null>(null);
  const [ariaMsg, setAriaMsg] = useState<string>('');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);

  const hasChanges = useMemo(() => { const ids = tracks.map(t => t.id); if (ids.length !== initialIds.length) return true; for (let i = 0; i < ids.length; i++) { if (ids[i] !== initialIds[i]) return true; } return false; }, [tracks, initialIds]);

  useEffect(() => { loadPlaylists(); }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!selectorRef.current) return;
      if (!selectorRef.current.contains(e.target as Node)) setIsSelectorOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!sortRef.current) return;
      if (!sortRef.current.contains(e.target as Node)) setIsSortOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function loadPlaylists() {
    try {
      const res = await fetch(`${API_BASE}/api/playlists?limit=50`, { credentials: 'include' });
      if (!res.ok) return; const data = await res.json();
      const items = Array.isArray(data.collection) ? data.collection : [];
      const mapped: PlaylistLite[] = items.map((p: any) => ({ id: Number(p.id), title: p.title, coverUrl: p.coverUrl || p.artwork_url }));
      setPlaylists(mapped);
      if (mapped.length) { const idStr = String(mapped[0].id); setSelectedPlaylistId(idStr); loadTracks(Number(idStr)); }
    } catch (e) { console.error('Failed to load playlists', e); }
  }

  async function loadTracks(pid: number) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/playlists/${pid}`, { credentials: 'include' });
      if (!res.ok) return; const data = await res.json();
      const list: Track[] = Array.isArray(data.tracks) ? data.tracks.filter(Boolean) : [];
      setTracks(list);
      setViewTracks(list.map((t, i) => ({ ...t, originalIndex: i })));
      setInitialIds(list.map(t => t.id)); setSelectedIds(new Set()); setSortKey('manual'); setLastAppliedOrder(null);
    } catch (e) { console.error('Failed to load playlist', e); } finally { setLoading(false); }
  }

  function move(from: number, to: number) {
    setViewTracks(prev => { const next = prev.slice(); const [item] = next.splice(from, 1); next.splice(Math.max(0, Math.min(to, next.length)), 0, item); return next; });
    if (sortKey !== 'manual') { setSortKey('manual'); emitToast({ message: 'Switched to Manual after drag', variant: 'info' }); }
  }
  function removeSelected() { if (selectedIds.size === 0) return; setTracks(prev => prev.filter(t => !selectedIds.has(t.id))); setViewTracks(prev => prev.filter(t => !selectedIds.has(t.id))); setSelectedIds(new Set()); }

  function onDragStartItem(index: number, e: React.DragEvent) {
    setDraggingIndex(index);
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(viewTracks[index]?.id ?? 'drag')); } catch {}
  }

  function onDragOverItem(index: number, e: React.DragEvent) {
    e.preventDefault();
    // Only set state if helpful for logic; avoid visual outlines
    if (dragOverIndex !== index) setDragOverIndex(index);
    try { e.dataTransfer.dropEffect = 'move'; } catch {}
  }

  function onDropItem(index: number, e: React.DragEvent) {
    e.preventDefault();
    if (draggingIndex === null) { setDragOverIndex(null); return; }
    const from = draggingIndex;
    let to = index;
    if (from < to) to = Math.max(0, to - 1);
    setViewTracks(prev => { const next = prev.slice(); const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
    setDraggingIndex(null);
    setDragOverIndex(null);
  }

  function onDragEndItem() { setDraggingIndex(null); setDragOverIndex(null); }

  function handleSelect(p: PlaylistLite) {
    const idStr = String(p.id);
    setSelectedPlaylistId(idStr);
    setIsSelectorOpen(false);
    const idNum = Number(idStr); if (!Number.isNaN(idNum)) loadTracks(idNum);
  }

  async function save() {
    if (!selectedPlaylistId) return;
    const ids = tracks.map(t => t.id); if (ids.length > 500) { alert('Max 500 tracks'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/playlists/${selectedPlaylistId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ tracks: ids }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to update'); }
      emitToast({ message: 'Playlist updated!', variant: 'success' });
    } catch (e: any) { emitToast({ message: e.message || 'Failed to save', variant: 'error' }); } finally { setSaving(false); }
  }

  // Helpers for sort
  function normalizeName(name: string): string { return (name || '').trim().toLowerCase().replace(/^(the|a)\s+/, ''); }
  function parsedBpm(t: ViewTrack): number | undefined {
    if (t.bpm != null) return t.bpm;
    const title = t.title || '';
    const m = title.match(/(\b|\D)(\d{2,3})\s?bpm\b/i) || title.match(/[-\s](\d{2,3})(?:\s*[-)]|$)/);
    if (!m) return undefined; const v = Number(m[2] || m[1]); return v >= 60 && v <= 220 ? v : undefined;
  }

  // Apply sorting to on-screen list (viewTracks) with small debounce
  useEffect(() => {
    if (sortKey === 'manual') return;
    const id = setTimeout(() => {
      setViewTracks(prev => {
        const arr = prev.slice();
        arr.sort((a, b) => {
          switch (sortKey) {
            case 'title-asc': return normalizeName(a.title).localeCompare(normalizeName(b.title)) || a.originalIndex - b.originalIndex;
            case 'title-desc': return normalizeName(b.title).localeCompare(normalizeName(a.title)) || a.originalIndex - b.originalIndex;
            case 'artist-asc': return normalizeName(a.user?.username || '').localeCompare(normalizeName(b.user?.username || '')) || normalizeName(a.title).localeCompare(normalizeName(b.title));
            case 'artist-desc': return normalizeName(b.user?.username || '').localeCompare(normalizeName(a.user?.username || '')) || normalizeName(b.title).localeCompare(normalizeName(a.title));
            case 'date-new': return b.originalIndex - a.originalIndex;
            case 'date-old': return a.originalIndex - b.originalIndex;
            case 'dur-short': return (a.duration || Number.MAX_SAFE_INTEGER) - (b.duration || Number.MAX_SAFE_INTEGER);
            case 'dur-long': return (b.duration || -1) - (a.duration || -1);
            case 'bpm-low': {
              const ab = parsedBpm(a); const bb = parsedBpm(b);
              if (ab == null && bb == null) return 0; if (ab == null) return 1; if (bb == null) return -1; return ab - bb;
            }
            case 'bpm-high': {
              const ab = parsedBpm(a); const bb = parsedBpm(b);
              if (ab == null && bb == null) return 0; if (ab == null) return 1; if (bb == null) return -1; return bb - ab;
            }
          }
        });
        return arr.map(v => ({ ...v }));
      });
      const readable = sortKey.replace('-', ' ').replace('asc', 'A–Z').replace('desc', 'Z–A').replace('new', 'Newest').replace('old', 'Oldest');
      setAriaMsg(`List sorted by ${readable}`);
    }, 150);
    return () => clearTimeout(id);
  }, [sortKey]);

  async function applyOrder() {
    if (!applyMode || sortKey === 'manual') return;
    setLastAppliedOrder(viewTracks.map((t, i) => ({ ...t, originalIndex: i })));
    const ids = viewTracks.map(t => t.id);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/playlists/${selectedPlaylistId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ tracks: ids }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to apply order'); }
      emitToast({ message: 'Order applied', variant: 'success' });
      setTracks(viewTracks.map(v => ({ id: v.id, title: v.title, duration: v.duration, artwork_url: v.artwork_url, user: v.user, bpm: v.bpm })));
      setViewTracks(prev => prev.map((t, i) => ({ ...t, originalIndex: i })));
    } catch (e: any) { emitToast({ message: e.message || 'Failed to apply order', variant: 'error' }); }
    finally { setSaving(false); }
  }

  async function undoApply() {
    if (!lastAppliedOrder) return;
    const ids = lastAppliedOrder.map(t => t.id);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/playlists/${selectedPlaylistId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ tracks: ids }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to undo'); }
      emitToast({ message: 'Order reverted', variant: 'success' });
      setTracks(lastAppliedOrder.map(v => ({ id: v.id, title: v.title, duration: v.duration, artwork_url: v.artwork_url, user: v.user, bpm: v.bpm })));
      setViewTracks(lastAppliedOrder.map((v, i) => ({ ...v, originalIndex: i })));
      setLastAppliedOrder(null);
    } catch (e: any) { emitToast({ message: e.message || 'Failed to undo', variant: 'error' }); }
    finally { setSaving(false); }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl pb-24">
      <div className="flex items-center mb-3">
        <Link to="/dashboard" className="mr-3"><button className="p-2 rounded sc-focus" style={{ color: 'var(--sc-text-light)' }}><ArrowLeft className="w-5 h-5" /></button></Link>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Playlist Modifier</h1>
      </div>

      {/* Header picker condensed */}
      <div className="rounded-xl border bg-white shadow-sm p-3 mb-4">
        <div className="flex items-center gap-3" ref={selectorRef}>
          {(() => { const p = playlists.find(x => String(x.id) === String(selectedPlaylistId)); return p?.coverUrl ? <img src={p.coverUrl} className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded" style={{ background: 'var(--sc-light-gray)' }} /> })()}
          <div className="relative flex-1">
            <button type="button" onClick={() => setIsSelectorOpen(v => !v)} className="sc-input sc-focus px-3 py-2 text-sm w-full flex items-center justify-between">
              <span className="truncate">{playlists.find(x => String(x.id) === String(selectedPlaylistId))?.title || 'Select a playlist…'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {isSelectorOpen && (
              <div className="absolute z-10 mt-2 w-full max-h-64 overflow-auto sc-card p-1" style={{ borderColor: 'var(--sc-light-gray)' }}>
                {playlists.map(p => (
                  <button key={p.id} onClick={() => handleSelect(p)} className="w-full flex items-center gap-3 px-3 py-2 rounded sc-focus hover:bg-gray-100 text-left">
                    {p.coverUrl ? <img src={p.coverUrl} className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded" style={{ background: 'var(--sc-light-gray)' }} />}
                    <span className="flex-1 text-sm truncate" style={{ color: 'var(--sc-text-dark)' }}>{p.title}</span>
                    {String(p.id) === String(selectedPlaylistId) && <Check className="w-4 h-4" style={{ color: 'var(--sc-orange)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button title="Refresh" onClick={() => { const idNum = Number(selectedPlaylistId); if (!Number.isNaN(idNum)) loadTracks(idNum); }} className="p-2 rounded sc-focus" style={{ color: 'var(--sc-text-light)' }}>
            ↻
          </button>
        </div>
      </div>

      {/* Sort Bar */}
      <div className="sticky top-0 z-10">
        <div className="rounded-lg border bg-white px-3 py-2 shadow-sm mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Segmented quick choices */}
            <div className="flex items-center rounded border overflow-hidden" role="tablist" aria-label="Sort">
              {([
                ['manual','Manual'],
                ['title-asc','Title'],
                ['artist-asc','Artist'],
                ['bpm-low','BPM'],
              ] as [SortKey,string][]).map(([key,label]) => (
                <button key={key} onClick={() => setSortKey(key)} role="tab" aria-selected={sortKey===key} className={`px-3 py-1.5 text-sm ${sortKey===key ? 'bg-[var(--sc-orange)] text-white' : ''}`}>{label}</button>
              ))}
            </div>
            <div className="relative" ref={sortRef}>
              <button type="button" onClick={() => setIsSortOpen(v => !v)} className="sc-input sc-focus px-3 py-2 text-sm w-48 flex items-center justify-between">
                <span>{(() => {
                  const map: Record<SortKey, string> = {
                    'manual': 'Manual',
                    'title-asc': 'Title · A→Z',
                    'title-desc': 'Title · Z→A',
                    'artist-asc': 'Artist · A→Z',
                    'artist-desc': 'Artist · Z→A',
                    'date-new': 'Date added · Newest',
                    'date-old': 'Date added · Oldest',
                    'dur-short': 'Duration · Short→Long',
                    'dur-long': 'Duration · Long→Short',
                    'bpm-low': 'BPM · Low→High',
                    'bpm-high': 'BPM · High→Low',
                  } as const;
                  return map[sortKey];
                })()}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {isSortOpen && (
                <div className="absolute z-10 mt-2 w-64 max-h-64 overflow-auto sc-card p-1" style={{ borderColor: 'var(--sc-light-gray)' }}>
                  {([
                    ['manual','Manual'],
                    ['title-asc','Title · A→Z'],
                    ['title-desc','Title · Z→A'],
                    ['artist-asc','Artist · A→Z'],
                    ['artist-desc','Artist · Z→A'],
                    ['date-new','Date added · Newest'],
                    ['date-old','Date added · Oldest'],
                    ['dur-short','Duration · Short→Long'],
                    ['dur-long','Duration · Long→Short'],
                    ['bpm-low','BPM · Low→High'],
                    ['bpm-high','BPM · High→Low'],
                  ] as [SortKey,string][]).map(([key,label]) => (
                    <button key={key} onClick={() => { setSortKey(key); setIsSortOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded sc-focus hover:bg-gray-100 text-left">
                      <span className="flex-1 text-sm" style={{ color: 'var(--sc-text-dark)' }}>{label}</span>
                      {sortKey === key && <Check className="w-4 h-4" style={{ color: 'var(--sc-orange)' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mx-2 w-px h-5" style={{ background: 'var(--sc-light-gray)' }} />
            <input id="applyMode" title="Push current on-screen order to SoundCloud." type="checkbox" checked={applyMode} onChange={(e) => setApplyMode(e.target.checked)} className="sc-focus" />
            <label htmlFor="applyMode" className="text-sm" style={{ color: 'var(--sc-text-light)' }}>Apply to playlist order</label>
          </div>
          <div className="flex items-center gap-2">
            <button title="Revert to last order." onClick={() => { if (!lastAppliedOrder) return; undoApply(); }} disabled={!lastAppliedOrder || saving} className="px-3 py-2 rounded" style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-dark)' }}><Undo className="w-4 h-4 inline mr-1" />Undo</button>
            <button onClick={applyOrder} disabled={!applyMode || sortKey === 'manual' || saving} className="sc-primary-button flex items-center gap-2"><ArrowUpDown className="w-4 h-4" />Apply Order</button>
          </div>
        </div>
        <div aria-live="polite" className="sr-only">{ariaMsg}</div>
      </div>

      <div className={`sc-card ${draggingIndex !== null ? 'sc-dragging' : ''}`}>
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded sc-skeleton" />
                <div className="flex-1">
                  <div className="h-3 w-1/2 rounded sc-skeleton mb-2" />
                  <div className="h-3 w-1/3 rounded sc-skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="p-6 text-center" style={{ color: 'var(--sc-text-light)' }}>No tracks in this playlist.</div>
        ) : (
          <ul>
            {viewTracks.map((t, idx) => {
              const selected = selectedIds.has(t.id);
              return (
                <motion.li
                  key={t.id}
                  className={`grid grid-cols-[auto_auto_1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5 border-b hover:bg-gray-50`}
                  style={{ borderColor: 'var(--sc-light-gray)', background: selected ? 'var(--sc-light-gray)' : '#FFFFFF' }}
                  layout
                  draggable
                  onDragStart={(e) => onDragStartItem(idx, e)}
                  onDragOver={(e) => onDragOverItem(idx, e)}
                  onDrop={(e) => onDropItem(idx, e)}
                  onDragEnd={onDragEndItem}
                >
                  <span className="cursor-grab active:cursor-grabbing" style={{ color: 'var(--sc-text-light)' }}><GripVertical className="w-4 h-4" /></span>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-light)' }}>{idx + 1}</span>
                  {t.artwork_url ? <img src={t.artwork_url} className="w-12 h-12 rounded object-cover" /> : <div className="w-12 h-12 rounded" style={{ background: 'var(--sc-light-gray)' }} />}
                  <div className="min-w-0">
                    <div className="text-sm truncate" title={t.title || 'Untitled'} style={{ color: 'var(--sc-text-dark)' }}>{t.title || 'Untitled'}</div>
                    <div className="text-xs truncate" title={t.user?.username || 'Unknown'} style={{ color: 'var(--sc-text-light)' }}>{t.user?.username || 'Unknown'}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block text-xs px-2 py-0.5 rounded text-center w-12" style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-light)' }}>{formatDuration(t.duration)}</span>
                  </div>
                  <div className="text-right">
                    {(() => { const bpm = parsedBpm(t); const inferred = bpm != null && t.bpm == null; return (
                      <span className="inline-block text-xs px-2 py-0.5 rounded text-center w-14" title={inferred ? 'BPM inferred from track title.' : ''} style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-light)' }}>
                        BPM {bpm != null ? `${bpm}${inferred ? ' ≈' : ''}` : '—'}
                      </span>
                    ); })()}
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <input type="checkbox" checked={selected} onChange={() => setSelectedIds(prev => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; })} className="sc-focus" />
                    <button onClick={() => setTracks(prev => prev.filter(x => x.id !== t.id))} className="p-2 rounded" style={{ color: '#ef4444', opacity: 0.7 }} onMouseOver={(e)=>{(e.currentTarget as HTMLButtonElement).style.opacity='1';}} onMouseOut={(e)=>{(e.currentTarget as HTMLButtonElement).style.opacity='0.7';}}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Sticky Save Bar - visible only when selection or changes */}
      {(selectedIds.size > 0 || hasChanges) && (
        <div className="fixed left-0 right-0 bottom-0 z-40" style={{ background: 'var(--sc-white)', borderTop: '1px solid var(--sc-light-gray)' }}>
          <div className="container mx-auto px-4 py-3 max-w-5xl flex items-center justify-between">
            <div className="text-sm" style={{ color: 'var(--sc-text-light)' }}>
              Selected {selectedIds.size}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={removeSelected} disabled={selectedIds.size === 0} className="rounded font-semibold px-4" style={{ height: '48px', minWidth: '160px', background: selectedIds.size === 0 ? 'var(--sc-light-gray)' : '#ef4444', color: 'white' }}>
                Remove Selected ({selectedIds.size})
              </button>
              <button onClick={save} disabled={!hasChanges || saving} className="sc-primary-button flex items-center gap-2">
                {saving ? (<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />) : (<Save className="w-4 h-4" />)}
                <span>{saving ? 'Saving…' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlaylistModifier;


