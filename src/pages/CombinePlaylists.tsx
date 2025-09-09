import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, X, Combine, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Playlist {
  id: string;
  title: string;
  track_count: number;
  artwork_url: string;
}

function CombinePlaylists() {
  const [selectedPlaylists, setSelectedPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Mock playlists
  const userPlaylists: Playlist[] = [
    {
      id: '1',
      title: 'Chill Vibes',
      track_count: 24,
      artwork_url: 'https://images.pexels.com/photos/1677710/pexels-photo-1677710.jpeg?w=150&h=150&fit=crop'
    },
    {
      id: '2',
      title: 'Electronic Beats',
      track_count: 31,
      artwork_url: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?w=150&h=150&fit=crop'
    },
    {
      id: '3',
      title: 'Late Night Drive',
      track_count: 18,
      artwork_url: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?w=150&h=150&fit=crop'
    },
    {
      id: '4',
      title: 'Workout Mix',
      track_count: 27,
      artwork_url: 'https://images.pexels.com/photos/703012/pexels-photo-703012.jpeg?w=150&h=150&fit=crop'
    }
  ];

  const handlePlaylistToggle = (playlist: Playlist) => {
    setSelectedPlaylists(prev => 
      prev.find(p => p.id === playlist.id)
        ? prev.filter(p => p.id !== playlist.id)
        : [...prev, playlist]
    );
  };

  const handleCombine = async () => {
    if (selectedPlaylists.length < 2 || !newPlaylistTitle.trim()) return;
    
    setIsProcessing(true);
    
    // Simulate API processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setIsProcessing(false);
    setIsComplete(true);
  };

  const totalTracks = selectedPlaylists.reduce((sum, playlist) => sum + playlist.track_count, 0);

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
          <h1 className="text-3xl font-bold text-white mb-4">Playlist Created!</h1>
          <p className="text-slate-400 mb-8">
            "{newPlaylistTitle}" has been created with {totalTracks} tracks (duplicates removed)
          </p>
          <div className="space-y-4">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors">
              Open in SoundCloud
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
          <h1 className="text-3xl font-bold text-white">Combine Playlists</h1>
          <p className="text-slate-400">Merge multiple playlists and remove duplicates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Playlist Selection */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Select Playlists</h2>
          <div className="space-y-3">
            {userPlaylists.map(playlist => (
              <motion.div
                key={playlist.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePlaylistToggle(playlist)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedPlaylists.find(p => p.id === playlist.id)
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={playlist.artwork_url}
                    alt={playlist.title}
                    className="w-12 h-12 rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{playlist.title}</h3>
                    <p className="text-sm text-slate-400">{playlist.track_count} tracks</p>
                  </div>
                  {selectedPlaylists.find(p => p.id === playlist.id) && (
                    <Check className="w-5 h-5 text-blue-400" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Selected Playlists & Options */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Selected ({selectedPlaylists.length})</h2>
          
          <div className="space-y-3 mb-6">
            <AnimatePresence>
              {selectedPlaylists.map(playlist => (
                <motion.div
                  key={playlist.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={playlist.artwork_url}
                      alt={playlist.title}
                      className="w-8 h-8 rounded"
                    />
                    <span className="text-white text-sm">{playlist.title}</span>
                  </div>
                  <button
                    onClick={() => handlePlaylistToggle(playlist)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {selectedPlaylists.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  New Playlist Name
                </label>
                <input
                  type="text"
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  placeholder="Enter playlist name..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-4 bg-slate-800/30 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total tracks:</span>
                  <span className="text-white">{totalTracks}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-400">Estimated after deduplication:</span>
                  <span className="text-green-400">{Math.floor(totalTracks * 0.85)}</span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={!newPlaylistTitle.trim() || isProcessing}
                onClick={handleCombine}
                className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center space-x-2 ${
                  newPlaylistTitle.trim() && !isProcessing
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Combine className="w-5 h-5" />
                    <span>Combine Playlists</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {selectedPlaylists.length === 1 && (
            <p className="text-slate-400 text-sm">Select at least 2 playlists to combine</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CombinePlaylists;