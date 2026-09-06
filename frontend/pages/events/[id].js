import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function EventDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate a fresh idempotency key when the component loads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const randomKey = 'idemp_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      setIdempotencyKey(randomKey);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id]);

  function loadEvent() {
    setLoading(true);
    api
      .getEvent(id)
      .then(setEvent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function toggleSeat(seat) {
    if (seat.status === 'booked') return;
    setSelectedSeats((prev) =>
      prev.includes(seat.id) ? prev.filter((s) => s !== seat.id) : [...prev, seat.id]
    );
  }

  function removeSeat(seatId) {
    setSelectedSeats((prev) => prev.filter((s) => s !== seatId));
  }

  // Determine seat tier and price for visual richness
  function getSeatTier(label) {
    const row = label ? label.charAt(0).toUpperCase() : 'A';
    if (row === 'A' || row === 'B') return { name: 'VIP Front Row', class: 'tier-vip', price: 95 };
    if (row === 'C' || row === 'D') return { name: 'Prime Tier', class: 'tier-prem', price: 65 };
    return { name: 'General Admission', class: 'tier-gen', price: 35 };
  }

  const selectedSeatObjects = useMemo(() => {
    if (!event || !event.seats) return [];
    return event.seats.filter((s) => selectedSeats.includes(s.id));
  }, [event, selectedSeats]);

  const totalPrice = useMemo(() => {
    return selectedSeatObjects.reduce((acc, seat) => {
      return acc + getSeatTier(seat.seat_label).price;
    }, 0);
  }, [selectedSeatObjects]);

  async function handleBooking(e) {
    e.preventDefault();
    if (!user) {
      router.push(`/login?redirect=/events/${id}`);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const result = await api.createBooking(
        {
          eventId: parseInt(id, 10),
          userName: user.name,
          userEmail: user.email,
          seatIds: selectedSeats,
        },
        idempotencyKey
      );
      setBooking(result);
      setSelectedSeats([]);
      loadEvent(); // refresh seat map
    } catch (err) {
      setError(err.message);
      loadEvent(); // refresh if seats were grabbed concurrently
    } finally {
      setSubmitting(false);
    }
  }

  function copyReference(refText) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(refText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <div className="pulse-dot" style={{ margin: '0 auto 16px', width: 14, height: 14 }} />
        <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          SYNCHRONIZING SEAT GRID WITH POSTGRESQL MUTEX...
        </p>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="container">
        <div className="error-banner">⚠️ {error}</div>
        <Link href="/" className="btn btn-secondary" style={{ width: 'auto', display: 'inline-flex' }}>
          ← Back to Events Feed
        </Link>
      </div>
    );
  }

  if (!event) return null;

  const totalSeats = event.seats ? event.seats.length : event.total_seats;
  const bookedSeatsCount = event.seats ? event.seats.filter((s) => s.status === 'booked').length : 0;
  const availableSeatsCount = totalSeats - bookedSeatsCount;

  return (
    <div className="container" style={{ maxWidth: 960 }}>
      {/* Breadcrumb Back Link */}
      <div style={{ marginBottom: 20 }}>
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
          <span>←</span> <span>Back to Events Feed</span>
        </Link>
      </div>

      {/* Event Header Banner */}
      <div className="card" style={{ marginBottom: 32, padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <span className={`badge ${event.is_virtual ? 'badge-virtual' : 'badge-physical'}`}>
            {event.is_virtual ? '🌐 Online Virtual Stream' : '📍 In-Person Arena'}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="ticker-pill">
              <span className="pulse-dot" />
              <span>LIVE RESERVATION GATEWAY</span>
            </span>
          </div>
        </div>

        <h1 className="hero-title" style={{ marginTop: 14, marginBottom: 12 }}>
          {event.name}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 20 }}>
          {event.description || 'Select your designated seats from the interactive arena below to secure real-time admission.'}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div className="meta-row">
            <span className="meta-icon">📍</span>
            <span>{event.is_virtual ? 'Global Spatial Audio Stream' : event.venue || 'Venue TBA'}</span>
          </div>
          <div className="meta-row">
            <span className="meta-icon">📅</span>
            <span>
              {event.event_date
                ? new Date(event.event_date).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Date TBA'}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-icon">👥</span>
            <span>
              <strong style={{ color: '#38bdf8' }}>{availableSeatsCount}</strong> of {totalSeats} seats open
            </span>
          </div>
        </div>
      </div>

      {/* Error / Conflict Alert */}
      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Interactive Seat Arena */}
      <div className="seat-arena-card">
        {/* Stage Perspective Display */}
        <div className="stage-wrapper">
          <div className="stage-screen">STAGE / SCREEN FRONT</div>
        </div>

        {/* Legend */}
        <div className="seat-legend">
          <div className="legend-chip">
            <span className="legend-dot" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)' }} />
            <span>Available</span>
          </div>
          <div className="legend-chip">
            <span className="legend-dot" style={{ background: '#2563eb' }} />
            <span>Selected</span>
          </div>
          <div className="legend-chip">
            <span className="legend-dot" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', opacity: 0.5 }} />
            <span>Booked</span>
          </div>
        </div>

        {/* Dynamic Seat Grid */}
        <div className="seat-map-grid">
          {event.seats &&
            event.seats.map((seat) => {
              const tier = getSeatTier(seat.seat_label);
              const isSelected = selectedSeats.includes(seat.id);
              const isBooked = seat.status === 'booked';

              return (
                <button
                  key={seat.id}
                  className={`seat-btn ${tier.class} ${isSelected ? 'selected' : ''} ${isBooked ? 'booked' : ''}`}
                  onClick={() => toggleSeat(seat)}
                  disabled={isBooked}
                  title={`${seat.seat_label} (${tier.name}) - ${isBooked ? 'Booked' : '$' + tier.price}`}
                >
                  {seat.seat_label}
                </button>
              );
            })}
        </div>

        {/* Selection Summary Cart Bar */}
        <div className="selection-bar">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Selected Capacity ({selectedSeats.length} seats)
            </div>
            {selectedSeats.length > 0 ? (
              <div className="selection-tags">
                {selectedSeatObjects.map((s) => (
                  <span className="seat-pill" key={s.id}>
                    {s.seat_label}
                    <span
                      className="seat-pill-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSeat(s.id);
                      }}
                    >
                      ✕
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Click any available seat on the grid above to select.
              </span>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              ESTIMATED TOTAL
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
              ${totalPrice}
            </div>
          </div>
        </div>
      </div>

      {/* Concurrency Safe Checkout Form */}
      {!user ? (
        <div className="form-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Authentication Required to Book Seats</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14, maxWidth: 500, margin: '0 auto 24px' }}>
            Please sign in as a Participant or Organizer. Since your account is verified, you won't need to manually enter your name or email during checkout.
          </p>
          <Link
            href={`/login?redirect=/events/${id}`}
            className="btn"
            style={{ width: 'auto', display: 'inline-flex', padding: '12px 28px' }}
          >
            Sign In to Continue Booking →
          </Link>
        </div>
      ) : (
        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800 }}>Confirm Admission Reservation</h3>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#60a5fa',
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(37, 99, 235, 0.3)',
              }}
            >
              🔒 Idempotent Key: {idempotencyKey.slice(0, 14)}...
            </span>
          </div>

          {/* Verified Attendee Badge (Eliminates manual name and email typing!) */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                CONFIRMED ATTENDEE (PRE-AUTHENTICATED)
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', marginTop: 3 }}>
                {user.name} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>({user.email})</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: user.role === 'organizer' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                  color: user.role === 'organizer' ? '#93c5fd' : '#cbd5e1',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {user.role === 'organizer' ? 'ORGANIZER' : 'PARTICIPANT'}
              </span>
              <span className="ticker-pill" style={{ padding: '3px 8px' }}>
                <span className="pulse-dot" />
                <span>VERIFIED</span>
              </span>
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
            {selectedSeats.length > 0
              ? `Securing ${selectedSeats.length} seat(s) directly under ${user.name} with atomic row-level mutex locks.`
              : 'Select at least one seat from the map above to unlock booking.'}
          </p>

          <form onSubmit={handleBooking}>
            <button
              className="btn"
              type="submit"
              disabled={submitting || selectedSeats.length === 0}
              style={{ marginTop: 4 }}
            >
              {submitting ? (
                <>
                  <span className="pulse-dot" />
                  <span>Executing Atomic Reservation...</span>
                </>
              ) : selectedSeats.length === 0 ? (
                'Select Seats on Map Above to Proceed'
              ) : (
                `Lock & Reserve ${selectedSeats.length} Seat(s) for ${user.name} ($${totalPrice}) →`
              )}
            </button>
          </form>
        </div>
      )}

      {/* Digital Ticket Pass Modal */}
      {booking && (
        <div className="modal-overlay" onClick={() => setBooking(null)}>
          <div className="ticket-pass" onClick={(e) => e.stopPropagation()}>
            <div className="ticket-header">
              <div className="ticket-brand">SURGESHIELD ADMISSION PASS</div>
              <div className="ticket-event-name">{event.name}</div>
            </div>

            <div className="ticket-body">
              <div className="ticket-row">
                <div className="ticket-col">
                  <label>Attendee</label>
                  <span>{booking.user_name || user?.name || 'Verified Attendee'}</span>
                </div>
                <div className="ticket-col" style={{ textAlign: 'right' }}>
                  <label>Status</label>
                  <span style={{ color: '#3b82f6' }}>● CONFIRMED</span>
                </div>
              </div>

              <div className="ticket-row">
                <div className="ticket-col">
                  <label>Venue / Access</label>
                  <span>{event.is_virtual ? 'Virtual Stream Link' : event.venue || 'Main Arena'}</span>
                </div>
                <div className="ticket-col" style={{ textAlign: 'right' }}>
                  <label>Seats Reserved</label>
                  <span style={{ color: '#2563eb' }}>
                    {booking.seatIds ? booking.seatIds.length : booking.seats ? booking.seats.length : selectedSeats.length} Seat(s)
                  </span>
                </div>
              </div>

              <div className="ticket-divider" />

              {/* Barcode & Reference visualization */}
              <div className="ticket-barcode-wrap">
                <div className="ticket-barcode">
                  {[...Array(38)].map((_, i) => (
                    <div
                      key={i}
                      className="ticket-bar"
                      style={{
                        width: (i % 3 === 0 ? 4 : i % 2 === 0 ? 2 : 1),
                        height: `${32 + (i % 5) * 4}px`,
                      }}
                    />
                  ))}
                </div>
                <div className="ticket-ref">REF: #BK-{booking.id}-{Date.now().toString(36).toUpperCase()}</div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => copyReference(`#BK-${booking.id}`)}
                >
                  {copied ? '✓ Reference Copied' : '📋 Copy Reference'}
                </button>
                <button
                  className="btn"
                  onClick={() => setBooking(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
