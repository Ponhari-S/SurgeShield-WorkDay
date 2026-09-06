import '../styles/globals.css';
import Link from 'next/link';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>SurgeShield</title>
        <meta
          name="description"
          content="Enterprise-grade flash-sale event ticketing with atomic concurrency locks and real-time seat reservation."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%20%22100%22%20%22100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>" />
      </Head>

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
            <Link href="/create-event" className="nav-cta">
              <span>+</span>
              <span>Create Event</span>
            </Link>
          </div>
        </div>
      </nav>

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
    </>
  );
}
