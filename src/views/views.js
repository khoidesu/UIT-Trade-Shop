import { currencyVND, el, formatStatus, clamp, renderContactRow } from "../lib/ui.js";
import { ALLOWED_CATEGORIES } from "../data/categories.js";

function toGoogleDriveImageUrl(inputUrl) {
  const raw = String(inputUrl || "").trim();
  if (!raw) return "";
  const lh3 = raw.match(/^https:\/\/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3?.[1]) return `https://lh3.googleusercontent.com/d/${lh3[1]}`;
  const fileMatch = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  const queryMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch?.[1]) return `https://lh3.googleusercontent.com/d/${queryMatch[1]}`;
  return raw;
}

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

function productCard(p, { onOpen, onAdd, onDelete, canAddToCart, canDelete, isOwner, addLabel }) {
  const card = el("article", { class: "card" });
  const cover = p.coverImageUrl || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : "") || "";
  const img = cover
    ? el("img", { class: "card__img card__img--photo", src: cover, alt: p.name, loading: "lazy" })
    : el("div", { class: "card__img" }, ["SHP"]);
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
  actions.append(viewBtn);
  if (!isOwner) {
    const addBtn = el("button", { class: "btn btn--primary", type: "button" }, [canAddToCart ? "Add" : (addLabel || "Login to buy")]);
    if (!canAddToCart) addBtn.disabled = true;
    addBtn.addEventListener("click", () => onAdd(p.id));
    actions.append(addBtn);
  }
  if (canDelete) {
    const delBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Delete"]);
    delBtn.addEventListener("click", () => onDelete(p.id));
    actions.appendChild(delBtn);
  }
  body.appendChild(actions);

  card.appendChild(body);
  return card;
}

export function renderHome({
  products,
  q,
  category,
  onOpen,
  onAdd,
  onDelete,
  canAddToCart,
  canDeleteProduct,
  isOwnerProduct,
  addToCartLabel,
  lostFoundPreview,
}) {
  const root = document.createDocumentFragment();
  if (lostFoundPreview) root.appendChild(lostFoundPreview);

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
        isOwner: typeof isOwnerProduct === "function" ? isOwnerProduct(p) : false,
        addLabel: addToCartLabel,
      })
    )
  );
  root.appendChild(grid);
  return root;
}

export function renderProduct({
  product,
  onAdd,
  onBack,
  canBuy,
  canDelete,
  onDelete,
  onViewSeller,
  isOwner,
  onEdit,
}) {
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
  const mediaBox = el("div", { class: "detail__mediaBox" });
  const imageUrls = Array.isArray(product.imageUrls) ? product.imageUrls.filter(Boolean).slice(0, 5) : [];
  let currentImage = imageUrls[0] || "";
  if (currentImage) {
    mediaBox.appendChild(
      el("img", {
        class: "detail__mainImage",
        src: currentImage,
        alt: product.name,
      })
    );
  } else {
    mediaBox.appendChild(document.createTextNode("SHP"));
  }
  const media = el("div", { class: "detail__media" }, [mediaBox]);
  if (imageUrls.length > 1) {
    const thumbs = el("div", { class: "detail__thumbs" });
    imageUrls.forEach((url) => {
      const thumb = el("img", {
        class: `detail__thumb ${url === currentImage ? "detail__thumb--active" : ""}`,
        src: url,
        alt: product.name,
        loading: "lazy",
      });
      thumb.addEventListener("click", () => {
        currentImage = url;
        mediaBox.replaceChildren(
          el("img", { class: "detail__mainImage", src: currentImage, alt: product.name })
        );
        thumbs.querySelectorAll(".detail__thumb").forEach((node) => {
          node.classList.toggle("detail__thumb--active", node === thumb);
        });
      });
      thumbs.appendChild(thumb);
    });
    media.appendChild(thumbs);
  }
  row.appendChild(media);
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
  if (!isOwner) {
    const addBtn = el("button", { class: "btn btn--primary", type: "button" }, [canBuy ? "Add to cart" : "Login/verify to buy"]);
    if (!canBuy) addBtn.disabled = true;
    addBtn.addEventListener("click", () => onAdd(qtyState.qty));
    const buyBtn = el("a", { class: "btn btn--ghost", href: "#/checkout" }, ["Go to checkout"]);
    actions.append(addBtn, buyBtn);
  }
  if (isOwner && typeof onEdit === "function") {
    const editBtn = el("button", { class: "btn btn--primary", type: "button" }, ["Edit product"]);
    editBtn.addEventListener("click", () => onEdit(product.id));
    actions.appendChild(editBtn);
  }
  if (canDelete) {
    const delBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Delete product"]);
    delBtn.addEventListener("click", () => onDelete(product.id));
    actions.appendChild(delBtn);
  }
  if (!isOwner && typeof onViewSeller === "function" && product.ownerUsername) {
    const sellerBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["View seller account"]);
    sellerBtn.addEventListener("click", () => onViewSeller(product.ownerUsername));
    actions.appendChild(sellerBtn);
  }
  content.appendChild(actions);

  row.appendChild(content);
  panel.appendChild(row);
  root.appendChild(panel);
  return root;
}

export function renderCheckout({ cartItems, subtotal, onSubmit, onOpenCart }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Thanh toán"]));

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

  const shippingBase = subtotal >= 999 ? 0 : 59;
  const serviceFee = Math.round(subtotal * 0.02);

  function computeShipping(isDirect) {
    if (isDirect) return 0;
    return shippingBase;
  }

  const left = el("div", { class: "panel" });
  left.appendChild(el("div", { class: "pageTitle" }, ["Delivery details"]));

  const form = el("form");
  form.appendChild(
    el("div", { class: "field" }, [
      el("div", { class: "label" }, ["Hình thức nhận hàng"]),
      el("div", { class: "checkoutDeliveryOpts" }, [
        el("label", { class: "checkoutDeliveryOpt" }, [
          el("input", { type: "radio", name: "deliveryType", value: "direct" }),
          document.createTextNode(" Giao dịch trực tiếp"),
        ]),
        el("label", { class: "checkoutDeliveryOpt" }, [
          el("input", { type: "radio", name: "deliveryType", value: "shipper", checked: "checked" }),
          document.createTextNode(" Giao hàng qua shipper"),
        ]),
      ]),
    ])
  );

  const directSection = el("div", { class: "checkoutSection checkoutSection--direct", hidden: true });
  directSection.appendChild(
    el("div", { class: "muted", style: "margin-bottom:10px" }, ["Thông tin giao dịch trực tiếp"])
  );
  directSection.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Họ và tên"]),
        el("input", {
          class: "input",
          name: "directName",
          "data-req-direct": "true",
          placeholder: "Nguyễn Văn A",
        }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["MSSV"]),
        el("input", { class: "input", name: "studentId", "data-req-direct": "true", placeholder: "Mã số sinh viên" }),
      ]),
    ])
  );
  directSection.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Ngày giao dịch"]),
        el("input", { class: "input", name: "transactionDate", type: "date", "data-req-direct": "true" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Địa điểm giao dịch"]),
        el("input", {
          class: "input",
          name: "transactionPlace",
          "data-req-direct": "true",
          placeholder: "VD: Sảnh thư viện Tầng 1",
        }),
      ]),
    ])
  );

  const shipperSection = el("div", { class: "checkoutSection checkoutSection--shipper" });
  shipperSection.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Họ và tên"]),
        el("input", {
          class: "input",
          name: "name",
          "data-req-shipper": "true",
          placeholder: "Nguyễn Văn A",
        }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Số điện thoại"]),
        el("input", {
          class: "input",
          name: "phone",
          "data-req-shipper": "true",
          placeholder: "09xx xxx xxx",
        }),
      ]),
    ])
  );
  shipperSection.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Địa chỉ nhận hàng"]),
      el("textarea", {
        class: "textarea",
        name: "address",
        "data-req-shipper": "true",
        placeholder: "Số nhà, đường, phường/xã, TP…",
      }),
    ])
  );
  shipperSection.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Phương thức thanh toán"]),
        el("select", { class: "select", name: "payment", "data-req-shipper": "true" }, [
          el("option", { value: "" }, ["— Chọn —"]),
          el("option", { value: "COD" }, ["Thanh toán khi nhận hàng (COD)"]),
          el("option", { value: "GCash (Mock)" }, ["GCash (Mock)"]),
          el("option", { value: "Card (Mock)" }, ["Thẻ (Mock)"]),
        ]),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Ghi chú (tuỳ chọn)"]),
        el("input", { class: "input", name: "note", placeholder: "VD: nhẹ tay khi giao" }),
      ]),
    ])
  );

  form.appendChild(directSection);
  form.appendChild(shipperSection);

  const submitRow = el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
    el("a", { class: "btn btn--ghost", href: "#/" }, ["Tiếp tục mua"]),
    el("button", { class: "btn btn--primary", type: "submit" }, ["Đặt hàng"]),
  ]);
  form.appendChild(submitRow);

  const shippingValueEl = el("span", {}, [""]);
  const totalValueEl = el("span", { class: "price", style: "font-size:18px" }, [""]);

  function syncDeliveryUi() {
    const checked = form.querySelector('input[name="deliveryType"]:checked');
    const mode = checked?.value === "direct" ? "direct" : "shipper";
    directSection.hidden = mode !== "direct";
    shipperSection.hidden = mode !== "shipper";
    form.querySelectorAll("[data-req-direct]").forEach((node) => {
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
        node.required = mode === "direct";
      }
    });
    form.querySelectorAll("[data-req-shipper]").forEach((node) => {
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
        node.required = mode === "shipper";
      }
    });
    const shipAmt = computeShipping(mode === "direct");
    const total = subtotal + shipAmt + serviceFee;
    if (mode === "direct") {
      shippingValueEl.textContent = "Không áp dụng (giao trực tiếp)";
    } else {
      shippingValueEl.textContent = shipAmt === 0 ? "Miễn phí" : currencyVND(shipAmt);
    }
    totalValueEl.textContent = currencyVND(total);
  }

  form.querySelectorAll('input[name="deliveryType"]').forEach((r) => {
    r.addEventListener("change", syncDeliveryUi);
  });
  syncDeliveryUi();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const deliveryType = String(fd.get("deliveryType") || "shipper").trim();
    const note = String(fd.get("note") || "").trim();

    if (deliveryType === "direct") {
      const name = String(fd.get("directName") || "").trim();
      const studentId = String(fd.get("studentId") || "").trim();
      const transactionDate = String(fd.get("transactionDate") || "").trim();
      const transactionPlace = String(fd.get("transactionPlace") || "").trim();
      if (!name || !studentId || !transactionDate || !transactionPlace) return;
      const shipAmt = 0;
      const total = subtotal + shipAmt + serviceFee;
      onSubmit({
        deliveryType: "direct",
        name,
        studentId,
        transactionDate,
        transactionPlace,
        note,
        total,
      });
      return;
    }

    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const address = String(fd.get("address") || "").trim();
    const payment = String(fd.get("payment") || "").trim();
    if (!name || !phone || !address || !payment) return;
    const shipAmt = computeShipping(false);
    const total = subtotal + shipAmt + serviceFee;
    onSubmit({
      deliveryType: "shipper",
      name,
      phone,
      address,
      payment,
      note,
      total,
    });
  });

  left.appendChild(form);

  const right = el("div", { class: "panel" });
  right.appendChild(el("div", { class: "pageTitle" }, ["Đơn hàng"]));

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
    el("div", { class: "muted" }, ["Tạm tính"]),
    el("div", { style: "font-weight:1000" }, [currencyVND(subtotal)]),
  ]));
  right.appendChild(el("div", { class: "summaryRow" }, [
    el("div", { class: "muted" }, ["Phí giao hàng"]),
    el("div", { style: "font-weight:1000" }, [shippingValueEl]),
  ]));
  right.appendChild(el("div", { class: "summaryRow" }, [
    el("div", { class: "muted" }, ["Phí dịch vụ"]),
    el("div", { style: "font-weight:1000" }, [currencyVND(serviceFee)]),
  ]));
  right.appendChild(el("div", { class: "summaryRow" }, [
    el("div", { style: "font-weight:1000" }, ["Tổng cộng"]),
    el("div", {}, [totalValueEl]),
  ]));
  right.appendChild(
    el("div", { class: "muted", style: "margin-top:10px" }, [
      "Demo học tập — không thanh toán thật.",
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

export function renderAdmin({
  onSubmit,
  onCancel,
  onError,
  initialData = null,
  title = "Admin: Add/Update Product",
  submitLabel = "Lưu",
}) {
  const data = initialData || {};
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, [title]));

  const panel = el("div", { class: "panel" });
  const form = el("form");
  form.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Name"]),
        el("input", { class: "input", name: "name", required: "true", placeholder: "Bluetooth Speaker", value: data.name || "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Brand"]),
        el("input", { class: "input", name: "brand", required: "true", placeholder: "SoundMax", value: data.brand || "" }),
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
        el("input", { class: "input", name: "price", type: "number", required: "true", placeholder: "899000", value: data.price ?? "" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Tình trạng (%)"]),
        el("input", { class: "input", name: "status", type: "number", min: "1", max: "99", required: "true", placeholder: "90", value: data.status ?? "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Số lượng muốn bán"]),
        el("input", { class: "input", name: "quantity", type: "number", required: "true", placeholder: "1", value: data.quantity ?? "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Mô tả"]),
        el("textarea", { class: "input", name: "description", required: "true", placeholder: "Mô tả sản phẩm...", rows: 3 }, [data.description || ""]),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Tags (phân cách bởi dấu phẩy)"]),
        el("input", { class: "input", name: "tags", placeholder: "tag1, tag2", value: Array.isArray(data.tags) ? data.tags.join(", ") : "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Hình ảnh 1 (bắt buộc)"]),
        el("input", { class: "input", name: "image1", type: "url", required: "true", placeholder: "https://...", value: Array.isArray(data.imageUrls) ? (data.imageUrls[0] || "") : "" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Hình ảnh 2"]),
        el("input", { class: "input", name: "image2", type: "url", placeholder: "https://...", value: Array.isArray(data.imageUrls) ? (data.imageUrls[1] || "") : "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Hình ảnh 3"]),
        el("input", { class: "input", name: "image3", type: "url", placeholder: "https://...", value: Array.isArray(data.imageUrls) ? (data.imageUrls[2] || "") : "" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Hình ảnh 4"]),
        el("input", { class: "input", name: "image4", type: "url", placeholder: "https://...", value: Array.isArray(data.imageUrls) ? (data.imageUrls[3] || "") : "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Hình ảnh 5"]),
        el("input", { class: "input", name: "image5", type: "url", placeholder: "https://...", value: Array.isArray(data.imageUrls) ? (data.imageUrls[4] || "") : "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { style: "margin-top:18px; display:flex; gap:10px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, [submitLabel]),
      el("button", { class: "btn btn--ghost", type: "button" }, ["Huỷ"]),
    ])
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const tags = String(fd.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean);
    const imageUrls = [1, 2, 3, 4, 5]
      .map((idx) => String(fd.get(`image${idx}`) || "").trim())
      .filter(Boolean);
    if (imageUrls.length < 1 || imageUrls.length > 5) {
      if (typeof onError === "function") onError("Vui lòng nhập từ 1 đến 5 hình ảnh");
      return;
    }
    onSubmit({
      name: fd.get("name"),
      brand: fd.get("brand"),
      category: fd.get("category"),
      price: fd.get("price"),
      status: fd.get("status"),
      quantity: fd.get("quantity"),
      description: fd.get("description"),
      tags,
      imageUrls: imageUrls.map((url) => toGoogleDriveImageUrl(url)),
    });
  });
  const categorySelect = form.querySelector('select[name="category"]');
  if (categorySelect && data.category) categorySelect.value = data.category;
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
        el("div", { class: "label" }, ["Họ và tên"]),
        el("input", { class: "input", name: "fullName", required: "true" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Ngày sinh"]),
        el("input", { class: "input", name: "dob", type: "date" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Gmail"]),
        el("input", { class: "input", name: "email", type: "email", required: "true" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Số điện thoại"]),
        el("input", { class: "input", name: "phone", required: "true" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Địa chỉ hiện tại"]),
      el("input", { class: "input", name: "address", required: "true" }),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Ảnh đại diện URL"]),
      el("input", { class: "input", name: "avatarUrl", type: "url", placeholder: "https://..." }),
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
      fullName: String(fd.get("fullName") || "").trim(),
      dob: String(fd.get("dob") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      address: String(fd.get("address") || "").trim(),
      avatarUrl: toGoogleDriveImageUrl(String(fd.get("avatarUrl") || "").trim()),
      role: String(fd.get("role") || "standard"),
      studentId: String(fd.get("studentId") || "").trim(),
      adminCode: String(fd.get("adminCode") || "").trim(),
    });
  });
  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

export function renderPostingGuide() {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Hướng dẫn đăng bài"]));
  const panel = el("div", { class: "panel" }, [
    el("div", { style: "font-weight:900" }, ["Các bước đăng sản phẩm"]),
    el("div", { class: "muted", style: "margin-top:8px" }, ["1) Đăng nhập tài khoản đã được xác thực MSSV."]),
    el("div", { class: "muted" }, ["2) Bấm nút Add trên thanh trên cùng."]),
    el("div", { class: "muted" }, ["3) Nhập đầy đủ thông tin sản phẩm, số lượng, mô tả, tags."]),
    el("div", { class: "muted" }, ["4) Nhập từ 1 đến 5 link ảnh. Hệ thống tự chuyển link Google Drive sang định dạng ảnh hiển thị."]),
    el("div", { class: "muted", style: "margin-top:10px" }, ["Ví dụ link Drive:"]),
    el("div", { class: "muted" }, ["https://drive.google.com/file/d/ID_ANH_CUA_BAN"]),
    el("div", { class: "muted" }, ["=> sẽ được chuyển thành:"]),
    el("div", { class: "muted" }, ["https://lh3.googleusercontent.com/d/ID_ANH_CUA_BAN"]),
    el("div", { class: "muted", style: "margin-top:10px" }, ["5) Ảnh đầu tiên sẽ là ảnh bìa ở trang chủ."]),
  ]);
  root.appendChild(panel);
  return root;
}

/**
 * Trang yêu cầu hoàn trả (form sẵn sàng gắn API sau).
 * onRequestRefund nhận { productInfo, driveLink }.
 */
export function renderReturnsRequest({ onRequestRefund }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Yêu cầu hoàn trả"]));
  const panel = el("div", { class: "panel" });
  panel.appendChild(
    el("div", { class: "muted", style: "margin-bottom:14px" }, [
      "Gửi thông tin sản phẩm và link Google Drive chứa ảnh + video bóc hàng làm bằng chứng. Nút gửi hiện chỉ xác nhận trên giao diện; API backend sẽ được bổ sung sau.",
    ])
  );

  const form = el("form");
  form.appendChild(
    el("div", { class: "field" }, [
      el("div", { class: "label" }, ["Thông tin sản phẩm"]),
      el("textarea", {
        class: "input",
        name: "productInfo",
        required: "true",
        rows: 5,
        placeholder:
          "VD: Tên sản phẩm, mã đơn hàng (nếu có), ngày mua, lý do hoàn trả, mô tả lỗi / tình trạng…",
      }),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:12px" }, [
      el("div", { class: "label" }, ["Link Google Drive (ảnh + video bóc sản phẩm)"]),
      el("input", {
        class: "input",
        name: "driveLink",
        type: "url",
        required: "true",
        placeholder: "https://drive.google.com/drive/folders/… hoặc link file",
      }),
    ])
  );
  form.appendChild(
    el("div", { class: "muted", style: "margin-top:10px;font-size:13px" }, [
      "Nên chia sẻ thư mục / file Drive ở chế độ “Anyone with the link can view” để bộ phận xử lý có thể xem.",
    ])
  );
  form.appendChild(
    el("div", { style: "margin-top:18px" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Yêu cầu hoàn trả"]),
    ])
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const productInfo = String(fd.get("productInfo") || "").trim();
    const driveLink = String(fd.get("driveLink") || "").trim();
    if (!productInfo || !driveLink) return;
    if (typeof onRequestRefund === "function") {
      onRequestRefund({ productInfo, driveLink });
    }
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

export function renderManageAccounts({ users, onDelete, onViewProfile }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Admin: Manage account"]));
  root.appendChild(
    el("div", { class: "muted", style: "margin-bottom:12px" }, [
      "All standard user accounts. Delete removes the user and their listed products.",
    ])
  );

  if (!users.length) {
    root.appendChild(
      el("div", { class: "panel" }, [
        el("div", { class: "muted" }, ["No standard accounts."]),
      ])
    );
    return root;
  }

  const panel = el("div", { class: "panel" });
  users.forEach((u) => {
    const row = el("div", {
      style:
        "display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px dashed #e5e7eb;flex-wrap:wrap",
    });
    const left = el("div", { style: "flex:1;min-width:200px" }, [
      el("div", { style: "font-weight:900" }, [u.username]),
      el("div", { class: "muted" }, [`${u.fullName || "—"} • ${u.email || "—"}`]),
      el("div", { class: "muted" }, [
        `Student ID: ${u.studentId || "—"} • Verified: ${u.studentVerified ? "yes" : "no"}`,
      ]),
      el("div", { class: "muted" }, [`Phone: ${u.phone || "—"} • Address: ${u.address || "—"}`]),
    ]);
    const actions = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center" });
    const viewBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["View profile"]);
    viewBtn.addEventListener("click", () => onViewProfile(u.username));
    const delBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Delete"]);
    delBtn.addEventListener("click", () => onDelete(u.username));
    actions.append(viewBtn, delBtn);
    row.append(left, actions);
    panel.appendChild(row);
  });
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

export function renderAccountProfile({ profile, title = "My account", onBack, onToast }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, [title]));
  const panel = el("div", { class: "panel" });
  const top = el("div", { class: "accountProfile__top" });
  if (profile.avatarUrl) {
    top.appendChild(el("img", { class: "accountProfile__avatar", src: profile.avatarUrl, alt: profile.username || "avatar" }));
  } else {
    top.appendChild(el("div", { class: "accountProfile__avatar accountProfile__avatar--fallback" }, ["👤"]));
  }
  top.appendChild(
    el("div", {}, [
      el("div", { style: "font-weight:1000;font-size:18px" }, [profile.fullName || profile.username || "-"]),
      el("div", { class: "muted" }, [`@${profile.username || "-"}`]),
      el("div", { class: "muted" }, [`Vai trò: ${profile.role || "-"}`]),
    ])
  );
  panel.appendChild(top);

  panel.appendChild(
    el("div", { class: "summaryRow" }, [
      el("div", { class: "muted" }, ["Ngày sinh"]),
      el("div", { style: "font-weight:800" }, [profile.dob || "-"]),
    ])
  );
  panel.appendChild(renderContactRow("Gmail", profile.email, "email", onToast));
  panel.appendChild(renderContactRow("Số điện thoại", profile.phone, "phone", onToast));
  panel.appendChild(
    el("div", { class: "summaryRow" }, [
      el("div", { class: "muted" }, ["Mã số sinh viên"]),
      el("div", { style: "font-weight:800" }, [profile.studentId || "-"]),
    ])
  );
  panel.appendChild(
    el("div", { class: "summaryRow" }, [
      el("div", { class: "muted" }, ["Địa chỉ hiện tại"]),
      el("div", { style: "font-weight:800" }, [profile.address || "-"]),
    ])
  );
  const backBtn = el("button", { class: "btn btn--ghost", type: "button", style: "margin-top:12px" }, ["Back"]);
  backBtn.addEventListener("click", onBack);
  panel.appendChild(backBtn);
  root.appendChild(panel);
  return root;
}

export function renderEditAccount({ profile, onSubmit, onCancel }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Edit my account"]));
  const panel = el("div", { class: "panel" });
  const form = el("form");

  form.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Họ và tên"]),
        el("input", { class: "input", name: "fullName", required: "true", value: profile.fullName || "" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Ngày sinh"]),
        el("input", { class: "input", name: "dob", type: "date", value: profile.dob || "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Gmail"]),
        el("input", { class: "input", name: "email", type: "email", required: "true", value: profile.email || "" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Số điện thoại"]),
        el("input", { class: "input", name: "phone", required: "true", value: profile.phone || "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Địa chỉ hiện tại"]),
      el("input", { class: "input", name: "address", required: "true", value: profile.address || "" }),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Ảnh đại diện URL"]),
      el("input", { class: "input", name: "avatarUrl", type: "url", value: profile.avatarUrl || "" }),
    ])
  );
  if (profile.role === "standard") {
    form.appendChild(
      el("div", { class: "field", style: "margin-top:10px" }, [
        el("div", { class: "label" }, ["Mã số sinh viên"]),
        el("input", { class: "input", name: "studentId", value: profile.studentId || "" }),
      ])
    );
  }
  form.appendChild(
    el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Lưu thay đổi"]),
      el("button", { class: "btn btn--ghost", type: "button" }, ["Huỷ"]),
    ])
  );
  form.querySelector('button[type="button"]').addEventListener("click", onCancel);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onSubmit({
      fullName: String(fd.get("fullName") || "").trim(),
      dob: String(fd.get("dob") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      address: String(fd.get("address") || "").trim(),
      avatarUrl: toGoogleDriveImageUrl(String(fd.get("avatarUrl") || "").trim()),
      studentId: String(fd.get("studentId") || "").trim(),
    });
  });
  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

function lostFoundTypeLabel(type) {
  return type === "find_owner" ? "Tìm chủ nhân" : "Tìm đồ thất lạc";
}

function lostFoundTypeShort(type) {
  return type === "find_owner" ? "Tìm chủ" : "Tìm đồ";
}

function truncateLostFoundName(s, max = 36) {
  const t = String(s || "").trim();
  if (!t) return "—";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function renderLostFoundPreviewStrip({ posts, onMore, onOpen }) {
  const wrap = el("section", { class: "lostFoundStrip" });
  wrap.appendChild(el("div", { class: "lostFoundStrip__head" }, [
    el("div", { class: "lostFoundStrip__title" }, ["Tìm đồ thất lạc"]),
  ]));
  const lines = el("div", { class: "lostFoundStrip__lines" });
  if (!posts || !posts.length) {
    lines.appendChild(el("div", { class: "muted lostFoundStrip__empty" }, ["Chưa có bài đăng nào."]));
  } else {
    posts.slice(0, 3).forEach((p) => {
      const row = el("button", { class: "lostFoundStrip__line", type: "button" });
      row.appendChild(el("span", { class: "lostFoundStrip__tag" }, [lostFoundTypeShort(p.type)]));
      row.appendChild(el("span", { class: "lostFoundStrip__name" }, [truncateLostFoundName(p.productName)]));
      row.addEventListener("click", () => onOpen(p.id));
      lines.appendChild(row);
    });
  }
  wrap.appendChild(lines);
  const foot = el("div", { class: "lostFoundStrip__more" });
  const more = el("button", { class: "btn btn--ghost", type: "button" }, ["Xem thêm"]);
  more.addEventListener("click", onMore);
  foot.appendChild(more);
  wrap.appendChild(foot);
  return wrap;
}

export function renderLostFoundListPage({ posts, onOpen, onBackHome }) {
  const root = el("div");
  const top = el("div", { class: "lostFoundPage__top" });
  const backBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["← Trang chủ"]);
  backBtn.addEventListener("click", onBackHome);
  top.appendChild(backBtn);
  top.appendChild(el("div", { class: "pageTitle lostFoundPage__title" }, ["Tìm đồ thất lạc"]));
  root.appendChild(top);
  if (!posts.length) {
    root.appendChild(
      el("div", { class: "panel" }, [el("div", { class: "muted" }, ["Không có bài đăng phù hợp."])])
    );
    return root;
  }
  const grid = el("div", { class: "lostFoundGrid" });
  posts.forEach((p) => {
    const imgUrl = Array.isArray(p.imageUrls) && p.imageUrls[0] ? p.imageUrls[0] : "";
    const card = el("article", { class: "lostFoundCard" });
    const imgBox = imgUrl
      ? el("img", { class: "lostFoundCard__img", src: imgUrl, alt: "", loading: "lazy" })
      : el("div", { class: "lostFoundCard__img lostFoundCard__img--ph" }, ["📷"]);
    card.appendChild(imgBox);
    card.appendChild(el("div", { class: "lostFoundCard__badge" }, [lostFoundTypeLabel(p.type)]));
    card.appendChild(el("div", { class: "lostFoundCard__name" }, [p.productName || "—"]));
    card.appendChild(el("div", { class: "muted lostFoundCard__meta" }, [p.authorUsername || ""]));
    card.style.cursor = "pointer";
    card.addEventListener("click", () => onOpen(p.id));
    grid.appendChild(card);
  });
  root.appendChild(grid);
  return root;
}

export function renderLostFoundDetail({ post, onBack, onToast, canDelete, onDelete }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, [lostFoundTypeLabel(post.type)]));
  const panel = el("div", { class: "panel" });
  const imgs = Array.isArray(post.imageUrls) ? post.imageUrls.filter(Boolean) : [];
  if (imgs.length) {
    const row = el("div", { class: "lostFoundDetail__images" });
    imgs.forEach((u) => row.appendChild(el("img", { class: "lostFoundDetail__img", src: u, alt: "", loading: "lazy" })));
    panel.appendChild(row);
  }
  panel.appendChild(el("div", { style: "font-weight:900;font-size:18px;margin-top:8px" }, [post.productName || "—"]));
  panel.appendChild(el("div", { class: "muted" }, [`@${post.authorUsername} • ${post.createdAt || ""}`]));
  if (post.type === "find_owner") {
    panel.appendChild(
      el("div", { class: "summaryRow" }, [
        el("div", { class: "muted" }, ["Vị trí nhặt được"]),
        el("div", { style: "font-weight:800" }, [post.foundLocation || "-"]),
      ])
    );
  } else {
    if (post.description) {
      panel.appendChild(el("div", { style: "margin-top:10px" }, [post.description]));
    }
    panel.appendChild(
      el("div", { class: "summaryRow" }, [
        el("div", { class: "muted" }, ["Ngày mất"]),
        el("div", { style: "font-weight:800" }, [post.lostDate || "—"]),
      ])
    );
    panel.appendChild(
      el("div", { class: "summaryRow" }, [
        el("div", { class: "muted" }, ["Nơi mất"]),
        el("div", { style: "font-weight:800" }, [post.lostPlace || "—"]),
      ])
    );
  }
  panel.appendChild(el("div", { style: "margin-top:14px;font-weight:900" }, ["Liên hệ"]));
  panel.appendChild(renderContactRow("Họ tên", post.fullName, "text", onToast));
  panel.appendChild(renderContactRow("Gmail", post.email, "email", onToast));
  panel.appendChild(renderContactRow("Số điện thoại", post.phone, "phone", onToast));
  panel.appendChild(renderContactRow("MSSV", post.studentId, "text", onToast));
  panel.appendChild(renderContactRow("Địa chỉ", post.address, "text", onToast));
  const actions = el("div", { style: "display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; align-items:center" });
  if (canDelete && typeof onDelete === "function") {
    const delBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Xóa bài"]);
    delBtn.addEventListener("click", onDelete);
    actions.appendChild(delBtn);
  }
  const back = el("button", { class: "btn btn--ghost", type: "button" }, ["Quay lại"]);
  back.addEventListener("click", onBack);
  actions.appendChild(back);
  panel.appendChild(actions);
  root.appendChild(panel);
  return root;
}

export function renderLostFoundNewForm({ profile, onSubmit, onCancel, onError }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Đăng bài tìm đồ thất lạc"]));
  const panel = el("div", { class: "panel" });
  const form = el("form");

  form.appendChild(
    el("div", { class: "field" }, [
      el("div", { class: "label" }, ["Loại bài"]),
      el(
        "select",
        { class: "select", name: "postType", required: "true" },
        [
          el("option", { value: "find_item" }, ["Tìm đồ thất lạc"]),
          el("option", { value: "find_owner" }, ["Tìm chủ nhân món đồ (nhặt được)"]),
        ]
      ),
    ])
  );

  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Tên món đồ / sản phẩm"]),
      el("input", { class: "input", name: "productName", required: "true", placeholder: "VD: AirPods, thẻ SV…" }),
    ])
  );

  const findOwnerOnly = el("div", { class: "lostFoundForm__section" });
  findOwnerOnly.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Vị trí nhặt được"]),
      el("input", { class: "input", name: "foundLocation", placeholder: "VD: Hội trường B" }),
    ])
  );

  const findItemOnly = el("div", { class: "lostFoundForm__section" });
  findItemOnly.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Mô tả thêm (tuỳ chọn)"]),
      el("textarea", { class: "input", name: "description", rows: 3, placeholder: "Màu sắc, đặc điểm…" }),
    ])
  );
  findItemOnly.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Ngày mất (tuỳ chọn)"]),
        el("input", { class: "input", name: "lostDate", type: "date" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Nơi mất (tuỳ chọn)"]),
        el("input", { class: "input", name: "lostPlace", placeholder: "VD: Thư viện" }),
      ]),
    ])
  );

  form.appendChild(findOwnerOnly);
  form.appendChild(findItemOnly);

  form.appendChild(
    el("div", { style: "margin-top:14px;font-weight:900" }, ["Thông tin liên hệ (như tài khoản)"])
  );
  form.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Họ và tên"]),
        el("input", { class: "input", name: "fullName", required: "true", value: profile.fullName || "" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Ngày sinh"]),
        el("input", { class: "input", name: "dob", type: "date", value: profile.dob || "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Gmail"]),
        el("input", { class: "input", name: "email", type: "email", required: "true", value: profile.email || "" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Số điện thoại"]),
        el("input", { class: "input", name: "phone", required: "true", value: profile.phone || "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Địa chỉ hiện tại"]),
      el("input", { class: "input", name: "address", required: "true", value: profile.address || "" }),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Mã số sinh viên"]),
      el("input", { class: "input", name: "studentId", value: profile.studentId || "" }),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Ảnh đại diện URL (tuỳ chọn)"]),
      el("input", { class: "input", name: "avatarUrl", type: "url", value: profile.avatarUrl || "" }),
    ])
  );

  form.appendChild(el("div", { style: "margin-top:14px;font-weight:900" }, ["Hình ảnh (1–3, link Drive như đăng sản phẩm)"]));
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Ảnh 1"]),
        el("input", { class: "input", name: "image1", type: "url", placeholder: "https://..." }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Ảnh 2"]),
        el("input", { class: "input", name: "image2", type: "url", placeholder: "https://..." }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Ảnh 3"]),
      el("input", { class: "input", name: "image3", type: "url", placeholder: "https://..." }),
    ])
  );

  form.appendChild(
    el("div", { style: "display:flex; gap:10px; margin-top:16px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Đăng bài"]),
      el("button", { class: "btn btn--ghost", type: "button" }, ["Huỷ"]),
    ])
  );

  const typeSelect = form.querySelector('select[name="postType"]');
  const syncSections = () => {
    const t = typeSelect.value;
    findOwnerOnly.hidden = t !== "find_owner";
    findItemOnly.hidden = t !== "find_item";
    const loc = form.querySelector('input[name="foundLocation"]');
    if (loc) loc.required = t === "find_owner";
  };
  typeSelect.addEventListener("change", syncSections);
  syncSections();

  form.querySelector('button[type="button"]').addEventListener("click", onCancel);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const postType = String(fd.get("postType") || "").trim();
    const imageUrls = [1, 2, 3]
      .map((i) => toGoogleDriveImageUrl(String(fd.get(`image${i}`) || "").trim()))
      .filter(Boolean);
    if (imageUrls.length < 1 || imageUrls.length > 3) {
      if (typeof onError === "function") onError("Cần từ 1 đến 3 ảnh (link hợp lệ).");
      return;
    }
    const base = {
      type: postType,
      productName: String(fd.get("productName") || "").trim(),
      fullName: String(fd.get("fullName") || "").trim(),
      dob: String(fd.get("dob") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      address: String(fd.get("address") || "").trim(),
      studentId: String(fd.get("studentId") || "").trim(),
      avatarUrl: toGoogleDriveImageUrl(String(fd.get("avatarUrl") || "").trim()),
      imageUrls,
    };
    if (postType === "find_owner") {
      onSubmit({
        ...base,
        foundLocation: String(fd.get("foundLocation") || "").trim(),
      });
    } else {
      onSubmit({
        ...base,
        description: String(fd.get("description") || "").trim(),
        lostDate: String(fd.get("lostDate") || "").trim(),
        lostPlace: String(fd.get("lostPlace") || "").trim(),
      });
    }
  });

  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

