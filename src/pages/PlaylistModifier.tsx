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
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        emitToast({ message: err?.error || 'Failed to load playlist. Please try again.', variant: 'error' });
        return;
      }
      const data = await res.json();
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
  function formatDuration(ms?: number): string {
    if (ms == null || ms === 0) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
    <div className="min-h-screen" style={{ background: 'var(--sc-light-gray)' }}>
      <div className="container mx-auto px-6 py-12 max-w-7xl pb-32">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center mb-4">
            <Link to="/dashboard" className="mr-4">
              <button className="p-2 rounded-lg sc-focus transition-colors" style={{ color: 'var(--sc-text-light)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sc-white)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <ArrowLeft className="w-6 h-6" />
              </button>
            </Link>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: 'var(--sc-text-dark)' }}>Playlist Modifier</h1>
          <p className="text-lg" style={{ color: 'var(--sc-text-light)' }}>Reorder and remove tracks in your playlists</p>
        </motion.div>

        {/* Playlist Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl p-4 mb-6 shadow-lg border-2"
          style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}
        >
          <div className="flex items-center gap-4" ref={selectorRef}>
            {(() => {
              const p = playlists.find(x => String(x.id) === String(selectedPlaylistId));
              return p?.coverUrl ? (
                <img src={p.coverUrl} className="w-14 h-14 rounded-lg object-cover shadow-md" />
              ) : (
                <div className="w-14 h-14 rounded-lg" style={{ background: 'var(--sc-light-gray)' }} />
              );
            })()}
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setIsSelectorOpen(v => !v)}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl sc-focus hover:border-[#FF5500] transition-all flex items-center justify-between text-left"
              >
                <span className="truncate font-medium text-[#333333]">
                  {playlists.find(x => String(x.id) === String(selectedPlaylistId))?.title || 'Select a playlist…'}
                </span>
                <ChevronDown className="w-5 h-5 text-[#666666]" />
              </button>
              {isSelectorOpen && (
                <div className="absolute z-10 mt-2 w-full max-h-64 overflow-auto bg-white border-2 border-gray-200 rounded-xl p-2 shadow-xl">
                  {playlists.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg sc-focus hover:bg-gray-50 text-left transition-colors"
                    >
                      {p.coverUrl ? (
                        <img src={p.coverUrl} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg" style={{ background: 'var(--sc-light-gray)' }} />
                      )}
                      <span className="flex-1 text-base truncate text-[#333333]">{p.title}</span>
                      {String(p.id) === String(selectedPlaylistId) && (
                        <Check className="w-5 h-5 text-[#FF5500]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              title="Refresh"
              onClick={() => {
                const idNum = Number(selectedPlaylistId);
                if (!Number.isNaN(idNum)) loadTracks(idNum);
              }}
              className="p-3 rounded-lg sc-focus hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--sc-text-light)' }}
            >
              ↻
            </button>
          </div>
        </motion.div>

        {/* Sort Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="sticky top-0 z-10 mb-6"
        >
          <div className="bg-white border-2 border-gray-200 rounded-xl px-6 py-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Segmented quick choices */}
              <div className="flex items-center rounded-lg border-2 border-gray-200 overflow-hidden" role="tablist" aria-label="Sort">
                {([
                  ['manual', 'Manual'],
                  ['title-asc', 'Title'],
                  ['artist-asc', 'Artist'],
                  ['bpm-low', 'BPM'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortKey(key)}
                    role="tab"
                    aria-selected={sortKey === key}
                    className={`px-4 py-2 text-sm font-medium transition-all ${
                      sortKey === key
                        ? 'bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white'
                        : 'bg-white text-[#666666] hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative" ref={sortRef}>
                <button
                  type="button"
                  onClick={() => setIsSortOpen(v => !v)}
                  className="px-4 py-2 bg-white border-2 border-gray-200 rounded-xl sc-focus hover:border-[#FF5500] transition-all text-sm w-56 flex items-center justify-between"
                >
                  <span className="font-medium text-[#333333]">
                    {(() => {
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
                    })()}
                  </span>
                  <ChevronDown className="w-5 h-5 text-[#666666]" />
                </button>
                {isSortOpen && (
                  <div className="absolute z-10 mt-2 w-64 max-h-64 overflow-auto bg-white border-2 border-gray-200 rounded-xl p-2 shadow-xl">
                    {([
                      ['manual', 'Manual'],
                      ['title-asc', 'Title · A→Z'],
                      ['title-desc', 'Title · Z→A'],
                      ['artist-asc', 'Artist · A→Z'],
                      ['artist-desc', 'Artist · Z→A'],
                      ['date-new', 'Date added · Newest'],
                      ['date-old', 'Date added · Oldest'],
                      ['dur-short', 'Duration · Short→Long'],
                      ['dur-long', 'Duration · Long→Short'],
                      ['bpm-low', 'BPM · Low→High'],
                      ['bpm-high', 'BPM · High→Low'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSortKey(key);
                          setIsSortOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg sc-focus hover:bg-gray-50 text-left transition-colors"
                      >
                        <span className="flex-1 text-sm text-[#333333]">{label}</span>
                        {sortKey === key && <Check className="w-5 h-5 text-[#FF5500]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mx-2 w-px h-8" style={{ background: 'var(--sc-light-gray)' }} />
              <div className="flex items-center gap-3">
                <input
                  id="applyMode"
                  title="Push current on-screen order to SoundCloud."
                  type="checkbox"
                  checked={applyMode}
                  onChange={(e) => setApplyMode(e.target.checked)}
                  className="w-5 h-5 sc-focus"
                />
                <label htmlFor="applyMode" className="text-sm font-medium text-[#666666] cursor-pointer">
                  Apply to playlist order
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title="Revert to last order."
                onClick={() => {
                  if (!lastAppliedOrder) return;
                  undoApply();
                }}
                disabled={!lastAppliedOrder || saving}
                className="px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-[#FF5500] transition-all font-medium text-[#333333] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Undo className="w-4 h-4" />
                Undo
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={applyOrder}
                disabled={!applyMode || sortKey === 'manual' || saving}
                className="px-6 py-2 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ArrowUpDown className="w-5 h-5" />
                Apply Order
              </motion.button>
            </div>
          </div>
          <div aria-live="polite" className="sr-only">{ariaMsg}</div>
        </motion.div>

        {/* Track List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg ${draggingIndex !== null ? 'sc-dragging' : ''}`}
        >
          {loading ? (
            <div className="p-8 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg sc-skeleton" />
                  <div className="flex-1">
                    <div className="h-4 w-1/2 rounded sc-skeleton mb-2" />
                    <div className="h-3 w-1/3 rounded sc-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-lg text-[#666666]">No tracks in this playlist.</p>
            </div>
          ) : (
            <ul>
              {viewTracks.map((t, idx) => {
                const selected = selectedIds.has(t.id);
                return (
                  <motion.li
                    key={t.id}
                    className={`grid grid-cols-[auto_auto_1fr_auto_auto_auto] items-center gap-4 px-6 py-4 border-b transition-all ${
                      selected ? 'bg-orange-50' : 'bg-white hover:bg-gray-50'
                    }`}
                    style={{ borderColor: 'var(--sc-light-gray)' }}
                    layout
                    draggable
                    onDragStart={(e) => onDragStartItem(idx, e)}
                    onDragOver={(e) => onDragOverItem(idx, e)}
                    onDrop={(e) => onDropItem(idx, e)}
                    onDragEnd={onDragEndItem}
                  >
                    <span className="cursor-grab active:cursor-grabbing text-[#666666] hover:text-[#FF5500] transition-colors">
                      <GripVertical className="w-5 h-5" />
                    </span>
                    <span className="text-sm px-3 py-1 rounded-lg font-semibold bg-gray-100 text-[#666666] w-10 text-center">
                      {idx + 1}
                    </span>
                    {t.artwork_url ? (
                      <img src={t.artwork_url} className="w-16 h-16 rounded-lg object-cover shadow-md" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg" style={{ background: 'var(--sc-light-gray)' }} />
                    )}
                    <div className="min-w-0">
                      <div className="text-base font-semibold truncate mb-1 text-[#333333]" title={t.title || 'Untitled'}>
                        {t.title || 'Untitled'}
                      </div>
                      <div className="text-sm truncate text-[#666666]" title={t.user?.username || 'Unknown'}>
                        {t.user?.username || 'Unknown'}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block text-sm px-3 py-1 rounded-lg font-medium bg-gray-100 text-[#666666]">
                        {formatDuration(t.duration)}
                      </span>
                    </div>
                    <div className="text-right">
                      {(() => {
                        const bpm = parsedBpm(t);
                        const inferred = bpm != null && t.bpm == null;
                        return (
                          <span
                            className="inline-block text-sm px-3 py-1 rounded-lg font-medium bg-gray-100 text-[#666666]"
                            title={inferred ? 'BPM inferred from track title.' : ''}
                          >
                            BPM {bpm != null ? `${bpm}${inferred ? ' ≈' : ''}` : '—'}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(t.id)) next.delete(t.id);
                            else next.add(t.id);
                            return next;
                          })
                        }
                        className="w-5 h-5 sc-focus"
                      />
                      <button
                        onClick={() => setTracks(prev => prev.filter(x => x.id !== t.id))}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </motion.div>

        {/* Sticky Save Bar */}
        {(selectedIds.size > 0 || hasChanges) && (
          <div className="fixed left-0 right-0 bottom-0 z-40 bg-white border-t-2 border-gray-200 shadow-2xl">
            <div className="container mx-auto px-6 py-4 max-w-7xl flex items-center justify-between">
              <div className="text-lg font-semibold text-[#333333]">
                {selectedIds.size > 0 && `Selected ${selectedIds.size}`}
                {hasChanges && selectedIds.size === 0 && 'Unsaved changes'}
              </div>
              <div className="flex items-center gap-4">
                {selectedIds.size > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={removeSelected}
                    disabled={selectedIds.size === 0}
                    className="px-6 py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: selectedIds.size === 0 ? 'var(--sc-light-gray)' : '#ef4444' }}
                  >
                    Remove Selected ({selectedIds.size})
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={save}
                  disabled={!hasChanges || saving}
                  className="px-8 py-3 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlaylistModifier;


