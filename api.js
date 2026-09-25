import { auth } from "./firebase-auth.js";

async function apiRequest(endpoint, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("You must be signed in to use the server.");

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The server could not complete the request.");
  return body;
}

export function fetchItems(status = "ACTIVE") {
  return apiRequest(`/api/items?status=${encodeURIComponent(status)}`);
}

export function fetchItem(itemId) {
  return apiRequest(`/api/items/${encodeURIComponent(itemId)}`);
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

