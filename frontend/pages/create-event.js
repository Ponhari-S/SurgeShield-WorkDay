import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function CreateEvent() {
  const router = useRouter();
  const { user, isOrganizer, logout } = useAuth();

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

  // 1. Unauthenticated Gate
  if (!user) {
    return (
      <div className="container" style={{ maxWidth: 640, textAlign: 'center', padding: '60px 20px' }}>
        <div className="card" style={{ padding: '48px 32px' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            Organizer Authentication Required
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 15, lineHeight: 1.6 }}>
            Only verified Event Organizers have permissions to provision event venues and generate atomic concurrency seat maps.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/login?redirect=/create-event"
              className="btn"
              style={{ width: 'auto', padding: '12px 28px' }}
            >
              Sign In as Organizer →
            </Link>
            <Link
              href="/"
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '12px 24px' }}
            >
              Explore Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Participant Role Restriction Gate (Strict Role Separation)
  if (!isOrganizer) {
    return (
      <div className="container" style={{ maxWidth: 640, textAlign: 'center', padding: '60px 20px' }}>
        <div className="card" style={{ padding: '48px 32px' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            Organizer Account Required
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 15, lineHeight: 1.6 }}>
            You are currently signed in as <strong style={{ color: '#ffffff' }}>{user.name}</strong> with a <span style={{ color: '#3b82f6', fontWeight: 700 }}>Participant</span> account.
            Participant accounts cannot publish events. To create and host events, please sign in or register with an <strong>Organizer Account</strong>.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                logout();
                router.push('/login?redirect=/create-event&initialMode=login');
              }}
              className="btn"
              style={{ width: 'auto', padding: '12px 24px' }}
            >
              Sign In as Organizer →
            </button>
            <button
              onClick={() => {
                logout();
                router.push('/signup?redirect=/create-event');
              }}
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '12px 24px' }}
            >
              Create Organizer Account
            </button>
            <Link
              href="/"
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '12px 20px' }}
            >
              Browse Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Organizer Studio
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <span className="hero-pill">
            <span className="pulse-dot" />
            <span>ORGANIZER STUDIO</span>
          </span>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              color: '#93c5fd',
            }}
          >
            <span>HOST: <strong>{user.name}</strong></span>
          </div>
        </div>

        <h1 className="hero-title" style={{ marginTop: 12 }}>
          Launch New Event <span className="gradient-text">&amp; Seat Grid</span>
        </h1>
        <p className="hero-subtitle">
          Configure capacity and venue logistics to auto-provision an atomic concurrency-locked seat map.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

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
                    ? { borderColor: 'var(--primary)', background: 'rgba(37, 99, 235, 0.1)' }
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
                    Virtual Broadcast Event
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
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#3b82f6' }}>
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
                  accentColor: '#2563eb',
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
                'Publish Event & Generate Seats'
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
              LIVE ATTENDEE CARD PREVIEW
            </div>

            <div className="card" style={{ pointerEvents: 'none' }}>
              <div>
                <div className="card-header">
                  <span
                    className={`badge ${
                      form.isVirtual ? 'badge-virtual' : 'badge-physical'
                    }`}
                  >
                    {form.isVirtual ? 'Virtual Stream' : 'In-Person Arena'}
                  </span>
                  <span className="badge badge-status-fast">NEW</span>
                </div>

                <h3>{form.name || 'Untitled Event'}</h3>
                <p className="card-desc">
                  {form.description || 'Event description overview will appear here...'}
                </p>

                <div className="meta-group">
                  <div className="meta-row">
                    <span className="meta-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <span>
                      {form.isVirtual
                        ? 'Global Online Broadcast'
                        : form.venue || 'Venue to be announced'}
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </span>
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
                    <span className="capacity-num" style={{ color: '#3b82f6' }}>
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
                GENERATED SEAT MATRIX ({form.totalSeats} SEATS)
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
                      background: isVip ? '#172554' : isPrem ? '#1e293b' : '#0f172a',
                      border: `1px solid ${
                        isVip ? 'rgba(59, 130, 246, 0.4)' : isPrem ? 'rgba(148, 163, 184, 0.3)' : 'rgba(255, 255, 255, 0.08)'
                      }`,
                      color: isVip ? '#93c5fd' : isPrem ? '#cbd5e1' : '#64748b',
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
