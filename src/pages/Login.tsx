import React from 'react';
import { motion } from 'framer-motion';
import { Music, Play, Users, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const { login } = useAuth();

  const features = [
    { icon: Play, text: 'Combine multiple playlists' },
    { icon: Users, text: 'Convert liked songs to playlists' },
    { icon: Zap, text: 'Smart duplicate removal' },
    { icon: Music, text: 'Universal link resolver' }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            >
              <Music className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-2">SoundCloud Tools</h1>
            <p className="text-slate-400">Supercharge your playlist management</p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                className="flex items-center space-x-3 text-slate-300"
              >
                <feature.icon className="w-5 h-5 text-blue-400" />
                <span className="text-sm">{feature.text}</span>
              </motion.div>
            ))}
          </div>

          {/* Login Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={login}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-orange-500/25 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <span>Continue with SoundCloud</span>
            <Play className="w-5 h-5" />
          </motion.button>

          <p className="text-xs text-slate-500 text-center mt-4">
            We'll redirect you to SoundCloud for secure authentication
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;