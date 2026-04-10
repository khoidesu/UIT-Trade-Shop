import { currencyVND, el, formatStatus, clamp } from "../lib/ui.js";
import { ALLOWED_CATEGORIES } from "../data/categories.js";

function hero({ q, category, count }) {
  const title = q?.trim()
    ? `Results for “${q.trim()}”`
    : category !== "All"
      ? `${category} deals`
      : "Today’s picks";
  const subtitle = `${count} product${count === 1 ? "" : "s"} • mock storefront`;

  return el("div", { class: "hero" }, [
    el("div", {}, [
      el("div", { class: "hero__title" }, [title]),
      el("div", { class: "hero__subtitle muted" }, [subtitle]),
    ]),
    el("a", { class: "btn btn--primary", href: "#/checkout" }, ["Checkout"]),
  ]);
}

function productCard(p, { onOpen, onAdd, onDelete, canAddToCart, canDelete }) {
  const card = el("article", { class: "card" });
  const img = el("div", { class: "card__img" }, ["SHP"]);
  img.title = p.name;
  img.addEventListener("click", () => onOpen(p.id));
  img.style.cursor = "pointer";

  card.appendChild(img);
  const body = el("div", { class: "card__body" });
  body.appendChild(el("div", { class: "card__title" }, [p.name]));
  body.appendChild(
    el("div", { class: "card__meta" }, [
      el("div", { class: "price" }, [currencyVND(p.price)]),
      el("div", { class: "status" }, [formatStatus(p.status)]),
    ])
  );
  body.appendChild(el("div", { class: "muted" }, [`${p.brand} • ${p.category} • SL: ${p.quantity}`]));

  const actions = el("div", { class: "card__actions" });
  const viewBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["View"]);
  viewBtn.addEventListener("click", () => onOpen(p.id));
  const addBtn = el("button", { class: "btn btn--primary", type: "button" }, [canAddToCart ? "Add" : "Login to buy"]);
  if (!canAddToCart) addBtn.disabled = true;
  addBtn.addEventListener("click", () => onAdd(p.id));
  actions.append(viewBtn, addBtn);
  if (canDelete) {
    const delBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Delete"]);
    delBtn.addEventListener("click", () => onDelete(p.id));
    actions.appendChild(delBtn);
  }
  body.appendChild(actions);

  card.appendChild(body);
  return card;
}

export function renderHome({ products, q, category, onOpen, onAdd, onDelete, canAddToCart, canDeleteProduct }) {
  const root = document.createDocumentFragment();
  root.appendChild(hero({ q, category, count: products.length }));

  if (products.length === 0) {
    root.appendChild(
      el("div", { class: "panel", style: "margin-top:14px" }, [
        el("div", { class: "pageTitle" }, ["No products found"]),
        el("div", { class: "muted" }, ["Try a different keyword or category."]),
      ])
    );
    return root;
  }

  const grid = el("div", { class: "grid" });
  products.forEach((p) =>
    grid.appendChild(
      productCard(p, {
        onOpen,
        onAdd,
        onDelete,
        canAddToCart,
        canDelete: canDeleteProduct(p),
      })
    )
  );
  root.appendChild(grid);
  return root;
}

export function renderProduct({ product, onAdd, onBack, canBuy, canDelete, onDelete }) {
  const qtyState = { qty: 1 };

  const qtyText = el("div", { class: "qty__value" }, [String(qtyState.qty)]);
  const dec = () => {
    qtyState.qty = clamp(qtyState.qty - 1, 1, product.quantity);
    qtyText.textContent = String(qtyState.qty);
  };
  const inc = () => {
    qtyState.qty = clamp(qtyState.qty + 1, 1, product.quantity);
    qtyText.textContent = String(qtyState.qty);
  };

  const root = el("div");
  root.appendChild(
    el("div", { class: "pageTitle" }, ["Product"])
  );

  const panel = el("section", { class: "detail" });
  const row = el("div", { class: "detail__row" });
  row.appendChild(
    el("div", { class: "detail__media" }, [
      el("div", { class: "detail__mediaBox" }, ["SHP"]),
    ])
  );
  const content = el("div", { class: "detail__content" });
  content.appendChild(
    el("div", { style: "display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap" }, [
      el("div", { class: "detail__title" }, [product.name]),
      el("button", { class: "btn btn--ghost", type: "button" }, ["Back"]),
    ])
  );
  content.querySelector("button").addEventListener("click", () => onBack());

  content.appendChild(
    el("div", { class: "detail__pillRow" }, [
      el("span", { class: "pill" }, [product.brand]),
      el("span", { class: "pill" }, [product.category]),
      el("span", { class: "pill" }, [formatStatus(product.status)]),
      el("span", { class: "pill" }, ["SL: " + product.quantity]),
    ])
  );
  content.appendChild(el("div", { class: "price", style: "font-size:22px" }, [currencyVND(product.price)]));
  content.appendChild(el("div", { class: "muted" }, [product.description]));

  if (Array.isArray(product.tags) && product.tags.length) {
    content.appendChild(
      el("div", { class: "detail__pillRow" }, product.tags.map((t) => el("span", { class: "pill" }, [t])))
    );
  }

  const qty = el("div", { class: "qty" });
  const minus = el("button", { class: "qty__btn", type: "button" }, ["−"]);
  minus.addEventListener("click", dec);
  const plus = el("button", { class: "qty__btn", type: "button" }, ["+"]);
  plus.addEventListener("click", inc);
  qty.append(el("span", { class: "muted", style: "font-weight:900" }, ["Qty"]), minus, qtyText, plus);
  content.appendChild(qty);

  const actions = el("div", { style: "display:flex; gap:10px; margin-top:6px; flex-wrap:wrap" });
  const addBtn = el("button", { class: "btn btn--primary", type: "button" }, [canBuy ? "Add to cart" : "Login/verify to buy"]);
  if (!canBuy) addBtn.disabled = true;
  addBtn.addEventListener("click", () => onAdd(qtyState.qty));
  const buyBtn = el("a", { class: "btn btn--ghost", href: "#/checkout" }, ["Go to checkout"]);
  actions.append(addBtn, buyBtn);
  if (canDelete) {
    const delBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Delete product"]);
    delBtn.addEventListener("click", () => onDelete(product.id));
    actions.appendChild(delBtn);
  }
  content.appendChild(actions);

  row.appendChild(content);
  panel.appendChild(row);
  root.appendChild(panel);
  return root;
}

export function renderCheckout({ cartItems, subtotal, onSubmit, onOpenCart }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Checkout (Mock)"]));

  if (!cartItems.length) {
    root.appendChild(
      el("div", { class: "panel" }, [
        el("div", { class: "pageTitle" }, ["Your cart is empty"]),
        el("div", { class: "muted" }, ["Add at least one product to checkout."]),
        el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
          el("a", { class: "btn btn--primary", href: "#/" }, ["Browse products"]),
          el("button", { class: "btn btn--ghost", type: "button" }, ["Open cart"]),
        ]),
      ])
    );
    root.querySelector("button").addEventListener("click", () => onOpenCart());
    return root;
  }

  const shipping = subtotal >= 999 ? 0 : 59;
  const serviceFee = Math.round(subtotal * 0.02);
  const total = subtotal + shipping + serviceFee;

  const left = el("div", { class: "panel" });
  left.appendChild(el("div", { class: "pageTitle" }, ["Delivery details"]));

  const form = el("form");
  form.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Full name"]),
        el("input", { class: "input", name: "name", required: "true", placeholder: "Juan Dela Cruz" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Phone"]),
        el("input", { class: "input", name: "phone", required: "true", placeholder: "09xx xxx xxxx" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Address"]),
      el("textarea", { class: "textarea", name: "address", required: "true", placeholder: "Street, Barangay, City, Province" }),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Payment method"]),
        el("select", { class: "select", name: "payment", required: "true" }, [
          el("option", { value: "COD" }, ["Cash on Delivery"]),
          el("option", { value: "GCash (Mock)" }, ["GCash (Mock)"]),
          el("option", { value: "Card (Mock)" }, ["Card (Mock)"]),
        ]),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Note to seller (optional)"]),
        el("input", { class: "input", name: "note", placeholder: "e.g. Please pack well" }),
      ]),
    ])
  );

  const submitRow = el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
    el("a", { class: "btn btn--ghost", href: "#/" }, ["Continue shopping"]),
    el("button", { class: "btn btn--primary", type: "submit" }, ["Place order"]),
  ]);
  form.appendChild(submitRow);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const address = String(fd.get("address") || "").trim();
    const payment = String(fd.get("payment") || "").trim();
    const note = String(fd.get("note") || "").trim();

    if (!name || !phone || !address || !payment) return;

    onSubmit({ name, phone, address, payment, note, total });
  });

  left.appendChild(form);

  const right = el("div", { class: "panel" });
  right.appendChild(el("div", { class: "pageTitle" }, ["Order summary"]));

  cartItems.forEach((it) => {
    right.appendChild(
      el("div", { class: "summaryRow" }, [
        el("div", {}, [
          el("div", { style: "font-weight:900" }, [it.product.name]),
          el("div", { class: "muted" }, [`Qty: ${it.qty}`]),
        ]),
        el("div", { class: "price" }, [currencyVND(it.lineTotal)]),
      ])
    );
  });
  right.appendChild(el("div", { style: "height:10px" }));
  right.appendChild(el("div", { class: "summaryRow" }, [
    el("div", { class: "muted" }, ["Subtotal"]),
    el("div", { style: "font-weight:1000" }, [currencyVND(subtotal)]),
  ]));
  right.appendChild(el("div", { class: "summaryRow" }, [
    el("div", { class: "muted" }, ["Shipping"]),
    el("div", { style: "font-weight:1000" }, [shipping === 0 ? "FREE" : currencyVND(shipping)]),
  ]));
  right.appendChild(el("div", { class: "summaryRow" }, [
    el("div", { class: "muted" }, ["Service fee"]),
    el("div", { style: "font-weight:1000" }, [currencyVND(serviceFee)]),
  ]));
  right.appendChild(el("div", { class: "summaryRow" }, [
    el("div", { style: "font-weight:1000" }, ["Total"]),
    el("div", { class: "price", style: "font-size:18px" }, [currencyVND(total)]),
  ]));
  right.appendChild(
    el("div", { class: "muted", style: "margin-top:10px" }, [
      "This checkout is a demo for school only. No real payment is processed.",
    ])
  );

  const split = el("div", { class: "split" }, [left, right]);
  root.appendChild(split);
  return root;
}

export function renderNotFound() {
  return el("div", { class: "panel", style: "margin-top:14px" }, [
    el("div", { class: "pageTitle" }, ["Page not found"]),
    el("div", { class: "muted" }, ["Go back to the home page."]),
    el("div", { style: "margin-top:12px" }, [
      el("a", { class: "btn btn--primary", href: "#/" }, ["Home"]),
    ]),
  ]);
}

export function renderAdmin({ onSubmit, onCancel }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Admin: Add/Update Product"]));

  const panel = el("div", { class: "panel" });
  const form = el("form");
  form.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Name"]),
        el("input", { class: "input", name: "name", required: "true", placeholder: "Bluetooth Speaker" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Brand"]),
        el("input", { class: "input", name: "brand", required: "true", placeholder: "SoundMax" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Category"]),
        el("select", { class: "select", name: "category", required: "true" }, [
          el("option", { value: "" }, ["— Chọn danh mục —"]),
          ...ALLOWED_CATEGORIES.map((c) => el("option", { value: c }, [c])),
        ]),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Giá tiền (VNĐ)"]),
        el("input", { class: "input", name: "price", type: "number", required: "true", placeholder: "899000" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Tình trạng (%)"]),
        el("input", { class: "input", name: "status", type: "number", min: "1", max: "99", required: "true", placeholder: "90" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Số lượng muốn bán"]),
        el("input", { class: "input", name: "quantity", type: "number", required: "true", placeholder: "1" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Mô tả"]),
        el("textarea", { class: "input", name: "description", required: "true", placeholder: "Mô tả sản phẩm...", rows: 3 }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Tags (phân cách bởi dấu phẩy)"]),
        el("input", { class: "input", name: "tags", placeholder: "tag1, tag2" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { style: "margin-top:18px; display:flex; gap:10px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Lưu"]),
      el("button", { class: "btn btn--ghost", type: "button" }, ["Huỷ"]),
    ])
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const tags = String(fd.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean);
    onSubmit({
      name: fd.get("name"),
      brand: fd.get("brand"),
      category: fd.get("category"),
      price: fd.get("price"),
      status: fd.get("status"),
      quantity: fd.get("quantity"),
      description: fd.get("description"),
      tags,
    });
  });
  form.querySelector(".btn--ghost").addEventListener("click", (e) => {
    e.preventDefault();
    onCancel();
  });
  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

export function renderLogin({ onSubmit, onGoRegister }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Login"]));
  const panel = el("div", { class: "panel" });
  const form = el("form");
  form.appendChild(
    el("div", { class: "field" }, [
      el("div", { class: "label" }, ["Username"]),
      el("input", { class: "input", name: "username", required: "true" }),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Password"]),
      el("input", { class: "input", type: "password", name: "password", required: "true" }),
    ])
  );
  form.appendChild(
    el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Login"]),
      el("button", { class: "btn btn--ghost", type: "button" }, ["Register"]),
    ])
  );
  form.querySelector('button[type="button"]').addEventListener("click", onGoRegister);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onSubmit({
      username: String(fd.get("username") || "").trim(),
      password: String(fd.get("password") || ""),
    });
  });
  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

export function renderRegister({ onSubmit, onGoLogin }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Register"]));
  const panel = el("div", { class: "panel" });
  const form = el("form");
  form.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Username"]),
        el("input", { class: "input", name: "username", required: "true" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Password"]),
        el("input", { class: "input", type: "password", name: "password", required: "true" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Role"]),
        el("select", { class: "select", name: "role", required: "true" }, [
          el("option", { value: "standard" }, ["Standard User"]),
          el("option", { value: "admin" }, ["Admin"]),
        ]),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Student ID (standard user)"]),
        el("input", { class: "input", name: "studentId" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Admin registration code (admin only)"]),
      el("input", { class: "input", name: "adminCode" }),
    ])
  );
  form.appendChild(
    el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Create account"]),
      el("button", { class: "btn btn--ghost", type: "button" }, ["Login"]),
    ])
  );
  form.querySelector('button[type="button"]').addEventListener("click", onGoLogin);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onSubmit({
      username: String(fd.get("username") || "").trim(),
      password: String(fd.get("password") || ""),
      role: String(fd.get("role") || "standard"),
      studentId: String(fd.get("studentId") || "").trim(),
      adminCode: String(fd.get("adminCode") || "").trim(),
    });
  });
  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

export function renderVerifyStudent({ onSubmit }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Admin: Verify Student ID"]));
  const panel = el("div", { class: "panel" });
  const form = el("form");
  form.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Username"]),
        el("input", { class: "input", name: "username", required: "true" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Set verification"]),
        el("select", { class: "select", name: "valid", required: "true" }, [
          el("option", { value: "true" }, ["Valid"]),
          el("option", { value: "false" }, ["Invalid"]),
        ]),
      ]),
    ])
  );
  form.appendChild(el("button", { class: "btn btn--primary", type: "submit", style: "margin-top:12px" }, ["Save verification"]));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onSubmit({
      username: String(fd.get("username") || "").trim(),
      valid: String(fd.get("valid")) === "true",
    });
  });
  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

export function renderVerifyQueue({ users, onVerify }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Admin: Pending Student Verification"]));

  if (!users.length) {
    root.appendChild(
      el("div", { class: "panel" }, [
        el("div", { class: "muted" }, ["No pending accounts right now."]),
      ])
    );
    return root;
  }

  const panel = el("div", { class: "panel" });
  users.forEach((u) => {
    const row = el("div", {
      style: "display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px dashed #e5e7eb;flex-wrap:wrap",
    });
    row.appendChild(
      el("div", {}, [
        el("div", { style: "font-weight:900" }, [u.username]),
        el("div", { class: "muted" }, [`Student ID: ${u.studentId || "-"}`]),
      ])
    );
    const actions = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" });
    const approve = el("button", { class: "btn btn--primary", type: "button" }, ["Approve"]);
    const reject = el("button", { class: "btn btn--danger", type: "button" }, ["Reject"]);
    approve.addEventListener("click", () => onVerify(u.username, true));
    reject.addEventListener("click", () => onVerify(u.username, false));
    actions.append(approve, reject);
    row.appendChild(actions);
    panel.appendChild(row);
  });
  root.appendChild(panel);
  return root;
}

