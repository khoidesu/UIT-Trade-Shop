import { clamp } from "../lib/ui.js";

export class CartStore {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this._items = this._load();
  }

  setStorageKey(storageKey) {
    if (!storageKey || this.storageKey === storageKey) return;
    this.storageKey = storageKey;
    this._items = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x) => x && typeof x.productId === "number" && typeof x.qty === "number")
        .map((x) => ({ productId: x.productId, qty: clamp(Math.floor(x.qty), 1, 999) }));
    } catch {
      return [];
    }
  }

  _save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this._items));
  }

  items() {
    return [...this._items].sort((a, b) => a.productId - b.productId);
  }

  setItems(nextItems) {
    if (!Array.isArray(nextItems)) {
      this._items = [];
      this._save();
      return;
    }
    this._items = nextItems
      .filter((x) => x && typeof x.productId === "number" && typeof x.qty === "number")
      .map((x) => ({ productId: x.productId, qty: clamp(Math.floor(x.qty), 1, 999) }));
    this._save();
  }

  itemsDetailed(products) {
    return this.items()
      .map((it) => {
        const p = products.find((x) => x.id === it.productId);
        if (!p) return null;
        return { product: p, qty: it.qty, lineTotal: p.price * it.qty };
      })
      .filter(Boolean);
  }

  countItems() {
    return this._items.reduce((sum, it) => sum + it.qty, 0);
  }

  subtotal(products) {
    return this._items.reduce((sum, it) => {
      const p = products.find((x) => x.id === it.productId);
      if (!p) return sum;
      return sum + p.price * it.qty;
    }, 0);
  }

  addItem(productId, qty) {
    const q = clamp(Math.floor(qty || 1), 1, 999);
    const existing = this._items.find((x) => x.productId === productId);
    if (existing) existing.qty = clamp(existing.qty + q, 1, 999);
    else this._items.push({ productId, qty: q });
    this._save();
  }

  setQty(productId, qty) {
    const q = Math.floor(qty || 0);
    const idx = this._items.findIndex((x) => x.productId === productId);
    if (idx < 0) return;
    if (q <= 0) this._items.splice(idx, 1);
    else this._items[idx].qty = clamp(q, 1, 999);
    this._save();
  }

  removeItem(productId) {
    const idx = this._items.findIndex((x) => x.productId === productId);
    if (idx >= 0) this._items.splice(idx, 1);
    this._save();
  }

  clear() {
    this._items = [];
    this._save();
  }
}

