import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, physical, virtual, fast, available
  const [sortBy, setSortBy] = useState('date'); // date, seats, name

  useEffect(() => {
    fetchEvents();
  }, []);

  function fetchEvents() {
    setLoading(true);
    setError('');
    api
      .listEvents()
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        const matchesSearch =
          ev.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ev.venue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ev.description?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        const available = parseInt(ev.seats_available ?? ev.total_seats, 10);
        const total = parseInt(ev.total_seats, 10);
        const ratio = total > 0 ? available / total : 0;

        if (filterType === 'physical') return !ev.is_virtual;
        if (filterType === 'virtual') return ev.is_virtual;
        if (filterType === 'fast') return ratio > 0 && ratio <= 0.3;
        if (filterType === 'available') return available > 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'seats') {
          return (parseInt(b.seats_available || 0, 10)) - (parseInt(a.seats_available || 0, 10));
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        // default: date (closest first)
        const dateA = a.event_date ? new Date(a.event_date).getTime() : Infinity;
        const dateB = b.event_date ? new Date(b.event_date).getTime() : Infinity;
        return dateA - dateB;
      });
  }, [events, searchQuery, filterType, sortBy]);

  return (
    <div className="container">
      {/* Hero Header */}
      <div className="hero-wrapper">
        <div className="hero-pill">
          <span className="pulse-dot" />
          <span>REAL-TIME SEAT ENGINE

          </span>
        </div>
        <h1 className="hero-title">
          <span className="gradient-text">Live Events</span>
        </h1>
        <p className="hero-subtitle">
          Book Events, Check Seat Availability.
        </p>
      </div>

      {/* Toolbar: Search, Filters & Sorting */}
      <div className="toolbar-card">
        <div className="toolbar-top">
          <div className="search-input-wrap">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search by event title, speaker, or venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date">Sort: Upcoming Date</option>
            <option value="seats">Sort: Most Seats Available</option>
            <option value="name">Sort: Event Name (A-Z)</option>
          </select>
        </div>

        {/* Filter Pills */}
        <div className="filter-pills">
          <button
            className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Events ({events.length})
          </button>
          <button
            className={`filter-btn ${filterType === 'physical' ? 'active' : ''}`}
            onClick={() => setFilterType('physical')}
          >
            📍 In-Person
          </button>
          <button
            className={`filter-btn ${filterType === 'virtual' ? 'active' : ''}`}
            onClick={() => setFilterType('virtual')}
          >
            🌐 Virtual Streams
          </button>
          <button
            className={`filter-btn ${filterType === 'fast' ? 'active' : ''}`}
            onClick={() => setFilterType('fast')}
          >
            🔥 Selling Fast
          </button>
          <button
            className={`filter-btn ${filterType === 'available' ? 'active' : ''}`}
            onClick={() => setFilterType('available')}
          >
            ✅ Seats Available
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          <span>{error}</span>
          <button
            onClick={fetchEvents}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="event-grid">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="card"
              style={{
                height: 320,
                animation: 'pulseLight 1.5s infinite ease-in-out',
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredEvents.length === 0 && !error && (
        <div className="empty-card">
          <div className="empty-icon">⚡</div>
          <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            No matching events found
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
            {searchQuery || filterType !== 'all'
              ? 'Try adjusting your search criteria or resetting filters.'
              : 'Be the first organizer to launch a high-concurrency event on SurgeShield.'}
          </p>
          {searchQuery || filterType !== 'all' ? (
            <button
              className="btn btn-secondary"
              style={{ width: 'auto', margin: '0 auto', display: 'inline-flex' }}
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
              }}
            >
              Reset Filters
            </button>
          ) : (
            <Link
              href="/create-event"
              className="btn"
              style={{ width: 'auto', margin: '0 auto', display: 'inline-flex' }}
            >
              + Create First Event
            </Link>
          )}
        </div>
      )}

      {/* Events Grid */}
      <div className="event-grid">
        {filteredEvents.map((event) => {
          const available = parseInt(event.seats_available ?? event.total_seats, 10);
          const total = parseInt(event.total_seats, 10);
          const booked = total - available;
          const ratio = total > 0 ? available / total : 0;
          const pctBooked = total > 0 ? Math.round((booked / total) * 100) : 0;

          // Status and color calculations
          let statusBadge = null;
          let progressColorClass = 'progress-green';

          if (available === 0) {
            statusBadge = <span className="badge badge-status-soldout">⛔ SOLD OUT</span>;
            progressColorClass = 'progress-red';
          } else if (ratio <= 0.25) {
            statusBadge = <span className="badge badge-status-fast">🔥 SELLING FAST</span>;
            progressColorClass = 'progress-red';
          } else if (ratio <= 0.6) {
            progressColorClass = 'progress-amber';
          }

          const formattedDate = event.event_date
            ? new Date(event.event_date).toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            : 'Date TBA';

          return (
            <div className="card" key={event.id}>
              <div>
                <div className="card-header">
                  <span
                    className={`badge ${event.is_virtual ? 'badge-virtual' : 'badge-physical'
                      }`}
                  >
                    {event.is_virtual ? '🌐 Virtual Stream' : '📍 In-Person Arena'}
                  </span>
                  {statusBadge}
                </div>

                <h3>{event.name}</h3>
                <p className="card-desc">
                  {event.description || 'Join this live event with real-time seat assignment.'}
                </p>

                <div className="meta-group">
                  <div className="meta-row">
                    <span className="meta-icon">📍</span>
                    <span>{event.is_virtual ? 'Global Online Broadcast' : event.venue || 'Venue TBA'}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-icon">📅</span>
                    <span>{formattedDate}</span>
                  </div>
                </div>
              </div>

              <div>
                {/* Live Capacity Meter */}
                <div className="capacity-container">
                  <div className="capacity-info">
                    <span className="capacity-label">Seat Availability</span>
                    <span className="capacity-num" style={{ color: available > 0 ? '#38bdf8' : '#ef4444' }}>
                      {available} / {total} free
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-bar ${progressColorClass}`}
                      style={{ width: `${Math.min(100, pctBooked)}%` }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                    <span>{pctBooked}% Reserved</span>
                    <span>{total} Total Capacity</span>
                  </div>
                </div>

                <Link
                  href={`/events/${event.id}`}
                  className="btn"
                  style={available === 0 ? { opacity: 0.6 } : {}}
                >
                  {available === 0 ? 'View Seat Map' : 'Select Seats & Book →'}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
