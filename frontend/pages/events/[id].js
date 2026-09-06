import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../../lib/api';

export default function EventDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [event, setEvent] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleBooking(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await api.createBooking({
        eventId: id,
        userName,
        userEmail,
        seatIds: selectedSeats,
      });
      setBooking(result);
      setSelectedSeats([]);
      loadEvent(); // refresh seat statuses
    } catch (err) {
      setError(err.message);
      loadEvent(); // refresh if seat taken
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="container" style={{ color: 'var(--text-muted)' }}>Loading event details...</div>;
  if (error && !event) return <div className="container"><div className="error-banner">⚠️ {error}</div></div>;
  if (!event) return null;

  return (
    <div className="container" style={{ maxWidth: 840 }}>
      <div className="hero-header">
        <span className={`badge ${event.is_virtual ? 'badge-virtual' : 'badge-physical'}`}>
          {event.is_virtual ? '🌐 Virtual Stream' : '📍 Physical Venue'}
        </span>
        <h1 className="hero-title">{event.name}</h1>
        <p className="hero-subtitle">{event.description || 'Select your seats from the layout below to complete booking.'}</p>
        
        <div style={{ display: 'flex', gap: '20px', marginTop: '14px', fontSize: '14px', color: 'var(--text-muted)' }}>
          <span>📍 {event.is_virtual ? 'Online Event' : event.venue || 'Venue TBA'}</span>
          <span>📅 {event.event_date ? new Date(event.event_date).toLocaleString() : 'Date TBA'}</span>
        </div>
      </div>

      {booking && (
        <div className="success-banner">
          🎉 <strong>Booking Confirmed!</strong> Reservation #{booking.id} created successfully for {booking.user_email}. ({booking.seatIds.length} seat(s) booked).
        </div>
      )}
      {error && <div className="error-banner">⚠️ {error}</div>}

      <div className="seat-map-wrapper">
        <div className="screen-indicator">STAGE / SCREEN THIS WAY</div>

        <div className="legend">
          <div className="legend-item">
            <span className="legend-box" style={{ background: 'var(--seat-available)', border: '1px solid rgba(255,255,255,0.2)' }} /> Available
          </div>
          <div className="legend-item">
            <span className="legend-box" style={{ background: 'var(--seat-selected)' }} /> Selected
          </div>
          <div className="legend-item">
            <span className="legend-box" style={{ background: 'var(--seat-booked)', opacity: 0.5 }} /> Booked
          </div>
        </div>

        <div className="seat-map">
          {event.seats.map((seat) => (
            <button
              key={seat.id}
              className={`seat ${
                seat.status === 'booked'
                  ? 'booked'
                  : selectedSeats.includes(seat.id)
                  ? 'selected'
                  : 'available'
              }`}
              onClick={() => toggleSeat(seat)}
              disabled={seat.status === 'booked'}
              title={seat.seat_label}
            >
              {seat.seat_label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-card">
        <h3 style={{ marginBottom: 16 }}>Complete Booking</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
          {selectedSeats.length > 0
            ? `You have selected ${selectedSeats.length} seat(s). Fill in your details below to confirm.`
            : 'Click on one or more available seats above to start booking.'}
        </p>

        <form onSubmit={handleBooking}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Full Name *</label>
              <input
                required
                placeholder="John Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                required
                placeholder="john@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            className="btn"
            type="submit"
            disabled={submitting || selectedSeats.length === 0}
            style={{ marginTop: 8 }}
          >
            {submitting
              ? 'Processing Reservation...'
              : selectedSeats.length === 0
              ? 'Select Seats Above'
              : `Confirm & Book ${selectedSeats.length} Seat(s)`}
          </button>
        </form>
      </div>
    </div>
  );
}
