import React from 'react';
import { Link } from 'react-router-dom';

function About() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-orange-50 to-white">
      <div className="w-full max-w-[600px]">
        <div className="sc-card p-6 sm:p-8">
          <div className="mb-4">
            <Link to="/login" className="text-sm text-gray-500 hover:text-[#FF5500]">← Back to Login</Link>
          </div>
          <h1 className="text-2xl font-semibold mb-3" style={{ color: 'var(--sc-text-dark)' }}>About SC Toolkit</h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--sc-text-light)' }}>
            SC Toolkit is built to enhance your SoundCloud experience with smarter playlist tools. Combine, organize, and customize your tracks in ways the native app doesn’t allow. Created by music lovers, for music lovers.
          </p>
        </div>
      </div>
    </div>
  );
}

export default About;
