const API_BASE = "http://127.0.0.1:8000/api";

function authHeaders() {
  const token = localStorage.getItem("shopee_auth_token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return await res.json();
}

export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return await res.json();
}

export async function upsertProduct(payload) {
  const res = await fetch(`${API_BASE}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Failed to save product (${res.status})`);
  }
  return data;
}

export async function deleteProduct(productId) {
  const res = await fetch(`${API_BASE}/products/${productId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Failed to delete product (${res.status})`);
  return data;
}

export async function updateProduct(productId, payload) {
  const res = await fetch(`${API_BASE}/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Failed to update product (${res.status})`);
  return data;
}

export async function registerUser(payload) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Register failed");
  return data;
}

export async function loginUser(payload) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Login failed");
  return data;
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: { ...authHeaders() } });
  if (!res.ok) return null;
  return await res.json();
}

export async function updateMe(payload) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot update profile");
  return data;
}

export async function fetchUserProfile(username) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, {
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot load user profile");
  return data;
}

export async function logoutUser() {
  const res = await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { ...authHeaders() } });
  if (!res.ok) return;
}

export async function verifyStudent(payload) {
  const res = await fetch(`${API_BASE}/admin/verify-student`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Verify failed");
  return data;
}

export async function fetchLostFound({ limit, q } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (q && String(q).trim()) params.set("q", String(q).trim());
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/lost-found${qs ? `?${qs}` : ""}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot load lost & found posts");
  return Array.isArray(data) ? data : [];
}

export async function fetchLostFoundPost(id) {
  const res = await fetch(`${API_BASE}/lost-found/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot load post");
  return data;
}

export async function createLostFoundPost(payload) {
  const res = await fetch(`${API_BASE}/lost-found`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot create post");
  return data;
}

export async function deleteLostFoundPost(id) {
  const res = await fetch(`${API_BASE}/lost-found/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot delete post");
  return data;
}

export async function fetchPendingUsers() {
  const res = await fetch(`${API_BASE}/admin/pending-users`, {
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Load pending users failed");
  return data;
}

export async function fetchStandardUsers() {
  const res = await fetch(`${API_BASE}/admin/standard-users`, {
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Load standard users failed");
  return Array.isArray(data) ? data : [];
}

export async function deleteUserAsAdmin(username) {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(username)}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Delete user failed");
  return data;
}

export async function placeOrder(payload) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Order failed");
  return data;
}

export async function fetchCart() {
  const res = await fetch(`${API_BASE}/cart`, {
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot load cart");
  return Array.isArray(data?.items) ? data.items : [];
}

export async function saveCart(items) {
  const res = await fetch(`${API_BASE}/cart`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ items }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot save cart");
  return Array.isArray(data?.items) ? data.items : [];
}

export async function reportProduct(payload) {
  const res = await fetch(`${API_BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot report product");
  return data;
}

export async function fetchMyOrders() {
  const res = await fetch(`${API_BASE}/orders/me`, {
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot load orders");
  return Array.isArray(data) ? data : [];
}

export async function fetchConversations() {
  const res = await fetch(`${API_BASE}/messages`, {
    headers: { ...authHeaders() }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot load conversations");
  return Array.isArray(data) ? data : [];
}

export async function fetchMessagesWith(username) {
  const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(username)}`, {
    headers: { ...authHeaders() }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot load messages");
  return Array.isArray(data) ? data : [];
}

export async function sendMessage(username, payload) {
  const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(username)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Cannot send message");
  return data;
}

