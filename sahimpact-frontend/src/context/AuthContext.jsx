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
  const [companies, setCompanies] = useState([]);
  const [activeCompanyId, setActiveCompanyId] = useState(sessionStorage.getItem('company_id'));

  // Configure axios interceptor for Company ID
  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      const companyId = sessionStorage.getItem('company_id');
      if (companyId && companyId !== 'null') {
        config.headers['X-Company-ID'] = companyId;
      }
      return config;
    });
    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const res = await axios.get('/api/me');
          setUser(res.data);
          
          // Also fetch companies to ensure UI is in sync
          const compRes = await axios.get('/api/me/companies');
          setCompanies(compRes.data || []);
          
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
    
    const { access_token, role, company_id, companies: userCompanies } = res.data;
    sessionStorage.setItem('token', access_token);
    sessionStorage.setItem('user_role', role);
    sessionStorage.setItem('username', username);
    
    // Auto-set company only if there is exactly one option, otherwise force selection
    const userCompaniesList = userCompanies || [];
    if (userCompaniesList.length === 1) {
        const defaultId = userCompaniesList[0].id;
        sessionStorage.setItem('company_id', defaultId);
        setActiveCompanyId(defaultId);
    } else {
        sessionStorage.removeItem('company_id');
        setActiveCompanyId(null);
    }
    
    setCompanies(userCompanies || []);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setToken(access_token);
    return res.data;
  };

  const switchCompany = (id) => {
    sessionStorage.setItem('company_id', id);
    setActiveCompanyId(id);
    // Reload branding and data by notifying listeners
    window.dispatchEvent(new Event('company-switched'));
  };

  const logout = () => {
    sessionStorage.clear();
    setToken(null);
    setUser(null);
    setCompanies([]);
    setActiveCompanyId(null);
  };

  const refreshUser = async () => {
    try {
      const res = await axios.get('/api/me');
      setUser(res.data);
    } catch (error) {
      console.error("Failed to refresh user data", error);
    }
  };

  const currentRole = user?.role || sessionStorage.getItem('user_role');

  return (
    <AuthContext.Provider value={{ 
        token, 
        user, 
        login, 
        logout, 
        refreshUser, 
        isAuthenticated: !!token, 
        loading, 
        role: currentRole,
        companies,
        activeCompanyId,
        switchCompany
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
