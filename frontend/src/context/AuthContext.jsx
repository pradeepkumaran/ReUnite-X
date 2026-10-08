import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('reunite_user');
    return saved ? JSON.parse(saved) : {
      id: 'mock-public-id',
      email: 'citizen@reunite-x.org',
      role: 'public',
      full_name: 'Citizen Reporter'
    };
  });
  const [token, setToken] = useState(() => localStorage.getItem('reunite_token') || 'mock-public');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('reunite_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('reunite_user');
    }
    if (token) {
      localStorage.setItem('reunite_token', token);
    } else {
      localStorage.removeItem('reunite_token');
    }
  }, [user, token]);

  const loginWithRole = (roleName, customName = null) => {
    const mockToken = `mock-${roleName}`;
    const newUser = {
      id: `mock-${roleName}-user-id`,
      email: `${roleName}@reunite-x.org`,
      role: roleName,
      full_name: customName || `${roleName.toUpperCase()} Responder`
    };
    setToken(mockToken);
    setUser(newUser);
  };

  const logout = () => {
    setUser({
      id: 'mock-public-id',
      email: 'citizen@reunite-x.org',
      role: 'public',
      full_name: 'Citizen Reporter'
    });
    setToken('mock-public');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
