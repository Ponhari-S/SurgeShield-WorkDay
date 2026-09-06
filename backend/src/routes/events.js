const express = require('express');
const router = express.Router();
const controller = require('../controllers/eventsController');

router.post('/', controller.createEvent);
router.get('/', controller.listEvents);
router.get('/:id', controller.getEvent);

module.exports = router;
