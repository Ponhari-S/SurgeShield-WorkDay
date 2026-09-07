const express = require('express');
const router = express.Router();
const controller = require('../controllers/eventsController');

router.post('/', controller.createEvent);
router.get('/', controller.listEvents);
router.post('/:id/reset', controller.resetEvent);
router.get('/:id', controller.getEvent);

module.exports = router;
