import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { redirect } = router.query;
  const { login, loginDemoOrganizer, loginDemoParticipant, register } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('participant'); // 'participant' | 'organizer'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSuccess() {
    const destination = redirect || (role === 'organizer' ? '/create-event' : '/');
    router.push(destination);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please provide a valid email address.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    try {
      if (mode === 'login') {
        login({ email, role });
      } else {
        register({ name, email, role });
      }
      handleSuccess();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    }
  }

  function handleQuickOrganizer() {
    loginDemoOrganizer();
    router.push(redirect || '/create-event');
  }

  function handleQuickParticipant() {
    loginDemoParticipant();
    router.push(redirect || '/');
  }

  return (
    <div className="container" style={{ maxWidth: 520, padding: '48px 20px 80px' }}>
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

      <div className="card" style={{ padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #ff2a5f, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              margin: '0 auto 16px',
              boxShadow: '0 0 20px var(--primary-glow)',
            }}
          >
            ⚡
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>
            {mode === 'login' ? 'Sign In to SurgeShield' : 'Create an Account'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {mode === 'login'
              ? 'Select your account type to access real-time event operations.'
              : 'Join as an organizer or attendee to unlock atomic reservations.'}
          </p>
        </div>

        {/* Quick Demo Access Bar */}
        <div
          style={{
            background: 'rgba(8, 14, 28, 0.7)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
            padding: 16,
            marginBottom: 26,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 10,
              textAlign: 'center',
            }}
          >
            ⚡ FAST-TRACK DEMO ACCOUNTS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleQuickOrganizer}
              style={{
                fontSize: 12,
                padding: '10px 8px',
                borderColor: 'rgba(139, 92, 246, 0.4)',
                color: '#c4b5fd',
              }}
            >
              🚀 Organizer Demo
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleQuickParticipant}
              style={{
                fontSize: 12,
                padding: '10px 8px',
                borderColor: 'rgba(0, 242, 254, 0.4)',
                color: '#38bdf8',
              }}
            >
              🎟️ Participant Demo
            </button>
          </div>
        </div>

        {/* Tabs: Login vs Register */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(8, 14, 28, 0.9)',
            borderRadius: 12,
            padding: 4,
            marginBottom: 24,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              flex: 1,
              padding: '10px 0',
              background: mode === 'login' ? 'rgba(255, 42, 95, 0.2)' : 'transparent',
              border: mode === 'login' ? '1px solid var(--primary-neon)' : '1px solid transparent',
              color: mode === 'login' ? '#ffffff' : 'var(--text-muted)',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            style={{
              flex: 1,
              padding: '10px 0',
              background: mode === 'register' ? 'rgba(255, 42, 95, 0.2)' : 'transparent',
              border: mode === 'register' ? '1px solid var(--primary-neon)' : '1px solid transparent',
              color: mode === 'register' ? '#ffffff' : 'var(--text-muted)',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Register
          </button>
        </div>

        {error && <div className="error-banner" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Role Selection Cards */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
              I am participating as:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div
                onClick={() => setRole('participant')}
                style={{
                  padding: '14px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: role === 'participant' ? '1.5px solid var(--cyan-neon)' : '1px solid var(--border-subtle)',
                  background: role === 'participant' ? 'rgba(0, 242, 254, 0.08)' : 'rgba(8, 14, 28, 0.5)',
                  boxShadow: role === 'participant' ? '0 0 14px rgba(0, 242, 254, 0.2)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>🎟️</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>Participant</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Book event seats
                </div>
              </div>

              <div
                onClick={() => setRole('organizer')}
                style={{
                  padding: '14px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: role === 'organizer' ? '1.5px solid var(--violet-neon)' : '1px solid var(--border-subtle)',
                  background: role === 'organizer' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(8, 14, 28, 0.5)',
                  boxShadow: role === 'organizer' ? '0 0 14px rgba(139, 92, 246, 0.2)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>🚀</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>Organizer</div>
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
                placeholder="e.g. Jordan Miller"
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

          <button className="btn" type="submit" style={{ marginTop: 8 }}>
            {mode === 'login'
              ? `Sign In as ${role === 'organizer' ? 'Organizer' : 'Participant'} →`
              : `Create ${role === 'organizer' ? 'Organizer' : 'Participant'} Account →`}
          </button>
        </form>
      </div>
    </div>
  );
}
