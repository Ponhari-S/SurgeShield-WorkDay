import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const DEMO_ORGANIZER = {
  id: 'usr_org_01',
  name: 'Sarah Connor',
  email: 'sarah.connor@surgeshield.io',
  role: 'organizer',
  password: 'password123',
};

export const DEMO_PARTICIPANT = {
  id: 'usr_part_01',
  name: 'Alex Mercer',
  email: 'alex.mercer@surgeshield.io',
  role: 'participant',
  password: 'password123',
};

const REGISTERED_USERS_KEY = 'surgeshield_registered_users';
const CURRENT_USER_KEY = 'surgeshield_user';

function getStoredUsers() {
  if (typeof window === 'undefined') return [DEMO_ORGANIZER, DEMO_PARTICIPANT];
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (!raw) {
      const initial = [DEMO_ORGANIZER, DEMO_PARTICIPANT];
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(initial));
      return initial;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [DEMO_ORGANIZER, DEMO_PARTICIPANT];
  } catch (err) {
    console.warn('Failed to load registered users', err);
    return [DEMO_ORGANIZER, DEMO_PARTICIPANT];
  }
}

function saveRegisteredUsers(users) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.warn('Failed to save registered users', err);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CURRENT_USER_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        setUser(null);
      }
      getStoredUsers();
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
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }

  function login({ email, password = '', role }) {
    if (!email || !email.trim()) {
      throw new Error('Please enter a valid email address.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = getStoredUsers();

    const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!existing) {
      throw new Error('No account found with this email. Please sign up first.');
    }

    if (role && existing.role !== role) {
      const registeredRoleTitle = existing.role === 'organizer' ? 'Organizer' : 'Participant';
      throw new Error(
        `This account is registered as a ${registeredRoleTitle}. Please select the ${registeredRoleTitle} role tab to sign in.`
      );
    }

    if (existing.password && password && existing.password !== password) {
      throw new Error('Incorrect password. Please check your credentials.');
    }

    saveUser(existing);
    return existing;
  }

  function register({ name, email, password = '', role = 'participant' }) {
    if (!name || !name.trim()) {
      throw new Error('Please provide your name.');
    }
    if (!email || !email.trim()) {
      throw new Error('Please enter a valid email address.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = getStoredUsers();

    const alreadyExists = users.some((u) => u.email.toLowerCase() === normalizedEmail);
    if (alreadyExists) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const targetRole = role === 'organizer' ? 'organizer' : 'participant';
    const newUser = {
      id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      email: normalizedEmail,
      role: targetRole,
      password: password ? password.trim() : '',
    };

    const updatedUsers = [...users, newUser];
    saveRegisteredUsers(updatedUsers);
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
