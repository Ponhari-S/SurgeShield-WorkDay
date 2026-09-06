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
        loggedUser = login({ email, role });
      } else {
        loggedUser = register({ name, email, role });
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
              fontSize: 20,
              margin: '0 auto 12px',
              color: '#ffffff',
            }}
          >
            ⚡
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
            <span>✓</span>
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && <div className="error-banner" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

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
                  padding: '12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: role === 'participant' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                  background: role === 'participant' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-input)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 2 }}>🎟️</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>Participant</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Book event seats
                </div>
              </div>

              <div
                onClick={() => setRole('organizer')}
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: role === 'organizer' ? '1.5px solid var(--primary)' : '1px solid var(--border-subtle)',
                  background: role === 'organizer' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-input)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 2 }}>🚀</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>Organizer</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
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
