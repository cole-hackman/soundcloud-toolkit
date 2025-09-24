import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Combine, Heart, Link as LinkIcon, ArrowRight, Shuffle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  path: string;
}

interface UserStats {
  followers_count: number;
  followings_count: number;
  public_favorites_count: number;
  track_count: number;
  playlist_count: number;
}

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchUserStats(); }, []);

  const fetchUserStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
      if (response.ok) {
        const userData = await response.json();
        setStats({
          followers_count: userData.followers_count || 0,
          followings_count: userData.followings_count || 0,
          public_favorites_count: userData.public_favorites_count || 0,
          track_count: userData.track_count || 0,
          playlist_count: userData.playlist_count || 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const features: FeatureCard[] = [
    { id: 'combine', title: 'Combine Playlists', description: 'Merge multiple playlists and remove duplicates automatically', icon: Combine, color: '', path: '/combine' },
    { id: 'likes', title: 'Likes → Playlist', description: 'Convert your liked tracks into an organized playlist', icon: Heart, color: '', path: '/likes-to-playlist' },
    { id: 'modifier', title: 'Playlist Modifier', description: 'Reorder and remove tracks in your playlists', icon: Shuffle, color: '', path: '/playlist-modifier' },
    { id: 'resolver', title: 'Link Resolver', description: 'Get detailed info from any SoundCloud link', icon: LinkIcon, color: '', path: '/link-resolver' }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Welcome Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <div className="flex items-center justify-center mb-4">
          <div className="text-center">
            <h1 className="text-3xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Welcome back, {user?.display_name}!</h1>
            <p style={{ color: 'var(--sc-text-light)' }}>Choose a tool to enhance your SoundCloud experience</p>
          </div>
        </div>
      </motion.div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => (
          <motion.div key={feature.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.1 }} whileHover={{ scale: 1.02 }} className="group sc-hover-card sc-card">
            <Link to={feature.path} className="block p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded flex items-center justify-center" style={{ background: 'var(--sc-orange)' }}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <ArrowRight className="w-5 h-5" style={{ color: 'var(--sc-orange)' }} />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--sc-text-dark)' }}>{feature.title}</h3>
              <p className="text-sm" style={{ color: 'var(--sc-text-light)' }}>{feature.description}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Stats Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="sc-stat">
              <div className="w-8 h-8 rounded mx-auto mb-2 sc-skeleton" />
              <div className="w-16 h-4 rounded mx-auto sc-skeleton" />
            </div>
          ))
        ) : (
          [
            { label: 'Playlists', value: stats?.playlist_count?.toString() || '0' },
            { label: 'Liked Tracks', value: stats?.public_favorites_count?.toString() || '0' },
            { label: 'Following', value: stats?.followings_count?.toString() || '0' },
            { label: 'Followers', value: stats?.followers_count?.toString() || '0' }
          ].map((stat, index) => (
            <div key={index} className="sc-stat">
              <div className="text-2xl font-semibold" style={{ color: 'var(--sc-text-dark)' }}>{stat.value}</div>
              <div className="text-sm" style={{ color: 'var(--sc-text-light)' }}>{stat.label}</div>
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}

export default Dashboard;