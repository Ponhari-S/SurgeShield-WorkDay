const express = require('express');
const router = express.Router();
const controller = require('../controllers/bookingsController');

router.post('/', controller.createBooking);
router.get('/:id', controller.getBooking);

module.exports = router;
