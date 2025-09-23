import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, X, Combine, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { emitToast } from '../lib/toast';

const API_BASE = '';

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
      if (response.ok) { const data = await response.json(); setResult(data); setIsComplete(true); emitToast({ message: 'Playlist created from merge', variant: 'success' }); } else { const error = await response.json(); console.error('Failed to merge playlists:', error); emitToast({ message: 'Failed to merge playlists', variant: 'error' }); }
    } catch (error) { console.error('Error merging playlists:', error); emitToast({ message: 'An error occurred. Please try again.', variant: 'error' }); } finally { setIsProcessing(false); }
  };

  const totalTracks = selectedPlaylists.reduce((sum, playlist) => sum + (playlist.track_count || 0), 0);

  if (isComplete) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center sc-card p-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#22c55e' }}>
            <Check className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Playlist Created!</h1>
          <p className="mt-3" style={{ color: 'var(--sc-text-light)' }}>
            "{result?.playlist?.title || newPlaylistTitle}" has been created with {result?.totalTracks || totalTracks} tracks (duplicates removed)
          </p>
          <div className="space-y-3 mt-6">
            <button onClick={() => { const url = result?.playlist?.permalink_url || result?.permalink_url; if (url) window.open(url, '_blank'); }} className="w-full sc-primary-button">Open in SoundCloud</button>
            <Link to="/dashboard" className="block w-full text-center px-4 py-3 rounded" style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-dark)' }}>Back to Dashboard</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Link to="/dashboard" className="mr-4"><button className="p-2 rounded sc-focus" style={{ color: 'var(--sc-text-light)' }}><ArrowLeft className="w-5 h-5" /></button></Link>
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Combine Playlists</h1>
          <p style={{ color: 'var(--sc-text-light)' }}>Merge multiple playlists and remove duplicates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Playlist Selection */}
        <div>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--sc-text-dark)' }}>Select Playlists</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="p-4 sc-card animate-pulse">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded" style={{ background: 'var(--sc-light-gray)' }} />
                    <div className="flex-1">
                      <div className="h-4 rounded w-3/4 mb-2" style={{ background: 'var(--sc-light-gray)' }} />
                      <div className="h-3 rounded w-1/2" style={{ background: 'var(--sc-light-gray)' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : userPlaylists.length === 0 ? (
            <div className="sc-card p-6 text-center" style={{ color: 'var(--sc-text-light)' }}>
              No playlists yet. Create some on SoundCloud!
            </div>
          ) : (
            <div className="space-y-3">
              {userPlaylists.map(playlist => (
                <motion.div key={playlist.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => handlePlaylistToggle(playlist)} className={`p-4 sc-hover-card sc-card cursor-pointer ${selectedPlaylists.find(p => p.id === playlist.id) ? '' : ''}`} style={{ borderColor: selectedPlaylists.find(p => p.id === playlist.id) ? 'var(--sc-orange)' : 'var(--sc-light-gray)' }}>
                  <div className="flex items-center space-x-4">
                    <img src={playlist.coverUrl || playlist.artwork_url || 'https://via.placeholder.com/96?text=Playlist'} alt={playlist.title} className="w-12 h-12 rounded object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/96?text=Playlist'; }} />
                    <div className="flex-1">
                      <h3 className="font-semibold" style={{ color: 'var(--sc-text-dark)' }}>{playlist.title}</h3>
                      <p className="text-sm" style={{ color: 'var(--sc-text-light)' }}>{playlist.track_count} tracks</p>
                    </div>
                    {selectedPlaylists.find(p => p.id === playlist.id) && (<Check className="w-5 h-5" style={{ color: 'var(--sc-orange)' }} />)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Playlists & Options */}
        <div>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--sc-text-dark)' }}>Selected ({selectedPlaylists.length})</h2>
          <div className="space-y-3 mb-6">
            <AnimatePresence>
              {selectedPlaylists.map(playlist => (
                <motion.div key={playlist.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-3 sc-card flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={playlist.coverUrl || playlist.artwork_url || 'https://via.placeholder.com/64?text=Playlist'}
                      alt={playlist.title}
                      className="w-8 h-8 rounded object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/64?text=Playlist'; }}
                    />
                    <span className="text-sm" style={{ color: 'var(--sc-text-dark)' }}>{playlist.title}</span>
                  </div>
                  <button onClick={() => handlePlaylistToggle(playlist)} className="p-2 rounded sc-focus" style={{ color: 'var(--sc-text-light)' }}><X className="w-4 h-4" /></button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {selectedPlaylists.length >= 2 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--sc-text-dark)' }}>New Playlist Name</label>
                <input type="text" value={newPlaylistTitle} onChange={(e) => setNewPlaylistTitle(e.target.value)} placeholder="Enter playlist name..." className="w-full px-4 py-3 sc-input sc-focus" />
              </div>
              <div className="p-4 sc-card">
                <div className="flex justify-between text-sm"><span style={{ color: 'var(--sc-text-light)' }}>Total tracks:</span><span style={{ color: 'var(--sc-text-dark)' }}>{totalTracks}</span></div>
                <div className="flex justify-between text-sm mt-1"><span style={{ color: 'var(--sc-text-light)' }}>Estimated after deduplication:</span><span style={{ color: '#22c55e' }}>{Math.floor(totalTracks * 0.85)}</span></div>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={!newPlaylistTitle.trim() || isProcessing} onClick={handleCombine} className="w-full sc-primary-button">
                {isProcessing ? (<><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2" /><span>Processing...</span></>) : (<><Combine className="w-5 h-5 mr-2" /><span>Combine Playlists</span></>)}
              </motion.button>
            </motion.div>
          )}
          {selectedPlaylists.length === 1 && (<p className="text-sm" style={{ color: 'var(--sc-text-light)' }}>Select at least 2 playlists to combine</p>)}
        </div>
      </div>
    </div>
  );
}

export default CombinePlaylists;