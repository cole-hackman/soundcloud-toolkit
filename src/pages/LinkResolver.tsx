import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Link as LinkIcon, Search, ExternalLink, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

type ResolvedTrack = { type: 'track'; id: number; title: string; user: { id: number; username: string }; duration_ms: number; permalink_url: string; artwork_url?: string };
type ResolvedPlaylist = { type: 'playlist'; id: number; title: string; user: { id: number; username: string }; track_count: number; permalink_url: string; artwork_url?: string };
type ResolvedUser = { type: 'user'; id: number; username: string; followers_count?: number; permalink_url: string; avatar_url?: string };
type ResolvedContent = ResolvedTrack | ResolvedPlaylist | ResolvedUser;

function LinkResolver() {
  const [inputUrl, setInputUrl] = useState('');
  const [resolvedContent, setResolvedContent] = useState<ResolvedContent | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';
  const handleResolve = async () => {
    if (!inputUrl.trim()) return;
    setIsResolving(true); setError(''); setResolvedContent(null);
    try {
      const res = await fetch(`${API_BASE}/api/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ url: inputUrl.trim() }) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to resolve URL'); }
      const data = await res.json(); setResolvedContent(data as ResolvedContent);
    } catch (e) { setError((e as Error).message); } finally { setIsResolving(false); }
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const exampleUrls = ['https://soundcloud.com/artist/track-name','https://soundcloud.com/user/sets/playlist-name','https://soundcloud.com/username'];

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
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-[#333333]">Link Resolver</h1>
          <p className="text-lg text-[#666666]">Get detailed information from any SoundCloud link</p>
        </motion.div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border-2 border-gray-200 rounded-2xl p-8 mb-6 shadow-lg"
        >
          <label className="block text-base font-semibold mb-4 text-[#333333]">SoundCloud URL</label>
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Paste SoundCloud URL here..."
                className="w-full px-5 py-4 pl-14 text-lg bg-white border-2 border-gray-200 rounded-xl sc-focus hover:border-[#FF5500] transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
              />
              <LinkIcon className="absolute left-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#666666]" />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!inputUrl.trim() || isResolving}
              onClick={handleResolve}
              className={`px-8 py-4 rounded-xl font-semibold sc-focus transition-all ${
                inputUrl.trim() && !isResolving
                  ? 'bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-xl hover:shadow-orange-500/30'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isResolving ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-6 h-6" />
              )}
            </motion.button>
          </div>
          {/* Example URLs */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm font-medium mb-3 text-[#666666]">Example URLs:</p>
            <div className="space-y-2">
              {exampleUrls.map((url, index) => (
                <button
                  key={index}
                  onClick={() => setInputUrl(url)}
                  className="block text-sm text-[#FF5500] hover:text-[#E64A00] transition-colors text-left"
                >
                  {url}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border-2 border-red-200 rounded-xl p-6 mb-6"
            style={{ background: '#fef2f2' }}
          >
            <p className="text-base font-medium text-red-600">{error}</p>
          </motion.div>
        )}

        {/* Empty */}
        {!error && !resolvedContent && !isResolving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border-2 border-gray-200 rounded-xl p-12 text-center"
          >
            <LinkIcon className="w-16 h-16 mx-auto mb-4 text-[#666666] opacity-50" />
            <p className="text-lg text-[#666666]">Enter a SoundCloud link above to get started.</p>
          </motion.div>
        )}

        {/* Result */}
        {resolvedContent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="p-8">
              <div className="flex items-start space-x-6">
                <img
                  src={(resolvedContent as any).artwork_url || (resolvedContent as any).avatar_url || 'https://via.placeholder.com/150?text=No+Image'}
                  alt={(resolvedContent as any).title || (resolvedContent as any).username}
                  className="w-24 h-24 rounded-xl object-cover shadow-lg"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image';
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span
                      className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                        resolvedContent.type === 'track'
                          ? 'bg-green-100 text-green-700'
                          : resolvedContent.type === 'playlist'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {resolvedContent.type.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-[#333333]">
                    {resolvedContent.type === 'user'
                      ? (resolvedContent as ResolvedUser).username
                      : (resolvedContent as any).title}
                  </h3>
                  {resolvedContent.type !== 'user' && (
                    <p className="text-lg text-[#666666] mb-4">{(resolvedContent as any).user?.username}</p>
                  )}
                  <div className="flex items-center space-x-6 text-base text-[#666666]">
                    {resolvedContent.type === 'track' && (
                      <span>
                        Duration:{' '}
                        {Math.floor(((resolvedContent as ResolvedTrack).duration_ms || 0) / 60000)}:
                        {String(Math.floor((((resolvedContent as ResolvedTrack).duration_ms || 0) % 60000) / 1000)).padStart(2, '0')}
                      </span>
                    )}
                    {resolvedContent.type === 'playlist' && (
                      <span className="font-semibold">{(resolvedContent as ResolvedPlaylist).track_count} tracks</span>
                    )}
                    {resolvedContent.type === 'user' &&
                      (resolvedContent as ResolvedUser).followers_count != null && (
                        <span className="font-semibold">
                          {(resolvedContent as ResolvedUser).followers_count!.toLocaleString()} followers
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t-2 border-gray-200 p-6 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-sm text-[#666666] flex-1 min-w-0">
                  <LinkIcon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{(resolvedContent as any).permalink_url}</span>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCopy((resolvedContent as any).permalink_url)}
                    className="px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-[#FF5500] transition-all bg-white"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-[#666666]" />}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.open((resolvedContent as any).permalink_url, '_blank')}
                    className="px-6 py-2 bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Open
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default LinkResolver;