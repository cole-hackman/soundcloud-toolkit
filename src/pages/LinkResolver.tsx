import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Link as LinkIcon, Search, ExternalLink, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ResolvedContent {
  type: 'track' | 'playlist' | 'user';
  title: string;
  description: string;
  artwork_url?: string;
  avatar_url?: string;
  duration?: string;
  track_count?: number;
  followers?: number;
  url: string;
}

function LinkResolver() {
  const [inputUrl, setInputUrl] = useState('');
  const [resolvedContent, setResolvedContent] = useState<ResolvedContent | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleResolve = async () => {
    if (!inputUrl.trim()) return;
    
    setIsResolving(true);
    setError('');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock resolution based on URL pattern
    if (inputUrl.includes('/tracks/') || inputUrl.includes('soundcloud.com') && !inputUrl.includes('/sets/') && !inputUrl.includes('/users/')) {
      setResolvedContent({
        type: 'track',
        title: 'Midnight City',
        description: 'M83 • Hurry Up, We\'re Dreaming',
        artwork_url: 'https://images.pexels.com/photos/167092/pexels-photo-167092.jpeg?w=300&h=300&fit=crop',
        duration: '4:03',
        url: inputUrl
      });
    } else if (inputUrl.includes('/sets/')) {
      setResolvedContent({
        type: 'playlist',
        title: 'Chill Electronic Vibes',
        description: 'A collection of ambient electronic tracks',
        artwork_url: 'https://images.pexels.com/photos/1677710/pexels-photo-1677710.jpeg?w=300&h=300&fit=crop',
        track_count: 24,
        url: inputUrl
      });
    } else if (inputUrl.includes('/users/')) {
      setResolvedContent({
        type: 'user',
        title: 'ElectronicBeats',
        description: 'Electronic music producer and DJ',
        avatar_url: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?w=300&h=300&fit=crop',
        followers: 15420,
        url: inputUrl
      });
    } else {
      setError('Invalid SoundCloud URL. Please check the URL and try again.');
    }
    
    setIsResolving(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exampleUrls = [
    'https://soundcloud.com/artist/track-name',
    'https://soundcloud.com/user/sets/playlist-name',
    'https://soundcloud.com/username'
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center mb-8">
        <Link to="/dashboard" className="mr-4">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">Link Resolver</h1>
          <p className="text-slate-400">Get detailed information from any SoundCloud link</p>
        </div>
      </div>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 mb-6"
      >
        <label className="block text-sm font-medium text-slate-300 mb-3">
          SoundCloud URL
        </label>
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Paste SoundCloud URL here..."
              className="w-full px-4 py-3 pl-12 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            <LinkIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!inputUrl.trim() || isResolving}
            onClick={handleResolve}
            className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center space-x-2 ${
              inputUrl.trim() && !isResolving
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isResolving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </motion.button>
        </div>

        {/* Example URLs */}
        <div className="mt-4">
          <p className="text-xs text-slate-400 mb-2">Example URLs:</p>
          <div className="space-y-1">
            {exampleUrls.map((url, index) => (
              <button
                key={index}
                onClick={() => setInputUrl(url)}
                className="block text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {url}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Loading State */}
      {isResolving && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8"
        >
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Resolving link...</p>
        </motion.div>
      )}

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6"
        >
          <p className="text-red-400 text-sm">{error}</p>
        </motion.div>
      )}

      {/* Resolved Content */}
      {resolvedContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden"
        >
          {/* Content Header */}
          <div className="p-6">
            <div className="flex items-start space-x-4">
              <img
                src={resolvedContent.artwork_url || resolvedContent.avatar_url}
                alt={resolvedContent.title}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    resolvedContent.type === 'track' ? 'bg-green-500/20 text-green-400' :
                    resolvedContent.type === 'playlist' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {resolvedContent.type.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-1">{resolvedContent.title}</h3>
                <p className="text-slate-400 text-sm mb-3">{resolvedContent.description}</p>
                
                {/* Metadata */}
                <div className="flex items-center space-x-4 text-sm text-slate-400">
                  {resolvedContent.duration && (
                    <span>Duration: {resolvedContent.duration}</span>
                  )}
                  {resolvedContent.track_count && (
                    <span>{resolvedContent.track_count} tracks</span>
                  )}
                  {resolvedContent.followers && (
                    <span>{resolvedContent.followers.toLocaleString()} followers</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-slate-700/50 p-4 bg-slate-800/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-slate-400">
                <LinkIcon className="w-4 h-4" />
                <span className="truncate max-w-md">{resolvedContent.url}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleCopy(resolvedContent.url)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors flex items-center space-x-1"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.open(resolvedContent.url, '_blank')}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center space-x-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open</span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default LinkResolver;