const db = require('../db');

// Generates simple seat labels like A1..A10, B1..B10 etc for a given total.
function generateSeatLabels(totalSeats) {
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const perRow = 10;
  const labels = [];
  for (let i = 0; i < totalSeats; i++) {
    const row = rows[Math.floor(i / perRow) % rows.length];
    const num = (i % perRow) + 1;
    labels.push(`${row}${num}`);
  }
  return labels;
}

async function createEvent({ name, description, venue, isVirtual, eventDate, totalSeats }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const eventResult = await client.query(
      `INSERT INTO events (name, description, venue, is_virtual, event_date, total_seats)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description, venue, isVirtual, eventDate, totalSeats]
    );
    const event = eventResult.rows[0];

    const seatLabels = generateSeatLabels(totalSeats);
    const values = [];
    const placeholders = seatLabels
      .map((label, idx) => {
        values.push(event.id, label);
        return `($${idx * 2 + 1}, $${idx * 2 + 2})`;
      })
      .join(', ');

    await client.query(
      `INSERT INTO seats (event_id, seat_label) VALUES ${placeholders}`,
      values
    );

    await client.query('COMMIT');
    return event;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listEvents() {
  const result = await db.query(
    `SELECT e.*,
            COUNT(s.*) FILTER (WHERE s.status = 'available') AS seats_available
     FROM events e
     LEFT JOIN seats s ON s.event_id = e.id
     GROUP BY e.id
     ORDER BY e.created_at DESC`
  );
  return result.rows;
}

async function getEventWithSeats(eventId) {
  const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [eventId]);
  if (eventResult.rows.length === 0) return null;

  const seatsResult = await db.query(
    'SELECT id, seat_label, status FROM seats WHERE event_id = $1 ORDER BY seat_label',
    [eventId]
  );

  return { ...eventResult.rows[0], seats: seatsResult.rows };
}

async function resetEventSeats(eventId) {
  await db.query(`UPDATE seats SET status = 'available', booking_id = NULL WHERE event_id = $1`, [eventId]);
  await db.query(`DELETE FROM bookings WHERE event_id = $1`, [eventId]);
  return { message: `Seats reset to available for event ${eventId}` };
}

module.exports = { createEvent, listEvents, getEventWithSeats, resetEventSeats };
