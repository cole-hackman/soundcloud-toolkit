import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const CombinePlaylists = React.lazy(() => import('./pages/CombinePlaylists'));
const LikesToPlaylist = React.lazy(() => import('./pages/LikesToPlaylist'));
const SmartDeduplication = React.lazy(() => import('./pages/SmartDeduplication'));
const LinkResolver = React.lazy(() => import('./pages/LinkResolver'));
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
const PlaylistModifier = React.lazy(() => import('./pages/PlaylistModifier'));
const About = React.lazy(() => import('./pages/About'));
const Privacy = React.lazy(() => import('./pages/Privacy'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <Dashboard />
          </React.Suspense>
        </ProtectedRoute>
      } />
      <Route path="/combine" element={
        <ProtectedRoute>
          <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <CombinePlaylists />
          </React.Suspense>
        </ProtectedRoute>
      } />
      <Route path="/likes-to-playlist" element={
        <ProtectedRoute>
          <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <LikesToPlaylist />
          </React.Suspense>
        </ProtectedRoute>
      } />
      <Route path="/playlist-modifier" element={
        <ProtectedRoute>
          <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <PlaylistModifier />
          </React.Suspense>
        </ProtectedRoute>
      } />
      <Route path="/deduplication" element={
        <Navigate to="/dashboard" replace />
      } />
      <Route path="/link-resolver" element={
        <ProtectedRoute>
          <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <LinkResolver />
          </React.Suspense>
        </ProtectedRoute>
      } />
      <Route path="/about" element={<React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}><About /></React.Suspense>} />
      <Route path="/privacy" element={<React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}><Privacy /></React.Suspense>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen" style={{ background: 'var(--sc-light-gray)' }}>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;