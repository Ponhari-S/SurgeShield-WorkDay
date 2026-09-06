import '../styles/globals.css';
import Link from 'next/link';

export default function App({ Component, pageProps }) {
  return (
    <>
      <nav className="navbar">
        <div className="nav-container">
          <Link href="/" className="logo">
            <span>⚡ SurgeShield</span>
          </Link>
          <Link href="/create-event" className="nav-link-btn">
            + Create Event
          </Link>
        </div>
      </nav>
      <Component {...pageProps} />
    </>
  );
}
