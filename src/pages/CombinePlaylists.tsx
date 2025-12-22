import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, X, Combine, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { emitToast } from '../lib/toast';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

interface Playlist {
  id: number;
  title: string;
  track_count: number;
  artwork_url: string;
  coverUrl?: string;
}

function CombinePlaylists() {
  const [selectedPlaylists, setSelectedPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);

  useEffect(() => { fetchPlaylists(); }, []);

  const fetchPlaylists = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/playlists`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUserPlaylists(data.collection || []);
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    } finally { setLoading(false); }
  };

  const handlePlaylistToggle = (playlist: Playlist) => {
    const idNum = Number(playlist.id);
    setSelectedPlaylists(prev => prev.find(p => Number(p.id) === idNum) ? prev.filter(p => Number(p.id) !== idNum) : [...prev, { ...playlist, id: idNum }]);
  };

  const handleCombine = async () => {
    if (selectedPlaylists.length < 2 || !newPlaylistTitle.trim()) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/api/playlists/merge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ sourcePlaylistIds: selectedPlaylists.map(p => p.id), title: newPlaylistTitle }) });
      if (response.ok) { 
        const data = await response.json(); 
        setResult(data); 
        setIsComplete(true); 
        const numPlaylists = data.playlists ? data.playlists.length : 1;
        const message = numPlaylists > 1 
          ? `${numPlaylists} playlists created from merge` 
          : 'Playlist created from merge';
        emitToast({ message, variant: 'success' }); 
      } else { 
        const error = await response.json(); 
        console.error('Failed to merge playlists:', error); 
        emitToast({ message: 'Failed to merge playlists', variant: 'error' }); 
      }
    } catch (error) { console.error('Error merging playlists:', error); emitToast({ message: 'An error occurred. Please try again.', variant: 'error' }); } finally { setIsProcessing(false); }
  };

  const totalTracks = selectedPlaylists.reduce((sum, playlist) => sum + (playlist.track_count || 0), 0);

  if (isComplete) {
    const playlists = result?.playlists || (result?.playlist ? [result.playlist] : []);
    const numPlaylists = playlists.length;
    const totalTracksCreated = result?.stats?.totalTracks || result?.stats?.finalCount || result?.totalTracks || 0;
    const uniqueTracks = result?.stats?.uniqueBeforeCap || totalTracksCreated;

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
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333]">
              {numPlaylists > 1 ? `${numPlaylists} Playlists Created!` : 'Playlist Created!'}
            </h1>
            <p className="text-lg text-[#666666] mb-8 leading-relaxed">
              {numPlaylists > 1 ? (
                <>
                  {uniqueTracks} unique tracks found after deduplication. Split into {numPlaylists} playlists (500 tracks each).
                </>
              ) : (
                <>
                  "{playlists[0]?.title || newPlaylistTitle}" has been created with {totalTracksCreated} tracks (duplicates removed)
                </>
              )}
            </p>
            <div className="space-y-4">
              {playlists.map((playlist: any, index: number) => (
                <motion.button
                  key={playlist.id || index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { 
                    const url = playlist.permalink_url; 
                    if (url) window.open(url, '_blank'); 
                  }} 
                  className="w-full px-8 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg"
                >
                  {numPlaylists > 1 ? `Open Playlist ${index + 1} (${playlist.title || `${newPlaylistTitle} (${index + 1}/${numPlaylists})`})` : 'Open in SoundCloud'}
                </motion.button>
              ))}
              <Link to="/dashboard" className="block w-full text-center px-6 py-3 rounded-lg border-2 border-gray-200 hover:border-[#FF5500] transition-all" style={{ background: 'white', color: 'var(--sc-text-dark)' }}>Back to Dashboard</Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
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
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-[#333333]">Combine Playlists</h1>
          <p className="text-lg text-[#666666]">Merge multiple playlists and remove duplicates automatically</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Playlist Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-2xl font-bold mb-6 text-[#333333]">Select Playlists</h2>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="p-6 bg-white border-2 border-gray-200 rounded-xl animate-pulse">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 rounded-lg" style={{ background: 'var(--sc-light-gray)' }} />
                      <div className="flex-1">
                        <div className="h-5 rounded w-3/4 mb-2" style={{ background: 'var(--sc-light-gray)' }} />
                        <div className="h-4 rounded w-1/2" style={{ background: 'var(--sc-light-gray)' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : userPlaylists.length === 0 ? (
              <div className="bg-white border-2 border-gray-200 rounded-xl p-8 text-center" style={{ color: 'var(--sc-text-light)' }}>
                <p className="text-lg">No playlists yet. Create some on SoundCloud!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userPlaylists.map((playlist, index) => {
                  const isSelected = selectedPlaylists.find(p => p.id === playlist.id);
                  return (
                    <motion.div
                      key={playlist.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handlePlaylistToggle(playlist)}
                      className={`p-6 bg-white border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                        isSelected ? 'border-[#FF5500] shadow-lg' : 'border-gray-200 hover:border-[#FF5500]'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <img 
                          src={playlist.coverUrl || playlist.artwork_url || 'https://via.placeholder.com/96?text=Playlist'} 
                          alt={playlist.title} 
                          className="w-16 h-16 rounded-lg object-cover shadow-md" 
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/96?text=Playlist'; }} 
                        />
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1 text-[#333333]">{playlist.title}</h3>
                          <p className="text-sm text-[#666666]">{playlist.track_count} tracks</p>
                        </div>
                        {isSelected && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center shadow-lg">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Selected Playlists & Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold mb-6 text-[#333333]">Selected ({selectedPlaylists.length})</h2>
            <div className="space-y-3 mb-8">
              <AnimatePresence>
                {selectedPlaylists.map(playlist => (
                  <motion.div
                    key={playlist.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-4 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-between hover:border-[#FF5500] transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={playlist.coverUrl || playlist.artwork_url || 'https://via.placeholder.com/64?text=Playlist'}
                        alt={playlist.title}
                        className="w-12 h-12 rounded-lg object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/64?text=Playlist'; }}
                      />
                      <span className="font-medium text-[#333333]">{playlist.title}</span>
                    </div>
                    <button
                      onClick={() => handlePlaylistToggle(playlist)}
                      className="p-2 rounded-lg sc-focus hover:bg-gray-100 transition-colors"
                      style={{ color: 'var(--sc-text-light)' }}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {selectedPlaylists.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-base font-semibold mb-3 text-[#333333]">New Playlist Name</label>
                  <input
                    type="text"
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    placeholder="Enter playlist name..."
                    className="w-full px-5 py-4 text-lg bg-white border-2 border-gray-200 rounded-xl sc-focus hover:border-[#FF5500] transition-all"
                  />
                </div>
                <div className="p-6 bg-white border-2 border-gray-200 rounded-xl">
                  <div className="flex justify-between text-base mb-2">
                    <span className="text-[#666666]">Total tracks:</span>
                    <span className="font-semibold text-[#333333]">{totalTracks}</span>
                  </div>
                  <div className="flex justify-between text-base mb-2">
                    <span className="text-[#666666]">Estimated after deduplication:</span>
                    <span className="font-semibold" style={{ color: '#22c55e' }}>{Math.floor(totalTracks * 0.85)}</span>
                  </div>
                  {Math.floor(totalTracks * 0.85) > 500 && (
                    <div className="flex justify-between text-sm mt-4 pt-4 border-t" style={{ borderColor: 'var(--sc-light-gray)' }}>
                      <span className="text-[#666666]">Note:</span>
                      <span className="font-semibold text-[#FF5500]">Will create {Math.ceil(Math.floor(totalTracks * 0.85) / 500)} playlist(s)</span>
                    </div>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!newPlaylistTitle.trim() || isProcessing}
                  onClick={handleCombine}
                  className="w-full px-8 py-4 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-orange-500/30 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Combine className="w-6 h-6" />
                      <span>Combine Playlists</span>
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
            {selectedPlaylists.length === 1 && (
              <div className="p-6 bg-white border-2 border-gray-200 rounded-xl text-center">
                <p className="text-[#666666]">Select at least 2 playlists to combine</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default CombinePlaylists;