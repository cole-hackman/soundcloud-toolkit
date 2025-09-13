import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Play, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = 'http://localhost:3001';

function LikesToPlaylist() {
  const [playlistTitle, setPlaylistTitle] = useState('My Liked Songs');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [likedTracksCount, setLikedTracksCount] = useState(0);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchLikesCount();
  }, []);

  const fetchLikesCount = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/likes?limit=1`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // Get total count from the response or estimate from collection
        setLikedTracksCount(data.collection?.length || 0);
      }
    } catch (error) {
      console.error('Failed to fetch likes count:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!playlistTitle.trim()) return;
    
    setIsProcessing(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/playlists/from-likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: playlistTitle
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setIsComplete(true);
      } else {
        const error = await response.json();
        console.error('Failed to create playlist from likes:', error);
        alert('Failed to create playlist. Please try again.');
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
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
          <h1 className="text-3xl font-bold text-white mb-4">Playlist Created!</h1>
          <p className="text-slate-400 mb-8">
            "{result?.playlist?.title || playlistTitle}" has been created with {result?.totalTracks || likedTracksCount} tracks
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
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center mb-8">
        <Link to="/dashboard" className="mr-4">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">Likes → Playlist</h1>
          <p className="text-slate-400">Convert your liked tracks into a playlist</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Liked Tracks Preview */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Your Liked Tracks</h2>
                <p className="text-slate-400">{likedTracksCount} tracks</p>
              </div>
            </div>
            <Play className="w-6 h-6 text-blue-400" />
          </div>
          
          {/* Sample tracks */}
          <div className="space-y-2">
            {[
              { title: 'Midnight City', artist: 'M83' },
              { title: 'Strobe', artist: 'Deadmau5' },
              { title: 'Breathe Me', artist: 'Sia' },
              { title: 'Teardrop', artist: 'Massive Attack' }
            ].map((track, index) => (
              <div key={index} className="flex items-center space-x-3 p-2 rounded-lg bg-slate-700/30">
                <div className="w-8 h-8 bg-slate-600 rounded"></div>
                <div>
                  <div className="text-sm font-medium text-white">{track.title}</div>
                  <div className="text-xs text-slate-400">{track.artist}</div>
                </div>
              </div>
            ))}
            <div className="text-center py-2 text-slate-400 text-sm">
              ...and {likedTracksCount - 4} more tracks
            </div>
          </div>
        </div>

        {/* Playlist Configuration */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Playlist Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Playlist Name
              </label>
              <input
                type="text"
                value={playlistTitle}
                onChange={(e) => setPlaylistTitle(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Privacy</div>
                <div className="text-xs text-slate-400">Playlist will be set to public</div>
              </div>
              <div className="w-12 h-6 bg-blue-600 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={!playlistTitle.trim() || isProcessing}
          onClick={handleCreatePlaylist}
          className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center space-x-2 ${
            playlistTitle.trim() && !isProcessing
              ? 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg hover:shadow-pink-500/25'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creating Playlist...</span>
            </>
          ) : (
            <>
              <Heart className="w-5 h-5" />
              <span>Create Playlist ({likedTracksCount} tracks)</span>
            </>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}

export default LikesToPlaylist;