import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Trash2, Check, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  artwork_url: string;
  is_duplicate?: boolean;
  duplicate_group?: string;
}

interface Playlist {
  id: number;
  title: string;
  track_count: number;
  artwork_url: string;
}

function SmartDeduplication() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [duplicates, setDuplicates] = useState<Track[]>([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/playlists`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserPlaylists(data.collection || []);
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock duplicate tracks
  const mockDuplicates: Track[] = [
    {
      id: '1',
      title: 'Midnight City',
      artist: 'M83',
      duration: '4:03',
      artwork_url: 'https://images.pexels.com/photos/167092/pexels-photo-167092.jpeg?w=150&h=150&fit=crop',
      duplicate_group: 'group1'
    },
    {
      id: '2',
      title: 'Midnight City (Remix)',
      artist: 'M83',
      duration: '4:03',
      artwork_url: 'https://images.pexels.com/photos/167092/pexels-photo-167092.jpeg?w=150&h=150&fit=crop',
      duplicate_group: 'group1'
    },
    {
      id: '3',
      title: 'Strobe',
      artist: 'Deadmau5',
      duration: '10:34',
      artwork_url: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?w=150&h=150&fit=crop',
      duplicate_group: 'group2'
    },
    {
      id: '4',
      title: 'Strobe',
      artist: 'Deadmau5',
      duration: '10:34',
      artwork_url: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?w=150&h=150&fit=crop',
      duplicate_group: 'group2'
    }
  ];

  const handleScanPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setIsScanning(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/playlists/deduplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          playlistId: playlist.id,
          confirm: false
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Convert API response to our Track format
        const duplicateTracks: Track[] = data.duplicates?.map((track: any, index: number) => ({
          id: track.id.toString(),
          title: track.title,
          artist: track.user?.username || 'Unknown',
          duration: Math.floor(track.duration / 1000 / 60) + ':' + String(Math.floor((track.duration / 1000) % 60)).padStart(2, '0'),
          artwork_url: track.artwork_url || '',
          duplicate_group: `group${Math.floor(index / 2) + 1}`
        })) || [];
        
        setDuplicates(duplicateTracks);
        setSelectedDuplicates(duplicateTracks.slice(1).map(t => t.id)); // Auto-select duplicates
      } else {
        console.error('Failed to scan playlist for duplicates');
        alert('Failed to scan playlist. Please try again.');
      }
    } catch (error) {
      console.error('Error scanning playlist:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    if (!selectedPlaylist) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/playlists/deduplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          playlistId: selectedPlaylist.id,
          confirm: true
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setIsComplete(true);
      } else {
        const error = await response.json();
        console.error('Failed to remove duplicates:', error);
        alert('Failed to remove duplicates. Please try again.');
      }
    } catch (error) {
      console.error('Error removing duplicates:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const toggleDuplicate = (trackId: string) => {
    setSelectedDuplicates(prev => 
      prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  };

  if (isComplete) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Duplicates Removed!</h1>
          <p className="text-slate-400 mb-8">
            Successfully removed {result?.duplicateCount || selectedDuplicates.length} duplicate tracks from "{selectedPlaylist?.title}"
          </p>
          <div className="space-y-4">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors">
              Open Playlist in SoundCloud
            </button>
            <Link 
              to="/dashboard"
              className="block w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors text-center"
            >
              Back to Dashboard
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center mb-8">
        <Link to="/dashboard" className="mr-4">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">Smart Deduplication</h1>
          <p className="text-slate-400">Find and remove duplicate tracks from your playlists</p>
        </div>
      </div>

      {!selectedPlaylist ? (
        /* Playlist Selection */
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Select a Playlist to Scan</h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="p-6 bg-slate-800/50 rounded-xl border border-slate-700 animate-pulse">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-slate-700 rounded-lg" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-slate-700 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userPlaylists.map(playlist => (
              <motion.button
                key={playlist.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleScanPlaylist(playlist)}
                className="p-6 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 hover:border-blue-500/50 transition-all text-left"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={playlist.artwork_url}
                    alt={playlist.title}
                    className="w-16 h-16 rounded-lg"
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{playlist.title}</h3>
                    <p className="text-slate-400">{playlist.track_count} tracks</p>
                  </div>
                  <Search className="w-6 h-6 text-blue-400 ml-auto" />
                </div>
              </motion.button>
            ))}
            </div>
          )}
        </div>
      ) : isScanning ? (
        /* Scanning State */
        <div className="text-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6"
          />
          <h2 className="text-2xl font-bold text-white mb-2">Scanning for Duplicates</h2>
          <p className="text-slate-400">Analyzing "{selectedPlaylist.title}"...</p>
        </div>
      ) : (
        /* Results */
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Duplicates Found</h2>
              <p className="text-slate-400">
                Found {duplicates.length} potential duplicates in "{selectedPlaylist.title}"
              </p>
            </div>
            <button
              onClick={() => setSelectedPlaylist(null)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Scan Different Playlist
            </button>
          </div>

          {duplicates.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No Duplicates Found!</h3>
              <p className="text-slate-400">Your playlist is already clean.</p>
            </div>
          ) : (
            <>
              {/* Duplicate Groups */}
              <div className="space-y-6 mb-8">
                {['group1', 'group2'].map(group => {
                  const groupTracks = duplicates.filter(track => track.duplicate_group === group);
                  return (
                    <div key={group} className="bg-slate-800/30 rounded-xl p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        <span className="text-white font-medium">Duplicate Group</span>
                      </div>
                      <div className="space-y-2">
                        {groupTracks.map(track => (
                          <motion.div
                            key={track.id}
                            className={`flex items-center space-x-4 p-3 rounded-lg cursor-pointer transition-all ${
                              selectedDuplicates.includes(track.id)
                                ? 'bg-red-500/20 border border-red-500/50'
                                : 'bg-slate-700/30 hover:bg-slate-700/50'
                            }`}
                            onClick={() => toggleDuplicate(track.id)}
                          >
                            <img
                              src={track.artwork_url}
                              alt={track.title}
                              className="w-12 h-12 rounded-lg"
                            />
                            <div className="flex-1">
                              <h4 className="text-white font-medium">{track.title}</h4>
                              <p className="text-slate-400 text-sm">{track.artist} • {track.duration}</p>
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedDuplicates.includes(track.id)
                                ? 'bg-red-500 border-red-500'
                                : 'border-slate-400'
                            }`}>
                              {selectedDuplicates.includes(track.id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={selectedDuplicates.length === 0}
                onClick={handleRemoveDuplicates}
                className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center space-x-2 ${
                  selectedDuplicates.length > 0
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-5 h-5" />
                <span>Remove {selectedDuplicates.length} Selected Duplicates</span>
              </motion.button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SmartDeduplication;