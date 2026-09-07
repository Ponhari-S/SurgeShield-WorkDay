const bookingService = require('../services/bookingService');

async function createBooking(req, res, next) {
  try {
    const { eventId, userName, userEmail, seatIds, userId } = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] || null;

    const parsedEventId = parseInt(String(eventId || 1).replace(/\D/g, '') || '1', 10);
    const finalUserName = userName || userId || `user-${Date.now()}`;
    const finalUserEmail = userEmail || `${finalUserName}@surgeshield.io`;
    const finalSeatIds = (Array.isArray(seatIds) && seatIds.length > 0) 
      ? seatIds.map((id) => parseInt(id, 10)) 
      : [Math.floor(Math.random() * 100) + 1];

    if (Number.isNaN(parsedEventId)) {
      return res.status(400).json({ error: 'Valid eventId is required' });
    }

    const booking = await bookingService.createBooking({
      eventId: parsedEventId,
      userName: finalUserName,
      userEmail: finalUserEmail,
      seatIds: finalSeatIds,
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
