import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { redirect, loggedOut, initialMode } = router.query;
  const { user, login, loginDemoOrganizer, loginDemoParticipant, register } = useAuth();

  const [mode, setMode] = useState(initialMode === 'register' ? 'register' : 'login'); // 'login' | 'register'
  const [role, setRole] = useState('participant'); // 'participant' | 'organizer'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState(loggedOut ? 'You have been successfully logged out.' : '');

  useEffect(() => {
    if (initialMode === 'register') {
      setMode('register');
    }
  }, [initialMode]);

  function handleSuccess(userRole) {
    const destination = redirect || (userRole === 'organizer' ? '/create-event' : '/');
    router.push(destination);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!email) {
      setError('Please provide a valid email address.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    try {
      let loggedUser;
      if (mode === 'login') {
        loggedUser = login({ email, password, role });
      } else {
        loggedUser = register({ name, email, password, role });
      }
      handleSuccess(loggedUser.role);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    }
  }

  function handleQuickOrganizer() {
    const org = loginDemoOrganizer();
    handleSuccess(org.role);
  }

  function handleQuickParticipant() {
    const part = loginDemoParticipant();
    handleSuccess(part.role);
  }

  return (
    <div className="container" style={{ maxWidth: 500, padding: '40px 20px 80px' }}>
      {/* Back Link */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/"
          style={{
            color: 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>←</span> <span>Back to Live Events</span>
        </Link>
      </div>

      <div className="card" style={{ padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              color: '#ffffff',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, color: '#ffffff' }}>
            {mode === 'login' ? 'Sign In to SurgeShield' : 'Create an Account'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {mode === 'login'
              ? 'Sign in with your designated account role to continue.'
              : 'Register as an organizer or attendee to manage and book events.'}
          </p>
        </div>

        {/* Logged Out / Success Notice */}
        {infoMsg && (
          <div className="success-banner" style={{ marginBottom: 20 }}>
            <span style={{ fontWeight: 700, color: '#3b82f6' }}>•</span>
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="error-banner" style={{ marginBottom: 20 }}>
            <span>{error}</span>
            {error.includes('sign up first') && (
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  marginLeft: 8,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Go to Sign Up
              </button>
            )}
          </div>
        )}

        {/* Quick Demo Access Bar */}
        <div
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            DEMO ACCOUNTS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleQuickOrganizer}
              style={{
                fontSize: 12,
                padding: '9px 8px',
                borderColor: 'var(--border-subtle)',
                color: '#93c5fd',
              }}
            >
              Organizer Demo
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleQuickParticipant}
              style={{
                fontSize: 12,
                padding: '9px 8px',
                borderColor: 'var(--border-subtle)',
                color: '#93c5fd',
              }}
            >
              Participant Demo
            </button>
          </div>
        </div>

        {/* Tabs: Sign In vs Register */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-input)',
            borderRadius: 8,
            padding: 3,
            marginBottom: 20,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            style={{
              flex: 1,
              padding: '8px 0',
              background: mode === 'login' ? 'var(--primary)' : 'transparent',
              border: 'none',
              color: mode === 'login' ? '#ffffff' : 'var(--text-muted)',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            style={{
              flex: 1,
              padding: '8px 0',
              background: mode === 'register' ? 'var(--primary)' : 'transparent',
              border: 'none',
              color: mode === 'register' ? '#ffffff' : 'var(--text-muted)',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Permanent Role Selector */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
              <label style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                Account Role (Fixed)
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Non-transferable</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div
                onClick={() => setRole('participant')}
                style={{
                  padding: '14px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: role === 'participant' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                  background: role === 'participant' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-input)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: role === 'participant' ? '#60a5fa' : '#64748b' }}>
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>Participant</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Book event seats
                </div>
              </div>

              <div
                onClick={() => setRole('organizer')}
                style={{
                  padding: '14px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: role === 'organizer' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                  background: role === 'organizer' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-input)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: role === 'organizer' ? '#60a5fa' : '#64748b' }}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>Organizer</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Create &amp; host events
                </div>
              </div>
            </div>
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label>Full Name *</label>
              <input
                required
                placeholder="e.g. Elena Rostova"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label>Email Address *</label>
            <input
              type="email"
              required
              placeholder="e.g. user@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="btn" type="submit" style={{ marginTop: 6 }}>
            {mode === 'login'
              ? `Sign In as ${role === 'organizer' ? 'Organizer' : 'Participant'} →`
              : `Register as ${role === 'organizer' ? 'Organizer' : 'Participant'} →`}
          </button>
        </form>
      </div>
    </div>
  );
}
