import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const DEMO_ORGANIZER = {
  id: 'usr_org_01',
  name: 'Sarah Connor',
  email: 'sarah.connor@surgeshield.io',
  role: 'organizer',
};

export const DEMO_PARTICIPANT = {
  id: 'usr_part_01',
  name: 'Alex Mercer',
  email: 'alex.mercer@surgeshield.io',
  role: 'participant',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore user session from localStorage on initial load
  useEffect(() => {
    try {
      const stored = localStorage.getItem('surgeshield_user');
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        setUser(null);
      }
    } catch (e) {
      console.warn('Failed to parse stored auth user', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function saveUser(userData) {
    setUser(userData);
    if (userData) {
      localStorage.setItem('surgeshield_user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('surgeshield_user');
    }
  }

  function login({ email, role = 'participant' }) {
    const defaultName = email.split('@')[0].replace(/[._]/g, ' ');
    const formattedName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
    
    // Strict Role: Role is fixed upon login/account selection
    const targetRole = role === 'organizer' ? 'organizer' : 'participant';
    const newUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: formattedName || (targetRole === 'organizer' ? 'Event Organizer' : 'Event Attendee'),
      email: email.trim().toLowerCase(),
      role: targetRole,
    };
    saveUser(newUser);
    return newUser;
  }

  function loginDemoOrganizer() {
    saveUser(DEMO_ORGANIZER);
    return DEMO_ORGANIZER;
  }

  function loginDemoParticipant() {
    saveUser(DEMO_PARTICIPANT);
    return DEMO_PARTICIPANT;
  }

  function register({ name, email, role = 'participant' }) {
    const targetRole = role === 'organizer' ? 'organizer' : 'participant';
    const newUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: targetRole,
    };
    saveUser(newUser);
    return newUser;
  }

  function logout() {
    saveUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isOrganizer: user?.role === 'organizer',
        isParticipant: user?.role === 'participant',
        login,
        loginDemoOrganizer,
        loginDemoParticipant,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
