const express = require('express');
const router = express.Router();
const controller = require('../controllers/bookingsController');
const idempotencyMiddleware = require('../middleware/idempotency');

router.post('/reset', async (req, res, next) => {
  try {
    const eventService = require('../services/eventService');
    const result = await eventService.resetEventSeats(1);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
router.post('/', idempotencyMiddleware, controller.createBooking);
router.get('/:id', controller.getBooking);

module.exports = router;

