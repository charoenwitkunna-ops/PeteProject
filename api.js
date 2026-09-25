import { auth } from "./firebase-auth.js";

async function apiRequest(endpoint, options = {}) {
  let token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("You must be signed in to use the server.");

  let response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  // Automatically refresh token on 401 Unauthorized (e.g. 1-hour session expiry)
  if (response.status === 401 && auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken(true);
      response = await fetch(endpoint, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {})
        }
      });
    } catch (refreshErr) {
      console.warn("Could not refresh Firebase auth token:", refreshErr);
    }
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The server could not complete the request.");
  return body;
}

export async function fetchItems(status = "ACTIVE") {
  const token = await auth.currentUser?.getIdToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`/api/items?status=${encodeURIComponent(status)}`, { headers });
  const body = await response.json().catch(() => []);
  if (!response.ok) throw new Error(body.error || "Could not load items.");
  return body;
}

export function fetchStats() {
  return fetch("/api/stats").then(res => res.json()).catch(() => null);
}

export async function fetchItem(itemId) {
  const token = await auth.currentUser?.getIdToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`/api/items/${encodeURIComponent(itemId)}`, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Could not load item.");
  return body;
}

export function createItem(item) {
  const { id, status, registeredBy, createdAt, ...payload } = item;
  return apiRequest("/api/items", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchLostReports() {
  return apiRequest("/api/lost-reports");
}

export function createLostReport(report) {
  const { id, status, createdAt, updatedAt, ...payload } = report;
  return apiRequest("/api/lost-reports", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateLostReportStatus(reportId, status) {
  return apiRequest(`/api/lost-reports/${encodeURIComponent(reportId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function createHandover(handoverDetails) {
  return apiRequest("/api/handovers", {
    method: "POST",
    body: JSON.stringify(handoverDetails)
  });
}

export function deleteItem(itemId) {
  return apiRequest(`/api/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE"
  });
}

