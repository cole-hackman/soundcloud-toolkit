import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { emitToast } from '../lib/toast';
import { ArrowLeft, Heart, Play, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

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
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12" style={{ background: 'var(--sc-light-gray)' }}>
        <div className="max-w-2xl w-full">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center rounded-2xl p-6 sm:p-8 md:p-10 shadow-xl border-2"
            style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-lg">
              <Check className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 px-4" style={{ color: 'var(--sc-text-dark)' }}>Playlist Created!</h1>
            <p className="text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed px-4" style={{ color: 'var(--sc-text-light)' }}>
              "{result?.playlist?.title || playlistTitle}" has been created with {result?.totalTracks || likedTracksCount} tracks
            </p>
            <div className="space-y-3 sm:space-y-4 px-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const url = result?.permalink_url || result?.playlist?.permalink_url;
                  if (url) window.open(url, '_blank');
                }}
                className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-base sm:text-lg"
              >
                Open in SoundCloud
              </motion.button>
              <Link
                to="/dashboard"
                className="block w-full text-center px-6 py-3 rounded-lg border-2 hover:border-[#FF5500] transition-all text-base sm:text-lg"
                style={{ background: 'var(--sc-white)', color: 'var(--sc-text-dark)', borderColor: 'var(--sc-light-gray)' }}
              >
                Back to Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--sc-light-gray)' }}>
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl pb-32 sm:pb-32">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-12"
        >
          <div className="flex items-center mb-3 sm:mb-4">
            <Link to="/dashboard" className="mr-3 sm:mr-4">
              <button className="p-2 rounded-lg sc-focus transition-colors" style={{ color: 'var(--sc-text-light)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sc-white)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3" style={{ color: 'var(--sc-text-dark)' }}>Likes → Playlist</h1>
          <p className="text-base sm:text-lg" style={{ color: 'var(--sc-text-light)' }}>Convert your liked tracks into an organized playlist</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 sm:space-y-8"
        >
          {/* Liked Tracks */}
          <div className="rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg border-2" style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center shadow-lg flex-shrink-0">
                  <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--sc-text-dark)' }}>Your Liked Tracks</h2>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--sc-text-light)' }}>{likedTracksCount} tracks</p>
                </div>
              </div>
              <Play className="w-6 h-6 sm:w-8 sm:h-8 text-[#FF5500] flex-shrink-0" />
            </div>

            <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              {!loadingPage && likes.length === 0 && (
                <div className="rounded-xl p-6 sm:p-8 text-center border-2" style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--sc-text-light)' }}>No liked tracks yet. Start liking tracks on SoundCloud to see them here.</p>
                </div>
              )}
              {likes.map((item: any, index: number) => {
                const t = item?.track || item;
                const id = Number(t?.id);
                const isChecked = selected.has(id);
                const artwork = t?.artwork_url || t?.user?.avatar_url || '';
                return (
                  <motion.label
                    key={id || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    whileHover={{ scale: 1.01 }}
                    className={`flex items-center space-x-2 sm:space-x-4 p-3 sm:p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      isChecked ? 'border-[#FF5500]' : 'hover:border-[#FF5500]'
                    }`}
                    style={{ 
                      background: isChecked ? 'rgba(255, 85, 0, 0.1)' : 'var(--sc-white)', 
                      borderColor: isChecked ? '#FF5500' : 'var(--sc-light-gray)' 
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else {
                            if (next.size >= MAX) {
                              alert('You can select up to 500 tracks.');
                              return next;
                            }
                            next.add(id);
                          }
                          return next;
                        });
                      }}
                      className="w-4 h-4 sm:w-5 sm:h-5 sc-focus flex-shrink-0"
                    />
                    <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
                      {artwork ? (
                        <img src={artwork} alt="art" className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover shadow-md flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex-shrink-0" style={{ background: 'var(--sc-light-gray)' }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm sm:text-base font-semibold truncate" style={{ color: 'var(--sc-text-dark)' }}>{t?.title || 'Untitled'}</div>
                        <div className="text-xs sm:text-sm truncate" style={{ color: 'var(--sc-text-light)' }}>{t?.user?.username || 'Unknown'}</div>
                      </div>
                    </div>
                  </motion.label>
                );
              })}
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 pt-4 border-t text-xs sm:text-sm" style={{ borderColor: 'var(--sc-light-gray)' }}>
              <div className="flex gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    setSelected(prev => {
                      const next = new Set(prev);
                      for (const item of likes) {
                        const id = Number((item?.track || item)?.id);
                        if (!next.has(id)) {
                          if (next.size >= MAX) break;
                          next.add(id);
                        }
                      }
                      return next;
                    });
                  }}
                  className="text-[#FF5500] hover:text-[#E64A00] font-medium transition-colors"
                >
                  Select All (loaded)
                </button>
                <button
                  onClick={fetchLikesFirstPage}
                  className="text-[#FF5500] hover:text-[#E64A00] font-medium transition-colors"
                >
                  Refresh
                </button>
              </div>
              <span className="font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Selected {selected.size} / {MAX}</span>
            </div>
            {nextHref && (
              <div className="mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loadingPage}
                  onClick={fetchNextPage}
                  className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl border-2 hover:border-[#FF5500] transition-all font-medium disabled:opacity-50 text-sm sm:text-base"
                  style={{ borderColor: 'var(--sc-light-gray)', color: 'var(--sc-text-dark)' }}
                >
                  {loadingPage ? 'Loading…' : 'Load More Tracks'}
                </motion.button>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg border-2" style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}>
            <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6" style={{ color: 'var(--sc-text-dark)' }}>Playlist Settings</h3>
            <div>
              <label className="block text-sm sm:text-base font-semibold mb-2 sm:mb-3" style={{ color: 'var(--sc-text-dark)' }}>Playlist Name</label>
              <input
                type="text"
                value={playlistTitle}
                onChange={(e) => setPlaylistTitle(e.target.value)}
                className="w-full px-4 sm:px-5 py-3 sm:py-4 text-base sm:text-lg rounded-xl sc-focus hover:border-[#FF5500] transition-all border-2"
                style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)', color: 'var(--sc-text-dark)' }}
                placeholder="My Liked Songs"
              />
            </div>
          </div>

          {/* Sticky Action Bar */}
          <div className="fixed left-0 right-0 bottom-0 z-40 border-t-2 shadow-2xl" style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}>
            <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
              <div className="text-base sm:text-lg font-semibold" style={{ color: 'var(--sc-text-dark)' }}>
                Selected <span className="text-[#FF5500]">{selected.size}</span> / {MAX}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={!playlistTitle.trim() || isProcessing || selected.size === 0}
                onClick={handleCreatePlaylist}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating Playlist...</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span>Create Playlist</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default LikesToPlaylist;