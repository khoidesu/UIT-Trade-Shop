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

export async function fetchPendingUsers() {
  const res = await fetch(`${API_BASE}/admin/pending-users`, {
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Load pending users failed");
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

