export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === "class") node.className = String(v);
    else if (k === "style") node.setAttribute("style", String(v));
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  });
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function currencyPHP(amount) {
  const n = typeof amount === "number" ? amount : Number(amount || 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function currencyVND(amount) {
  const n = typeof amount === "number" ? amount : Number((amount || '').toString().replace(/[^\d]/g, ""));
  return n.toLocaleString("vi-VN") + "₫";
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function formatRating(r) {
  return `${Number(r).toFixed(1)} ★`;
}

export function formatStatus(status) {
  let n = status;
  if (typeof n === "string" && n.includes("%")) {
    n = Number(n.replace(/[^\d]/g, ""));
  } else {
    n = Number(n);
  }
  if (isNaN(n) || n < 1 || n > 99) return "tình trạng: ?%";
  return `tình trạng: ${n}%`;
}

export function debounce(fn, waitMs) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), waitMs);
  };
}

