import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CombinePlaylists from './pages/CombinePlaylists';
import LikesToPlaylist from './pages/LikesToPlaylist';
import SmartDeduplication from './pages/SmartDeduplication';
import LinkResolver from './pages/LinkResolver';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/combine" element={
        <ProtectedRoute><CombinePlaylists /></ProtectedRoute>
      } />
      <Route path="/likes-to-playlist" element={
        <ProtectedRoute><LikesToPlaylist /></ProtectedRoute>
      } />
      <Route path="/deduplication" element={
        <ProtectedRoute><SmartDeduplication /></ProtectedRoute>
      } />
      <Route path="/link-resolver" element={
        <ProtectedRoute><LinkResolver /></ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;