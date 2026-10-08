import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const ROLE_PROFILES = {
  family: {
    role: 'family',
    title: 'Family & Citizen',
    label: 'Family / Citizen',
    full_name: 'Ananya Sharma (Family Reporter)',
    email: 'family@reunite-x.org',
    badge: 'Family Member',
    description: 'Report missing relatives, search safe directory, track cases, receive verified alerts',
    theme: 'rose',
  },
  rescue_team: {
    role: 'rescue_team',
    title: 'NDRF Rescue Unit 7',
    label: 'Rescue Team',
    full_name: 'Inspector Rajesh Kumar (NDRF Unit 7)',
    email: 'rescue_team@reunite-x.org',
    badge: 'Rescue Specialist',
    description: 'Register rescued victims in disaster zone, triage injuries, update transit status',
    theme: 'amber',
  },
  hospital: {
    role: 'hospital',
    title: 'Apex Trauma & Relief Hospital',
    label: 'Hospital',
    full_name: 'Dr. Priya Sundaram (Chief Medical Officer)',
    email: 'hospital@reunite-x.org',
    badge: 'Medical Ward',
    description: 'Admit disaster patients, manage triage, update clinical recovery and bed status',
    theme: 'blue',
  },
  shelter: {
    role: 'shelter',
    title: 'Camp Delta 3 Relief Shelter',
    label: 'Shelter / Camp',
    full_name: 'Sunil Verma (Camp Delta Superintendent)',
    email: 'shelter@reunite-x.org',
    badge: 'Relief Camp',
    description: 'Intake displaced individuals, assign tents/blocks, update shelter locations',
    theme: 'emerald',
  },
  authority: {
    role: 'authority',
    title: 'Disaster Verification Authority (NDRF HQ)',
    label: 'Disaster Authority',
    full_name: 'Capt. Vikram Singh (Disaster Operations Commander)',
    email: 'authority@reunite-x.org',
    badge: 'Authority Official',
    description: 'Human-in-the-loop AI match verification, status progression, case closure',
    theme: 'red',
  },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('reunite_user');
    return saved ? JSON.parse(saved) : {
      id: 'mock-user-family-id',
      email: ROLE_PROFILES.family.email,
      role: 'family',
      full_name: ROLE_PROFILES.family.full_name,
      badge: ROLE_PROFILES.family.badge,
      title: ROLE_PROFILES.family.title,
    };
  });
  const [token, setToken] = useState(() => localStorage.getItem('reunite_token') || 'mock-family');
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
    const profile = ROLE_PROFILES[roleName] || {
      role: roleName,
      title: `${roleName.toUpperCase()} Responder`,
      full_name: customName || `${roleName.toUpperCase()} Officer`,
      email: `${roleName}@reunite-x.org`,
      badge: roleName.toUpperCase(),
    };

    const mockToken = `mock-${roleName}`;
    const newUser = {
      id: `mock-user-${roleName}-id`,
      email: profile.email,
      role: profile.role,
      full_name: customName || profile.full_name,
      title: profile.title,
      badge: profile.badge,
    };
    setToken(mockToken);
    setUser(newUser);
  };

  const logout = () => {
    loginWithRole('family');
  };

  const isAuthority = user?.role === 'authority' || user?.role === 'admin';
  const isRescueTeam = user?.role === 'rescue_team';
  const isHospital = user?.role === 'hospital' || user?.role === 'hospital_shelter';
  const isShelter = user?.role === 'shelter' || user?.role === 'hospital_shelter';
  const isFamily = user?.role === 'family' || user?.role === 'public';
  const isResponder = isAuthority || isRescueTeam || isHospital || isShelter || user?.role === 'volunteer';

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      loginWithRole,
      logout,
      isAuthority,
      isRescueTeam,
      isHospital,
      isShelter,
      isFamily,
      isResponder,
      ROLE_PROFILES,
    }}>
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
