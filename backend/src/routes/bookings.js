const express = require('express');
const router = express.Router();
const controller = require('../controllers/bookingsController');
const idempotencyMiddleware = require('../middleware/idempotency');

router.post('/', idempotencyMiddleware, controller.createBooking);
router.get('/:id', controller.getBooking);

module.exports = router;

