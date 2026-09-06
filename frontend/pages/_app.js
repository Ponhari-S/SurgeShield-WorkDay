import '../styles/globals.css';
import Link from 'next/link';
import Head from 'next/head';
import { AuthProvider, useAuth } from '../lib/auth';

function AppNavbar() {
  const { user, isOrganizer, logout, switchRole } = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link href="/" className="logo">
          <div className="logo-shield-icon">⚡</div>
          <div className="logo-brand">
            <span className="logo-title">SurgeShield</span>
            <span className="logo-tagline">Real-Time Event Engine</span>
          </div>
        </Link>

        <div className="nav-actions">
          <Link href="/" className="nav-link">
            Explore Events
          </Link>

          {user ? (
            <>
              {isOrganizer ? (
                <Link href="/create-event" className="nav-cta">
                  <span>+</span>
                  <span>Create Event</span>
                </Link>
              ) : (
                <Link
                  href="/create-event"
                  className="nav-link"
                  style={{ fontSize: 13 }}
                  title="Host events (requires Organizer role)"
                >
                  Host Events
                </Link>
              )}

              {/* User Profile & Role Indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  paddingLeft: 12,
                  borderLeft: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                    {user.name}
                  </span>
                  <span
                    onClick={() => switchRole()}
                    title="Click to toggle role between Organizer and Participant"
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      padding: '1px 7px',
                      borderRadius: 4,
                      background: isOrganizer ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0, 242, 254, 0.15)',
                      color: isOrganizer ? '#c4b5fd' : '#38bdf8',
                      border: `1px solid ${isOrganizer ? 'rgba(139, 92, 246, 0.4)' : 'rgba(0, 242, 254, 0.3)'}`,
                      marginTop: 2,
                    }}
                  >
                    {isOrganizer ? '⚡ ORGANIZER' : '🎟️ PARTICIPANT'} ⇄
                  </span>
                </div>

                <button
                  onClick={logout}
                  className="nav-link"
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-dim)',
                  }}
                  title="Sign Out"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="nav-cta"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'none',
              }}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <title>SurgeShield</title>
        <meta
          name="description"
          content="Enterprise-grade flash-sale event ticketing with atomic concurrency locks and real-time seat reservation."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%20%22100%22%20%22100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>" />
      </Head>

      <AppNavbar />

      <main className="main-wrapper">
        <Component {...pageProps} />
      </main>

      <footer className="footer">
        <div className="footer-container">
          <div>
            <span style={{ fontWeight: 700, color: '#ffffff' }}>SurgeShield Infrastructure</span>
          </div>
        </div>
      </footer>
    </AuthProvider>
  );
}
