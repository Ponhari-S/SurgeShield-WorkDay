import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '../lib/api';

export default function CreateEvent() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    description: '',
    venue: '',
    isVirtual: false,
    eventDate: '',
    totalSeats: 60,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // Simulate seat grid rows for live visualizer
  const simulatedSeats = useMemo(() => {
    const total = Math.min(form.totalSeats || 0, 100); // visualize up to 100 dots
    const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const perRow = 10;
    const list = [];
    for (let i = 0; i < total; i++) {
      const row = rows[Math.floor(i / perRow) % rows.length];
      const num = (i % perRow) + 1;
      list.push(`${row}${num}`);
    }
    return list;
  }, [form.totalSeats]);

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
    <div className="container" style={{ maxWidth: 1100 }}>
      {/* Back Link */}
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

      <div className="hero-header" style={{ marginBottom: 32 }}>
        <span className="hero-pill">
          <span className="pulse-dot" />
          <span>ORGANIZER STUDIO</span>
        </span>
        <h1 className="hero-title">
          Launch New Event <span className="gradient-text">&amp; Seat Grid</span>
        </h1>
        <p className="hero-subtitle">
          Configure capacity and venue logistics to auto-provision an atomic concurrency-locked seat map.
        </p>
      </div>

      {error && <div className="error-banner">⚠️ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 32 }}>
        {/* Left Column: Form */}
        <div className="form-card" style={{ marginTop: 0 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Event Title *</label>
              <input
                required
                placeholder="e.g. Autonomous AI Summit 2026"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Event Overview &amp; Description</label>
              <textarea
                rows={3}
                placeholder="Keynotes, panel discussions, and hands-on demonstrations..."
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
              />
            </div>

            {/* Virtual Event Toggle */}
            <div className="form-group">
              <label
                htmlFor="isVirtual"
                className="custom-checkbox"
                style={
                  form.isVirtual
                    ? { borderColor: 'var(--violet-neon)', background: 'rgba(139, 92, 246, 0.12)' }
                    : {}
                }
              >
                <input
                  type="checkbox"
                  id="isVirtual"
                  checked={form.isVirtual}
                  onChange={(e) => update('isVirtual', e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: 14 }}>
                    🌐 Virtual Broadcast Event
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    Stream online globally via WebRTC / Ultra-low latency mesh
                  </div>
                </div>
              </label>
            </div>

            {!form.isVirtual && (
              <div className="form-group">
                <label>Physical Venue Location *</label>
                <input
                  required
                  placeholder="e.g. Grand Convention Center, Hall B"
                  value={form.venue}
                  onChange={(e) => update('venue', e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Event Date &amp; Time</label>
              <input
                type="datetime-local"
                value={form.eventDate}
                onChange={(e) => update('eventDate', e.target.value)}
              />
            </div>

            {/* Capacity Slider & Input */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ margin: 0 }}>Total Seats Capacity (Max 1000) *</label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                  {form.totalSeats} Seats
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={form.totalSeats}
                onChange={(e) => update('totalSeats', parseInt(e.target.value, 10))}
                style={{
                  accentColor: '#ff2a5f',
                  cursor: 'pointer',
                  padding: 0,
                  height: 8,
                  marginBottom: 10,
                }}
              />
              <input
                type="number"
                min={1}
                max={1000}
                required
                value={form.totalSeats}
                onChange={(e) => update('totalSeats', parseInt(e.target.value || '0', 10))}
              />
            </div>

            <button
              className="btn"
              type="submit"
              disabled={submitting || !form.name}
              style={{ marginTop: 12 }}
            >
              {submitting ? (
                <>
                  <span className="pulse-dot" />
                  <span>Provisioning Seat Schema...</span>
                </>
              ) : (
                '🚀 Publish Event & Auto-Generate Seats'
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Live Interactive Card Preview & Seat Layout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Card Preview */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              👁️ LIVE ATTENDEE CARD PREVIEW
            </div>

            <div className="card" style={{ pointerEvents: 'none' }}>
              <div>
                <div className="card-header">
                  <span
                    className={`badge ${
                      form.isVirtual ? 'badge-virtual' : 'badge-physical'
                    }`}
                  >
                    {form.isVirtual ? '🌐 Virtual Stream' : '📍 In-Person Arena'}
                  </span>
                  <span className="badge badge-status-fast">⚡ NEW</span>
                </div>

                <h3>{form.name || 'Untitled Event'}</h3>
                <p className="card-desc">
                  {form.description || 'Event description overview will appear here...'}
                </p>

                <div className="meta-group">
                  <div className="meta-row">
                    <span className="meta-icon">📍</span>
                    <span>
                      {form.isVirtual
                        ? 'Global Online Broadcast'
                        : form.venue || 'Venue to be announced'}
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-icon">📅</span>
                    <span>
                      {form.eventDate
                        ? new Date(form.eventDate).toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Date TBA'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="capacity-container">
                  <div className="capacity-info">
                    <span className="capacity-label">Seat Availability</span>
                    <span className="capacity-num" style={{ color: '#38bdf8' }}>
                      {form.totalSeats} / {form.totalSeats} free
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-bar progress-green" style={{ width: '0%' }} />
                  </div>
                </div>

                <div className="btn" style={{ fontSize: 14, padding: '10px 16px' }}>
                  Select Seats &amp; Book →
                </div>
              </div>
            </div>
          </div>

          {/* Seat Grid Preview */}
          <div className="card" style={{ padding: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                }}
              >
                📐 GENERATED SEAT MATRIX ({form.totalSeats} SEATS)
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {Math.ceil(form.totalSeats / 10)} Rows (10 per row)
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 1fr)',
                gap: 6,
                maxHeight: 220,
                overflowY: 'auto',
                padding: 6,
                background: 'rgba(8, 14, 28, 0.6)',
                borderRadius: 12,
                border: '1px solid var(--border-subtle)',
              }}
            >
              {simulatedSeats.map((label, idx) => {
                const isVip = idx < 20;
                const isPrem = idx >= 20 && idx < 40;
                return (
                  <div
                    key={idx}
                    style={{
                      aspectRatio: '1',
                      background: isVip ? '#292014' : isPrem ? '#1d1733' : '#0f172a',
                      border: `1px solid ${
                        isVip ? 'rgba(245, 158, 11, 0.4)' : isPrem ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'
                      }`,
                      color: isVip ? '#fbbf24' : isPrem ? '#c4b5fd' : '#64748b',
                      borderRadius: 4,
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            {form.totalSeats > 100 && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, textAlign: 'center' }}>
                + {form.totalSeats - 100} additional seats generated sequentially
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
