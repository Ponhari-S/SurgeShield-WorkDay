const eventService = require('../services/eventService');

async function createEvent(req, res, next) {
  try {
    const { name, description, venue, isVirtual, eventDate, totalSeats } = req.body;

    if (!name || !totalSeats) {
      return res.status(400).json({ error: 'name and totalSeats are required' });
    }
    if (totalSeats < 1 || totalSeats > 1000) {
      return res.status(400).json({ error: 'totalSeats must be between 1 and 1000' });
    }

    const event = await eventService.createEvent({
      name,
      description,
      venue,
      isVirtual: !!isVirtual,
      eventDate,
      totalSeats,
    });
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

async function listEvents(req, res, next) {
  try {
    const events = await eventService.listEvents();
    res.json(events);
  } catch (err) {
    next(err);
  }
}

async function getEvent(req, res, next) {
  try {
    const eventId = parseInt(req.params.id, 10);
    if (Number.isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event id' });
    }
    const event = await eventService.getEventWithSeats(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    next(err);
  }
}

async function resetEvent(req, res, next) {
  try {
    const eventId = parseInt(req.params.id || 1, 10);
    const result = await eventService.resetEventSeats(eventId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { createEvent, listEvents, getEvent, resetEvent };
