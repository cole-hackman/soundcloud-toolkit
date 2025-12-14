import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

function About() {
  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-2xl p-8 md:p-12 shadow-lg"
        >
          <div className="mb-6">
            <Link to="/" className="text-[#FF5500] hover:text-[#E64A00] transition inline-flex items-center gap-2">
              <span>←</span> Back to Home
            </Link>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-[#333333]">About SC Toolkit</h1>

          <div className="space-y-6 text-[#666666] leading-relaxed">
            <p className="text-lg">
              SC Toolkit is a powerful web application designed to enhance your SoundCloud experience with advanced playlist management tools. Created by music lovers, for music lovers, we understand the frustration of managing large music libraries and the limitations of native SoundCloud features.
            </p>

            <div>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">Our Mission</h2>
              <p>
                Our mission is to empower SoundCloud users with professional-grade tools that make organizing, merging, and managing playlists effortless. We believe that managing your music library shouldn't be a chore—it should be intuitive, powerful, and enjoyable.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">What We Offer</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-[#333333]">Combine Playlists:</strong> Merge multiple playlists into one unified collection with automatic duplicate detection</li>
                <li><strong className="text-[#333333]">Likes to Playlist:</strong> Transform your liked tracks into organized, shareable playlists</li>
                <li><strong className="text-[#333333]">Playlist Modifier:</strong> Reorder, remove, and reorganize tracks with advanced sorting options (by title, artist, date, duration, or BPM)</li>
                <li><strong className="text-[#333333]">Link Resolver:</strong> Extract detailed metadata from any SoundCloud URL</li>
                <li><strong className="text-[#333333]">Smart Deduplication:</strong> Automatically detect and remove duplicate tracks across your playlists</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">Security & Privacy</h2>
              <p>
                Your security and privacy are our top priorities. SC Toolkit uses official SoundCloud OAuth authentication, which means we never see or store your password. All access tokens are encrypted at rest using AES-256-GCM encryption. We only request the minimum permissions needed to manage your playlists, and you can revoke access at any time through your SoundCloud settings.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">Free & Open</h2>
              <p>
                SC Toolkit is completely free to use. We're committed to providing powerful tools without charging our users. Our goal is to improve the SoundCloud experience for everyone, regardless of their subscription status.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">Technical Details</h2>
              <p>
                Built with modern web technologies including React, TypeScript, and Node.js, SC Toolkit is designed for performance, security, and reliability. We use Prisma ORM for database management and follow industry best practices for authentication and data encryption.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4 text-[#333333]">Limitations</h2>
              <p>
                SoundCloud has a limit of 500 tracks per playlist. When merging playlists or creating new ones, we automatically cap results at this limit and remove duplicates to ensure your playlists are valid. This is a SoundCloud platform limitation, not a limitation of our tools.
              </p>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <p className="text-sm text-[#999999]">
                <strong className="text-[#333333]">Note:</strong> SC Toolkit is not affiliated with, endorsed by, or connected to SoundCloud. This is an independent tool created to enhance the SoundCloud user experience.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default About;
