import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { emitToast } from '../lib/toast';
import { ArrowLeft, Heart, Play, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = 'http://localhost:3011';

function LikesToPlaylist() {
  const [playlistTitle, setPlaylistTitle] = useState('My Liked Songs');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [likedTracksCount, setLikedTracksCount] = useState(0);
  const [previewLikes, setPreviewLikes] = useState<Array<{ title: string; artist: string }>>([]);
  const [result, setResult] = useState<any>(null);
  const [likes, setLikes] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [nextHref, setNextHref] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const MAX = 500;

  useEffect(() => { fetchLikesFirstPage(); }, []);

  const fetchLikesFirstPage = async () => {
    try {
      setLoadingPage(true);
      const res = await fetch(`${API_BASE}/api/likes/paged?limit=50`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data.collection) ? data.collection : [];
      setLikes(items);
      setNextHref(data.next_href || null);
      setLikedTracksCount(data.total ?? items.length);
    } catch (e) { console.error('Failed to load likes page:', e); } finally { setLoadingPage(false); }
  };

  const fetchNextPage = async () => {
    if (!nextHref || loadingPage) return;
    try {
      setLoadingPage(true);
      const url = new URL(`${API_BASE}/api/likes/paged`); url.searchParams.set('next', nextHref);
      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data.collection) ? data.collection : [];
      setLikes(prev => [...prev, ...items]);
      setNextHref(data.next_href || null);
      if (typeof data.total === 'number') setLikedTracksCount(data.total);
    } catch (e) { console.error('Failed to load next page:', e); } finally { setLoadingPage(false); }
  };

  const handleCreatePlaylist = async () => {
    if (!playlistTitle.trim()) return;
    const trackIds = Array.from(selected);
    if (trackIds.length === 0) { alert('Please select at least one track.'); return; }
    if (trackIds.length > MAX) { alert('You can select up to 500 tracks.'); return; }
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/api/playlists/from-likes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ title: playlistTitle, trackIds }) });
      if (response.ok) { const data = await response.json(); setResult(data); setIsComplete(true); emitToast({ message: 'Playlist created from likes', variant: 'success' }); }
      else { const error = await response.json(); console.error('Failed to create playlist from likes:', error); emitToast({ message: 'Failed to create playlist', variant: 'error' }); }
    } catch (error) { console.error('Error creating playlist:', error); emitToast({ message: 'An error occurred. Please try again.', variant: 'error' }); } finally { setIsProcessing(false); }
  };

  if (isComplete) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center sc-card p-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#22c55e' }}><Check className="w-10 h-10 text-white" /></div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Playlist Created!</h1>
          <p className="mt-3" style={{ color: 'var(--sc-text-light)' }}>
            "{result?.playlist?.title || playlistTitle}" has been created with {result?.totalTracks || likedTracksCount} tracks
          </p>
          <div className="space-y-3 mt-6">
            <button onClick={() => { const url = result?.permalink_url || result?.playlist?.permalink_url; if (url) window.open(url, '_blank'); }} className="w-full sc-primary-button">Open in SoundCloud</button>
            <Link to="/dashboard" className="block w-full text-center px-4 py-3 rounded" style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-dark)' }}>Back to Dashboard</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Link to="/dashboard" className="mr-4"><button className="p-2 rounded sc-focus" style={{ color: 'var(--sc-text-light)' }}><ArrowLeft className="w-5 h-5" /></button></Link>
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Likes → Playlist</h1>
          <p style={{ color: 'var(--sc-text-light)' }}>Convert your liked tracks into a playlist</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-24">
        {/* Liked Tracks */}
        <div className="sc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded flex items-center justify-center" style={{ background: 'var(--sc-orange)' }}><Heart className="w-6 h-6 text-white" /></div>
              <div>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Your Liked Tracks</h2>
                <p style={{ color: 'var(--sc-text-light)' }}>{likedTracksCount} tracks</p>
              </div>
            </div>
            <Play className="w-6 h-6" style={{ color: 'var(--sc-orange)' }} />
          </div>

          <div className="space-y-2">
            {!loadingPage && likes.length === 0 && (
              <div className="sc-card p-6 text-center" style={{ color: 'var(--sc-text-light)' }}>
                No liked tracks yet. Start liking tracks on SoundCloud to see them here.
              </div>
            )}
            {likes.map((item: any, index: number) => {
              const t = item?.track || item; const id = Number(t?.id); const isChecked = selected.has(id); const artwork = t?.artwork_url || t?.user?.avatar_url || '';
              return (
                <label key={id || index} className="flex items-center space-x-3 p-2 rounded-lg cursor-pointer" style={{ background: 'var(--sc-white)', border: '1px solid var(--sc-light-gray)' }}>
                  <input type="checkbox" checked={isChecked} onChange={() => { setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else { if (next.size >= MAX) { alert('You can select up to 500 tracks.'); return next; } next.add(id); } return next; }); }} className="sc-focus" />
                  <div className="flex items-center space-x-3">
                    {artwork ? (<img src={artwork} alt="art" className="w-10 h-10 rounded object-cover" />) : (<div className="w-10 h-10 rounded" style={{ background: 'var(--sc-light-gray)' }} />)}
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--sc-text-dark)' }}>{t?.title || 'Untitled'}</div>
                      <div className="text-xs" style={{ color: 'var(--sc-text-light)' }}>{t?.user?.username || 'Unknown'}</div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-3 text-sm" style={{ color: 'var(--sc-text-light)' }}>
            <button onClick={() => { setSelected(prev => { const next = new Set(prev); for (const item of likes) { const id = Number((item?.track || item)?.id); if (!next.has(id)) { if (next.size >= MAX) break; next.add(id); } } return next; }); }} className="underline">Select All (loaded)</button>
            <button onClick={fetchLikesFirstPage} className="underline">Refresh</button>
            <span>Selected {selected.size} / {MAX}</span>
          </div>
          <div className="mt-4">
            {nextHref && (<button disabled={loadingPage} onClick={fetchNextPage} className="w-full px-3 py-2 rounded sc-focus" style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-dark)' }}>{loadingPage ? 'Loading…' : 'Load more'}</button>)}
          </div>
        </div>

        {/* Settings */}
        <div className="sc-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--sc-text-dark)' }}>Playlist Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--sc-text-dark)' }}>Playlist Name</label>
              <input type="text" value={playlistTitle} onChange={(e) => setPlaylistTitle(e.target.value)} className="w-full px-4 py-3 sc-input sc-focus" />
            </div>
          </div>
        </div>

        {/* Sticky Action Bar */}
        <div className="fixed left-0 right-0 bottom-0 z-40" style={{ background: 'var(--sc-white)', borderTop: '1px solid var(--sc-light-gray)' }}>
          <div className="container mx-auto px-4 py-3 max-w-2xl flex items-center justify-between">
            <div className="text-sm" style={{ color: 'var(--sc-text-light)' }}>Selected {selected.size} / {MAX}</div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={!playlistTitle.trim() || isProcessing || selected.size === 0} onClick={handleCreatePlaylist} className="sc-primary-button flex items-center justify-center gap-2">
              {isProcessing ? (<><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Creating Playlist...</span></>) : (<><Heart className="w-5 h-5" /><span>Create Playlist</span></>)}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default LikesToPlaylist;