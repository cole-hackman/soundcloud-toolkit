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
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Link to="/dashboard" className="mr-4"><button className="p-2 rounded sc-focus" style={{ color: 'var(--sc-text-light)' }}><ArrowLeft className="w-5 h-5" /></button></Link>
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Link Resolver</h1>
          <p style={{ color: 'var(--sc-text-light)' }}>Get detailed information from any SoundCloud link</p>
        </div>
      </div>

      {/* Input Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="sc-card p-6 mb-6">
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--sc-text-dark)' }}>SoundCloud URL</label>
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <input type="url" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} placeholder="Paste SoundCloud URL here..." className="w-full px-4 py-3 pl-12 sc-input sc-focus" />
            <LinkIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--sc-text-light)' }} />
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={!inputUrl.trim() || isResolving} onClick={handleResolve} className={`px-6 py-3 rounded font-semibold sc-focus ${inputUrl.trim() && !isResolving ? 'sc-primary-button' : ''}`} style={!inputUrl.trim() || isResolving ? { background: 'var(--sc-light-gray)', color: 'var(--sc-text-light)' } : {}}>
            {isResolving ? (<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />) : (<Search className="w-5 h-5 text-white" />)}
          </motion.button>
        </div>
        {/* Example URLs */}
        <div className="mt-4">
          <p className="text-xs mb-2" style={{ color: 'var(--sc-text-light)' }}>Example URLs:</p>
          <div className="space-y-1">
            {exampleUrls.map((url, index) => (<button key={index} onClick={() => setInputUrl(url)} className="block text-xs" style={{ color: 'var(--sc-orange)' }}>{url}</button>))}
          </div>
        </div>
      </motion.div>

      {/* Error */}
      {error && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sc-card p-4" style={{ borderColor: '#fecaca' }}><p style={{ color: '#ef4444' }} className="text-sm">{error}</p></motion.div>)}

      {/* Empty */}
      {!error && !resolvedContent && !isResolving && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sc-card p-6 text-center" style={{ color: 'var(--sc-text-light)' }}>
          Enter a SoundCloud link above to get started.
        </motion.div>
      )}

      {/* Result */}
      {resolvedContent && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="sc-card overflow-hidden">
          <div className="p-6">
            <div className="flex items-start space-x-4">
              <img src={(resolvedContent as any).artwork_url || (resolvedContent as any).avatar_url || 'https://via.placeholder.com/150?text=No+Image'} alt={(resolvedContent as any).title || (resolvedContent as any).username} className="w-20 h-20 rounded object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image'; }} />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${resolvedContent.type === 'track' ? 'bg-green-100 text-green-700' : resolvedContent.type === 'playlist' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{resolvedContent.type.toUpperCase()}</span>
                </div>
                <h3 className="text-xl font-semibold mb-1" style={{ color: 'var(--sc-text-dark)' }}>{resolvedContent.type === 'user' ? (resolvedContent as ResolvedUser).username : (resolvedContent as any).title}</h3>
                <p className="text-sm mb-3" style={{ color: 'var(--sc-text-light)' }}>{resolvedContent.type !== 'user' ? (resolvedContent as any).user?.username : ''}</p>
                <div className="flex items-center space-x-4 text-sm" style={{ color: 'var(--sc-text-light)' }}>
                  {resolvedContent.type === 'track' && (<span>Duration: {Math.floor(((resolvedContent as ResolvedTrack).duration_ms||0)/60000)}:{String(Math.floor((((resolvedContent as ResolvedTrack).duration_ms||0)%60000)/1000)).padStart(2,'0')}</span>)}
                  {resolvedContent.type === 'playlist' && (<span>{(resolvedContent as ResolvedPlaylist).track_count} tracks</span>)}
                  {resolvedContent.type === 'user' && (resolvedContent as ResolvedUser).followers_count != null && (<span>{(resolvedContent as ResolvedUser).followers_count!.toLocaleString()} followers</span>)}
                </div>
              </div>
            </div>
          </div>
          <div className="border-t p-4" style={{ borderColor: 'var(--sc-light-gray)', background: 'var(--sc-white)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--sc-text-light)' }}>
                <LinkIcon className="w-4 h-4" />
                <span className="truncate max-w-md">{(resolvedContent as any).permalink_url}</span>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleCopy((resolvedContent as any).permalink_url)} className="px-3 py-2 rounded sc-focus" style={{ background: 'var(--sc-light-gray)', color: 'var(--sc-text-dark)' }}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => window.open((resolvedContent as any).permalink_url, '_blank')} className="px-3 py-2 sc-primary-button">Open</motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default LinkResolver;