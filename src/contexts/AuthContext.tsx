import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  avatar_url: string;
  display_name: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for existing auth token on mount
    const token = localStorage.getItem('soundcloud_token');
    if (token) {
      // Mock user for demo - in real app, validate token with SoundCloud API
      setUser({
        id: '12345',
        username: 'musiclover',
        avatar_url: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?w=150&h=150&fit=crop',
        display_name: 'Music Lover'
      });
      setIsAuthenticated(true);
    }
  }, []);

  const login = () => {
    // In real app, this would redirect to SoundCloud OAuth
    localStorage.setItem('soundcloud_token', 'mock_token');
    setUser({
      id: '12345',
      username: 'musiclover',
      avatar_url: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?w=150&h=150&fit=crop',
      display_name: 'Music Lover'
    });
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('soundcloud_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}