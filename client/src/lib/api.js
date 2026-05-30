const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed');
  }

  return payload;
}

export function getDonors(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/donors${suffix}`);
}

export function getDonations(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/donations${suffix}`);
}

export function createDonation(body) {
  return request('/api/donations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getDrafts(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request(`/api/drafts${suffix}`);
}

export function getDraftById(id) {
  return request(`/api/drafts/${id}`);
}

export function getDraftByDonationId(donationId) {
  return request(`/api/drafts/by-donation-id/${donationId}`);
}

export function generateDraft(body) {
  return request('/api/drafts/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateDraft(id, body) {
  return request(`/api/drafts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function saveEmailDraft(draftId, body) {
  return request(`/api/email/save/${draftId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function rejectEmailDraft(draftId) {
  return request(`/api/email/reject/${draftId}`, {
    method: 'POST',
  });
}

export function approveAndSendEmail(draftId, body) {
  return request(`/api/email/approve-and-send/${draftId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function bulkApproveEmails(body = {}) {
  return request('/api/email/batch-approve', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function bulkSendEmails(body = {}) {
  return request('/api/email/batch-send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
