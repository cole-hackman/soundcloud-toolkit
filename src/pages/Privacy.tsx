import React from 'react';
import { Link } from 'react-router-dom';

function Privacy() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-orange-50 to-white">
      <div className="w-full max-w-[600px]">
        <div className="sc-card p-6 sm:p-8">
          <div className="mb-4">
            <Link to="/login" className="text-sm text-gray-500 hover:text-[#FF5500]">← Back to Login</Link>
          </div>
          <h1 className="text-2xl font-semibold mb-4" style={{ color: 'var(--sc-text-dark)' }}>Privacy Policy</h1>
          <div className="space-y-4 text-base">
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Authentication</h2>
              <p style={{ color: 'var(--sc-text-light)' }}>We use SoundCloud OAuth for secure login. Your credentials are never stored on our servers.</p>
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Data</h2>
              <p style={{ color: 'var(--sc-text-light)' }}>We only access your SoundCloud playlists and likes when you choose to use SC Toolkit features. No personal data is collected or shared.</p>
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--sc-text-dark)' }}>Control</h2>
              <p style={{ color: 'var(--sc-text-light)' }}>You can log out anytime, and SC Toolkit will no longer have access to your SoundCloud account.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Privacy;
