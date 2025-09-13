import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Combine, 
  Heart, 
  Copy, 
  Link as LinkIcon, 
  ArrowRight,
  Music2,
  Shuffle,
  Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = 'http://localhost:3001';

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

  useEffect(() => {
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/me`, {
        credentials: 'include'
      });
      
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
    {
      id: 'combine',
      title: 'Combine Playlists',
      description: 'Merge multiple playlists and remove duplicates automatically',
      icon: Combine,
      color: 'from-blue-500 to-blue-700',
      path: '/combine'
    },
    {
      id: 'likes',
      title: 'Likes → Playlist',
      description: 'Convert your liked tracks into an organized playlist',
      icon: Heart,
      color: 'from-pink-500 to-rose-600',
      path: '/likes-to-playlist'
    },
    {
      id: 'deduplication',
      title: 'Smart Deduplication',
      description: 'Find and remove duplicate tracks from any playlist',
      icon: Filter,
      color: 'from-green-500 to-emerald-600',
      path: '/deduplication'
    },
    {
      id: 'resolver',
      title: 'Link Resolver',
      description: 'Get detailed info from any SoundCloud link',
      icon: LinkIcon,
      color: 'from-purple-500 to-violet-600',
      path: '/link-resolver'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center mb-4">
          <img
            src={user?.avatar_url}
            alt={user?.display_name}
            className="w-16 h-16 rounded-full border-4 border-blue-500 mr-4"
          />
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, {user?.display_name}!
            </h1>
            <p className="text-slate-400">
              Choose a tool to enhance your SoundCloud experience
            </p>
          </div>
        </div>
      </motion.div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            className="group"
          >
            <Link to={feature.path}>
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-blue-500/10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                </div>
                
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Stats Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-slate-800/30 rounded-lg p-4 text-center">
              <div className="w-8 h-8 bg-slate-700 rounded animate-pulse mx-auto mb-2" />
              <div className="w-16 h-4 bg-slate-700 rounded animate-pulse mx-auto" />
            </div>
          ))
        ) : (
          [
            { label: 'Playlists', value: stats?.playlist_count?.toString() || '0' },
            { label: 'Liked Tracks', value: stats?.public_favorites_count?.toString() || '0' },
            { label: 'Following', value: stats?.followings_count?.toString() || '0' },
            { label: 'Followers', value: stats?.followers_count?.toString() || '0' }
          ].map((stat, index) => (
            <div key={index} className="bg-slate-800/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))
        )}
      </motion.div>
    </div>
  );
}

export default Dashboard;