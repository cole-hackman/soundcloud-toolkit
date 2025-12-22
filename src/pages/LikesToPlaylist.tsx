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
      <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center bg-white border-2 border-gray-200 rounded-2xl p-10 shadow-xl"
          >
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-lg">
              <Check className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333]">Playlist Created!</h1>
            <p className="text-lg text-[#666666] mb-8 leading-relaxed">
              "{result?.playlist?.title || playlistTitle}" has been created with {result?.totalTracks || likedTracksCount} tracks
            </p>
            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const url = result?.permalink_url || result?.playlist?.permalink_url;
                  if (url) window.open(url, '_blank');
                }}
                className="w-full px-8 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg"
              >
                Open in SoundCloud
              </motion.button>
              <Link
                to="/dashboard"
                className="block w-full text-center px-6 py-3 rounded-lg border-2 border-gray-200 hover:border-[#FF5500] transition-all"
                style={{ background: 'white', color: 'var(--sc-text-dark)' }}
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
    <div className="min-h-screen bg-[#F2F2F2]">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center mb-4">
            <Link to="/dashboard" className="mr-4">
              <button className="p-2 rounded-lg sc-focus hover:bg-white transition-colors" style={{ color: 'var(--sc-text-light)' }}>
                <ArrowLeft className="w-6 h-6" />
              </button>
            </Link>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-[#333333]">Likes → Playlist</h1>
          <p className="text-lg text-[#666666]">Convert your liked tracks into an organized playlist</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 pb-32"
        >
          {/* Liked Tracks */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center shadow-lg">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#333333]">Your Liked Tracks</h2>
                  <p className="text-lg text-[#666666]">{likedTracksCount} tracks</p>
                </div>
              </div>
              <Play className="w-8 h-8 text-[#FF5500]" />
            </div>

            <div className="space-y-3 mb-6">
              {!loadingPage && likes.length === 0 && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-8 text-center">
                  <p className="text-lg text-[#666666]">No liked tracks yet. Start liking tracks on SoundCloud to see them here.</p>
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
                    className={`flex items-center space-x-4 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      isChecked ? 'border-[#FF5500] bg-orange-50' : 'border-gray-200 bg-white hover:border-[#FF5500]'
                    }`}
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
                      className="w-5 h-5 sc-focus"
                    />
                    <div className="flex items-center space-x-4 flex-1">
                      {artwork ? (
                        <img src={artwork} alt="art" className="w-14 h-14 rounded-lg object-cover shadow-md" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg" style={{ background: 'var(--sc-light-gray)' }} />
                      )}
                      <div className="flex-1">
                        <div className="text-base font-semibold text-[#333333]">{t?.title || 'Untitled'}</div>
                        <div className="text-sm text-[#666666]">{t?.user?.username || 'Unknown'}</div>
                      </div>
                    </div>
                  </motion.label>
                );
              })}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 text-sm">
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
              <span className="font-semibold text-[#333333]">Selected {selected.size} / {MAX}</span>
            </div>
            {nextHref && (
              <div className="mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loadingPage}
                  onClick={fetchNextPage}
                  className="w-full px-6 py-3 rounded-xl border-2 border-gray-200 hover:border-[#FF5500] transition-all font-medium text-[#333333] disabled:opacity-50"
                >
                  {loadingPage ? 'Loading…' : 'Load More Tracks'}
                </motion.button>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold mb-6 text-[#333333]">Playlist Settings</h3>
            <div>
              <label className="block text-base font-semibold mb-3 text-[#333333]">Playlist Name</label>
              <input
                type="text"
                value={playlistTitle}
                onChange={(e) => setPlaylistTitle(e.target.value)}
                className="w-full px-5 py-4 text-lg bg-white border-2 border-gray-200 rounded-xl sc-focus hover:border-[#FF5500] transition-all"
                placeholder="My Liked Songs"
              />
            </div>
          </div>

          {/* Sticky Action Bar */}
          <div className="fixed left-0 right-0 bottom-0 z-40 bg-white border-t-2 border-gray-200 shadow-2xl">
            <div className="container mx-auto px-6 py-4 max-w-4xl flex items-center justify-between">
              <div className="text-lg font-semibold text-[#333333]">
                Selected <span className="text-[#FF5500]">{selected.size}</span> / {MAX}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={!playlistTitle.trim() || isProcessing || selected.size === 0}
                onClick={handleCreatePlaylist}
                className="px-8 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating Playlist...</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-6 h-6" />
                    <span>Create Playlist</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
    </div>
  );
}

export default LikesToPlaylist;