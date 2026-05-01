import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Configure axios base URL from environment variables
// If VITE_API_URL is just '/api' or a relative path, we handle it carefully to avoid double-prefixing
const viteApiUrl = import.meta.env.VITE_API_URL || '';
axios.defaults.baseURL = viteApiUrl.startsWith('http') ? viteApiUrl : '';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(sessionStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        // Set global header for all subsequent calls
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const res = await axios.get('/api/me');
          setUser(res.data);
          // Sync sessionStorage
          sessionStorage.setItem('user_role', res.data.role);
          sessionStorage.setItem('username', res.data.username);
        } catch (error) {
          console.error("Auth initialization failed", error);
          logout();
        }
      } else {
        delete axios.defaults.headers.common['Authorization'];
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    const res = await axios.post('/api/token', params);
    
    const { access_token, role, company_id } = res.data;
    sessionStorage.setItem('token', access_token);
    sessionStorage.setItem('user_role', role);
    sessionStorage.setItem('username', username);
    sessionStorage.setItem('company_id', company_id);
    
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setToken(access_token);
    return res.data;
  };

  const logout = () => {
    sessionStorage.clear();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await axios.get('/api/me');
      setUser(res.data);
      sessionStorage.setItem('user_role', res.data.role);
      sessionStorage.setItem('username', res.data.username);
    } catch (error) {
      console.error("Failed to refresh user data", error);
    }
  };

  const currentRole = user?.role || sessionStorage.getItem('user_role');

  return (
    <AuthContext.Provider value={{ token, user, login, logout, refreshUser, isAuthenticated: !!token, loading, role: currentRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
