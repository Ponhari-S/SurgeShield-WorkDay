const db = require('../db');

// NOTE on concurrency (deliberately simple for v1):
// This uses a single DB transaction with a row-level check-then-update.
// It is NOT yet safe against two users racing for the very last seat under
// high concurrency (that needs `SELECT ... FOR UPDATE` / SERIALIZABLE
// isolation, or a queue-based reservation flow) - that hardening is planned
// as a follow-up per the project brief (overbooking prevention).
async function createBooking({ eventId, userName, userEmail, seatIds }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Lock the requested seat rows for this transaction.
    const seatCheck = await client.query(
      `SELECT id, status FROM seats
       WHERE event_id = $1 AND id = ANY($2::int[])
       FOR UPDATE`,
      [eventId, seatIds]
    );

    if (seatCheck.rows.length !== seatIds.length) {
      throw new Error('One or more selected seats do not exist for this event');
    }

    const unavailable = seatCheck.rows.filter((s) => s.status !== 'available');
    if (unavailable.length > 0) {
      const err = new Error('One or more selected seats are already booked');
      err.code = 'SEATS_UNAVAILABLE';
      throw err;
    }

    const bookingResult = await client.query(
      `INSERT INTO bookings (event_id, user_name, user_email, status)
       VALUES ($1, $2, $3, 'confirmed') RETURNING *`,
      [eventId, userName, userEmail]
    );
    const booking = bookingResult.rows[0];

    await client.query(
      `UPDATE seats SET status = 'booked', booking_id = $1
       WHERE event_id = $2 AND id = ANY($3::int[])`,
      [booking.id, eventId, seatIds]
    );

    await client.query('COMMIT');

    // EXTENSION POINT: instead of doing this inline, publish a
    // "booking.confirmed" event here (outbox pattern) and let a worker
    // send confirmation email / calendar invite asynchronously.

    return { ...booking, seatIds };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getBooking(bookingId) {
  const bookingResult = await db.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  if (bookingResult.rows.length === 0) return null;

  const seatsResult = await db.query(
    'SELECT id, seat_label FROM seats WHERE booking_id = $1',
    [bookingId]
  );

  return { ...bookingResult.rows[0], seats: seatsResult.rows };
}

module.exports = { createBooking, getBooking };
