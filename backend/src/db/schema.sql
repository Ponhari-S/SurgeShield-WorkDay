-- SurgeShield Event Registration Platform - Core Schema
-- Kept intentionally simple for v1. Extension points noted below for later work
-- (concurrency control, idempotency keys, outbox/async processing, etc).

CREATE TABLE IF NOT EXISTS events (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    venue           VARCHAR(255),
    is_virtual      BOOLEAN DEFAULT FALSE,
    event_date      TIMESTAMP,
    total_seats     INTEGER NOT NULL CHECK (total_seats > 0),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
    id              SERIAL PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_name       VARCHAR(255) NOT NULL,
    user_email      VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seats (
    id              SERIAL PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    seat_label       VARCHAR(10) NOT NULL, -- e.g. A1, A2, B1
    status          VARCHAR(20) NOT NULL DEFAULT 'available',
    -- status: available | booked  (later: held/locked for short-TTL reservation)
    booking_id      INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    UNIQUE(event_id, seat_label)
);

-- EXTENSION POINT (future work, not implemented yet):
--   1. seats.held_until TIMESTAMP + status='held' -> soft-lock seat during checkout
--   2. bookings.idempotency_key -> dedupe retried booking requests
--   3. outbox_events table -> reliable async notification/reminder processing
--   4. seat booking should use "SELECT ... FOR UPDATE" / a serializable transaction
--      to prevent overbooking under concurrent requests for the last seat.

CREATE INDEX IF NOT EXISTS idx_seats_event_id ON seats(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
