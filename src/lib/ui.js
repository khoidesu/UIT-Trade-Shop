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

export function openGmailComposeDialog(email) {
  const addr = String(email || "").trim();
  if (!addr) return;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(addr)}`;
  const backdrop = el("div", { class: "modalBackdrop", role: "dialog", "aria-modal": "true" });
  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  const panel = el("div", { class: "modalPanel" });
  panel.appendChild(el("div", { class: "modalTitle" }, ["Gửi Gmail"]));
  panel.appendChild(el("div", { class: "muted", style: "margin-top:8px" }, [`Mở Gmail để soạn thư tới ${addr}`]));
  const actions = el("div", { style: "display:flex; gap:10px; margin-top:16px; flex-wrap:wrap; justify-content:flex-end" });
  const closeBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Đóng"]);
  closeBtn.addEventListener("click", close);
  const openLink = el("a", { class: "btn btn--primary", href: gmailUrl, target: "_blank", rel: "noopener noreferrer" }, ["Mở Gmail"]);
  openLink.addEventListener("click", close);
  actions.append(closeBtn, openLink);
  panel.appendChild(actions);
  backdrop.appendChild(panel);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.body.appendChild(backdrop);
}

export function renderContactRow(label, value, kind, onToast) {
  const v = String(value || "").trim();
  if (!v) {
    return el("div", { class: "summaryRow" }, [
      el("div", { class: "muted" }, [label]),
      el("div", { style: "font-weight:800" }, ["-"]),
    ]);
  }
  if (kind === "email") {
    const btn = el("button", { class: "contactLink", type: "button" }, [v]);
    btn.addEventListener("click", () => openGmailComposeDialog(v));
    return el("div", { class: "summaryRow" }, [
      el("div", { class: "muted" }, [label]),
      el("div", { style: "font-weight:800" }, [btn]),
    ]);
  }
  if (kind === "phone") {
    const btn = el("button", { class: "contactLink", type: "button" }, [v]);
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(v);
        if (typeof onToast === "function") onToast("Đã copy số điện thoại");
      } catch {
        if (typeof onToast === "function") onToast("Không thể copy (trình duyệt chặn)");
      }
    });
    return el("div", { class: "summaryRow" }, [
      el("div", { class: "muted" }, [label]),
      el("div", { style: "font-weight:800" }, [btn]),
    ]);
  }
  return el("div", { class: "summaryRow" }, [
    el("div", { class: "muted" }, [label]),
    el("div", { style: "font-weight:800" }, [v]),
  ]);
}

