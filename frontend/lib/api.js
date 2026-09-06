const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const { headers, ...restOptions } = options;
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...restOptions,
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
  createBooking: (payload, idempotencyKey) =>
    request('/bookings', {
      method: 'POST',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
      body: JSON.stringify(payload),
    }),
  getBooking: (id) => request(`/bookings/${id}`),
};

