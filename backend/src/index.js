require('dotenv').config();
const express = require('express');
const cors = require('cors');

const eventsRouter = require('./routes/events');
const bookingsRouter = require('./routes/bookings');
const errorHandler = require('./middleware/errorHandler');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Simple health check - EXTENSION POINT: expand into a real readiness/
// liveness probe (check DB connectivity, dependency health, etc.)
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy' });
  }
});

app.use('/api/events', eventsRouter);
app.use('/api/bookings', bookingsRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SurgeShield backend running on port ${PORT}`);
});
