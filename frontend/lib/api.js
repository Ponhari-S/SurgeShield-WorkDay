// Thin wrapper around fetch so all API calls go through one place.
// EXTENSION POINT: add retry/backoff here later for dependency-failure handling.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  listEvents: () => request('/events'),
  getEvent: (id) => request(`/events/${id}`),
  createEvent: (payload) =>
    request('/events', { method: 'POST', body: JSON.stringify(payload) }),
  createBooking: (payload) =>
    request('/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  getBooking: (id) => request(`/bookings/${id}`),
};
