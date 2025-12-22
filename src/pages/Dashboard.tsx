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
    <div className="min-h-screen" style={{ background: 'var(--sc-light-gray)' }}>
      <div className="container mx-auto px-6 py-12 md:py-16 max-w-7xl">
        {/* Welcome Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-4" style={{ color: 'var(--sc-text-dark)' }}>
            Welcome back, <span className="bg-gradient-to-r from-[#FF5500] to-[#E64A00] bg-clip-text text-transparent">{user?.display_name}</span>!
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--sc-text-light)' }}>
            Choose a tool to enhance your SoundCloud experience
          </p>
        </motion.div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="group rounded-2xl p-10 hover:border-[#FF5500] hover:shadow-2xl transition-all duration-300 border-2"
              style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}
            >
              <Link to={feature.path} className="block">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center text-white shadow-lg">
                    <feature.icon className="w-10 h-10" />
                  </div>
                  <ArrowRight className="w-6 h-6 text-[#FF5500] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-2xl font-bold mb-4 group-hover:text-[#FF5500] transition" style={{ color: 'var(--sc-text-dark)' }}>
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-lg" style={{ color: 'var(--sc-text-light)' }}>
                  {feature.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="rounded-xl p-6 text-center border-2"
                style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}
              >
                <div className="w-12 h-12 rounded-lg mx-auto mb-3 sc-skeleton" />
                <div className="w-20 h-5 rounded mx-auto sc-skeleton" />
              </motion.div>
            ))
          ) : (
            [
              { label: 'Playlists', value: stats?.playlist_count?.toString() || '0', icon: '📋' },
              { label: 'Liked Tracks', value: stats?.public_favorites_count?.toString() || '0', icon: '❤️' },
              { label: 'Following', value: stats?.followings_count?.toString() || '0', icon: '👥' },
              { label: 'Followers', value: stats?.followers_count?.toString() || '0', icon: '⭐' }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                whileHover={{ y: -2, scale: 1.02 }}
                className="rounded-xl p-6 text-center border-2 hover:border-[#FF5500] hover:shadow-lg transition-all duration-300"
                style={{ background: 'var(--sc-white)', borderColor: 'var(--sc-light-gray)' }}
              >
                <div className="text-3xl mb-2">{stat.icon}</div>
                <div className="text-3xl md:text-4xl font-bold mb-2" style={{ color: 'var(--sc-text-dark)' }}>{stat.value}</div>
                <div className="text-sm font-medium" style={{ color: 'var(--sc-text-light)' }}>{stat.label}</div>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default Dashboard;