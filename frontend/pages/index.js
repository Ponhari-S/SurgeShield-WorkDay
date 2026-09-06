import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listEvents()
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <div className="hero-header">
        <h1 className="hero-title">Live & Upcoming Events</h1>
        <p className="hero-subtitle">
          Book seats in real-time with atomic concurrency protection and instant seat map updates.
        </p>
      </div>

      {error && <div className="error-banner">⚠️ {error}</div>}
      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading events...</p>}

      {!loading && events.length === 0 && !error && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h3>No events found</h3>
          <p style={{ margin: '12px 0 24px', color: 'var(--text-muted)' }}>
            Get started by creating your first event with a custom seat grid.
          </p>
          <div>
            <Link href="/create-event" className="nav-link-btn">
              + Create First Event
            </Link>
          </div>
        </div>
      )}

      <div className="event-grid">
        {events.map((event) => (
          <div className="card" key={event.id}>
            <div>
              <span className={`badge ${event.is_virtual ? 'badge-virtual' : 'badge-physical'}`}>
                {event.is_virtual ? '🌐 Virtual Event' : '📍 Physical Event'}
              </span>
              <h3>{event.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '14px' }}>
                {event.description || 'No description provided.'}
              </p>
              
              <div className="meta-row">
                <span>📍</span>
                <span>{event.is_virtual ? 'Online Stream' : event.venue || 'Venue TBA'}</span>
              </div>
              
              <div className="meta-row">
                <span>📅</span>
                <span>
                  {event.event_date
                    ? new Date(event.event_date).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'Date TBA'}
                </span>
              </div>
            </div>

            <div>
              <div className="availability-pill">
                <span>Available Seats</span>
                <span style={{ color: '#ff3b5c' }}>
                  {event.seats_available} / {event.total_seats}
                </span>
              </div>

              <Link href={`/events/${event.id}`} className="btn">
                Book Seats
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
