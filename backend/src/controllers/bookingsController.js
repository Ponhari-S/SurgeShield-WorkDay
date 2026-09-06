const bookingService = require('../services/bookingService');

async function createBooking(req, res, next) {
  try {
    const { eventId, userName, userEmail, seatIds } = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] || null;

    if (!eventId || !userName || !userEmail || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({
        error: 'eventId, userName, userEmail and a non-empty seatIds array are required',
      });
    }

    const booking = await bookingService.createBooking({
      eventId: parseInt(eventId, 10),
      userName,
      userEmail,
      seatIds: seatIds.map((id) => parseInt(id, 10)),
      idempotencyKey
    });

    res.status(201).json(booking);
  } catch (err) {
    if (err.code === 'SEATS_UNAVAILABLE') {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
}

async function getBooking(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id, 10);
    if (Number.isNaN(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }
    const booking = await bookingService.getBooking(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (err) {
    next(err);
  }
}

module.exports = { createBooking, getBooking };
