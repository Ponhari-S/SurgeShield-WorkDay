import { useState } from 'react';
import { useRouter } from 'next/router';
import { api } from '../lib/api';

export default function CreateEvent() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    description: '',
    venue: '',
    isVirtual: false,
    eventDate: '',
    totalSeats: 50,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const event = await api.createEvent(form);
      router.push(`/events/${event.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="hero-header">
        <h1 className="hero-title">Create New Event</h1>
        <p className="hero-subtitle">
          Define event details and total capacity to auto-generate seat maps.
        </p>
      </div>

      {error && <div className="error-banner">⚠️ {error}</div>}

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Event Title *</label>
            <input
              required
              placeholder="e.g. Tech Conference 2026"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              rows={3}
              placeholder="Provide event overview and details..."
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="isVirtual"
              checked={form.isVirtual}
              onChange={(e) => update('isVirtual', e.target.checked)}
              style={{ width: 20, height: 20, cursor: 'pointer' }}
            />
            <label htmlFor="isVirtual" style={{ margin: 0, cursor: 'pointer' }}>
              Virtual Event (Online Stream)
            </label>
          </div>

          {!form.isVirtual && (
            <div className="form-group">
              <label>Venue Location</label>
              <input
                placeholder="e.g. Grand Convention Center, Hall B"
                value={form.venue}
                onChange={(e) => update('venue', e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label>Event Date & Time</label>
            <input
              type="datetime-local"
              value={form.eventDate}
              onChange={(e) => update('eventDate', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Total Seats (Max 1000) *</label>
            <input
              type="number"
              min={1}
              max={1000}
              required
              value={form.totalSeats}
              onChange={(e) => update('totalSeats', parseInt(e.target.value || '0', 10))}
            />
          </div>

          <button className="btn" type="submit" disabled={submitting} style={{ marginTop: 12 }}>
            {submitting ? 'Creating Event...' : '🚀 Publish Event & Generate Seats'}
          </button>
        </form>
      </div>
    </div>
  );
}
