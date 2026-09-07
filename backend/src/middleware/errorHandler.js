// Central error handler. Keeps error shape consistent and gives us one
// place to later plug in structured logging / alerting (e.g. Sentry, Slack
// webhook on 5xx) without touching every controller.
module.exports = function errorHandler(err, req, res, next) {
  console.error(err); // EXTENSION POINT: replace with structured logger

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? (err.message || 'Internal server error') : err.message,
    details: err.message,
    code: err.code || null
  });
};
