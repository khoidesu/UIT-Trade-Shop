import { currencyVND, el, formatStatus, clamp, renderContactRow } from "../lib/ui.js";
import { userInitials, initialsFromUsername } from "../lib/avatar.js";
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
      : "Chọn hôm nay";
  const subtitle = `${count} sản phẩm${count === 1 ? "" : "s"} • mock storefront`;

  return el("div", { class: "hero" }, [
    el("div", {}, [
      el("div", { class: "hero__title" }, [title]),
      el("div", { class: "hero__subtitle muted" }, [subtitle]),
    ]),
    el("a", { class: "btn btn--primary", href: "#/checkout" }, ["Đi đến thanh toán"]),
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
  const viewBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Xem"]);
  viewBtn.addEventListener("click", () => onOpen(p.id));
  actions.append(viewBtn);
  if (!isOwner) {
    const addBtn = el("button", { class: "btn btn--primary", type: "button" }, [canAddToCart ? "Thêm" : (addLabel || "Đăng nhập để mua")]);
    if (!canAddToCart) addBtn.disabled = true;
    addBtn.addEventListener("click", () => onAdd(p.id));
    actions.append(addBtn);
  }
  if (canDelete) {
    const delBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Xóa"]);
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
  onBuyNow,
  onBack,
  canBuy,
  canDelete,
  onDelete,
  onViewSeller,
  isOwner,
  onEdit,
  onReport,
  onChat,
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
    el("div", { class: "pageTitle" }, ["Sản phẩm"])
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
      el("button", { class: "btn btn--ghost", type: "button" }, ["Quay lại"]),
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
  qty.append(el("span", { class: "muted", style: "font-weight:900" }, ["Số lượng:"]), minus, qtyText, plus);
  content.appendChild(qty);

  const actions = el("div", { style: "display:flex; gap:10px; margin-top:6px; flex-wrap:wrap" });
  if (!isOwner) {
    const addBtn = el("button", { class: "btn btn--primary", type: "button" }, [canBuy ? "Thêm vào giỏ" : "Đăng nhập để mua"]);
    if (!canBuy) addBtn.disabled = true;
    addBtn.addEventListener("click", () => onAdd(qtyState.qty));
    const buyBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Mua ngay"]);
    if (!canBuy) buyBtn.disabled = true;
    buyBtn.addEventListener("click", () => {
      if (typeof onBuyNow === "function") onBuyNow(qtyState.qty);
    });
    actions.append(addBtn, buyBtn);
  }
  if (isOwner && typeof onEdit === "function") {
    const editBtn = el("button", { class: "btn btn--primary", type: "button" }, ["Chỉnh sửa sản phẩm"]);
    editBtn.addEventListener("click", () => onEdit(product.id));
    actions.appendChild(editBtn);
  }
  if (canDelete) {
    const delBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Xóa sản phẩm"]);
    delBtn.addEventListener("click", () => onDelete(product.id));
    actions.appendChild(delBtn);
  }
  if (!isOwner && typeof onViewSeller === "function" && product.ownerUsername) {
    const sellerBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Xem tài khoản người bán"]);
    sellerBtn.addEventListener("click", () => onViewSeller(product.ownerUsername));
    actions.appendChild(sellerBtn);
  }
  if (!isOwner && typeof onChat === "function" && product.ownerUsername) {
    const chatBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Nhắn tin cho người bán"]);
    chatBtn.addEventListener("click", () => onChat(product.ownerUsername));
    actions.appendChild(chatBtn);
  }
  if (!isOwner && typeof onReport === "function") {
    const reportBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Báo cáo"]);
    reportBtn.addEventListener("click", () => onReport(product.id));
    actions.appendChild(reportBtn);
  }
  content.appendChild(actions);

  row.appendChild(content);
  panel.appendChild(row);
  root.appendChild(panel);
  return root;
}

export function renderCheckout({ cartItems, subtotal, onSubmit, onOpenCart, onValidateDiscount, onLoadSellerPaymentQrs }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Thanh toán"]));

  if (!cartItems.length) {
    root.appendChild(
      el("div", { class: "panel" }, [
        el("div", { class: "pageTitle" }, ["Giỏ hàng trống"]),
        el("div", { class: "muted" }, ["Thêm ít nhất một sản phẩm để thanh toán."]),
        el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
          el("a", { class: "btn btn--primary", href: "#/" }, ["Xem sản phẩm"]),
          el("button", { class: "btn btn--ghost", type: "button" }, ["Mở giỏ hàng"]),
        ]),
      ])
    );
    root.querySelector("button").addEventListener("click", () => onOpenCart());
    return root;
  }

  const discountState = { code: "", discountAmount: 0 };
  const sellerTotalsMap = cartItems.reduce((acc, it) => {
    const seller = String(it?.product?.ownerUsername || "").trim();
    if (!seller) return acc;
    acc[seller] = Number(acc[seller] || 0) + Number(it?.lineTotal || 0);
    return acc;
  }, {});

  function splitDiscountAcrossSellers(subtotalsBySeller, discountAmount) {
    const sellers = Object.entries(subtotalsBySeller || {})
      .map(([u, v]) => [u, Number(v || 0)])
      .filter(([u, v]) => u && v > 0);
    if (!sellers.length || discountAmount <= 0) {
      return Object.fromEntries(sellers.map(([u]) => [u, 0]));
    }
    const totalSub = sellers.reduce((s, [, v]) => s + v, 0);
    let remaining = Math.max(0, Math.min(Number(discountAmount || 0), totalSub));
    const base = Math.floor(remaining / sellers.length);
    const rem = remaining % sellers.length;
    const ranked = [...sellers].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return String(a[0]).localeCompare(String(b[0]));
    });
    const alloc = Object.fromEntries(sellers.map(([u]) => [u, 0]));
    ranked.forEach(([u], idx) => {
      alloc[u] = base + (idx < rem ? 1 : 0);
    });

    let overflow = 0;
    sellers.forEach(([u, sub]) => {
      if (alloc[u] > sub) {
        overflow += alloc[u] - sub;
        alloc[u] = sub;
      }
    });

    while (overflow > 0) {
      let moved = 0;
      for (const [u, sub] of ranked) {
        const room = sub - alloc[u];
        if (room <= 0) continue;
        const take = Math.min(room, overflow);
        alloc[u] += take;
        overflow -= take;
        moved += take;
        if (overflow <= 0) break;
      }
      if (moved <= 0) break;
    }
    return alloc;
  }

  const left = el("div", { class: "panel" });
  left.appendChild(el("div", { class: "pageTitle" }, ["Thông tin giao hàng"]));

  const form = el("form");
  form.appendChild(
    el("div", { class: "field" }, [
      el("div", { class: "label" }, ["Hình thức thanh toán"]),
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

  const bankSection = el("div", { class: "checkoutSection checkoutSection--bank" });
  bankSection.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Họ và tên"]),
        el("input", {
          class: "input",
          name: "name",
          "data-req-bank": "true",
          placeholder: "Nguyễn Văn A",
        }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Số điện thoại"]),
        el("input", {
          class: "input",
          name: "phone",
          "data-req-bank": "true",
          placeholder: "09xx xxx xxx",
        }),
      ]),
    ])
  );
  bankSection.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Địa chỉ giao/nhận"]),
      el("textarea", {
        class: "textarea",
        name: "address",
        "data-req-bank": "true",
        placeholder: "Số nhà, đường, phường/xã, TP…",
      }),
    ])
  );
  bankSection.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Thanh toán qua shipper"]),
      el("select", { class: "select", name: "payment", "data-req-bank": "true" }, [
        el("option", { value: "COD" }, ["COD (shipper thu tiền)"]),
        el("option", { value: "BANK_QR" }, ["Chuyển khoản QR"]),
      ]),
    ])
  );
  bankSection.appendChild(
    el("div", { class: "field", style: "margin-top:10px", id: "checkoutQrSection" }, [
      el("div", { class: "label" }, ["QR thanh toán của người bán"]),
      el("div", { class: "muted", style: "font-size:13px;margin-bottom:8px" }, [
        "Nếu giỏ có nhiều người bán, mỗi mã QR sẽ hiển thị theo từng người bán.",
      ]),
      el("div", { class: "checkoutSellerQrList", id: "checkoutSellerQrList" }),
    ])
  );
  bankSection.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Ghi chú (tuỳ chọn)"]),
      el("input", { class: "input", name: "note", placeholder: "VD: đã chuyển khoản lúc 09:30" }),
    ])
  );

  form.appendChild(directSection);
  form.appendChild(bankSection);

  const submitRow = el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
    el("a", { class: "btn btn--ghost", href: "#/" }, ["Tiếp tục mua"]),
    el("button", { class: "btn btn--primary", type: "submit" }, ["Đặt hàng"]),
  ]);
  form.appendChild(submitRow);

  const discountValueEl = el("span", {}, ["0đ"]);
  const discountDisplayEl = el("span", { style: "font-weight:1000;color:#15803d" }, ["- 0đ"]);
  const totalValueEl = el("span", { class: "price", style: "font-size:18px" }, [""]);
  const discountMsgEl = el("div", { class: "muted", style: "font-size:13px;margin-top:8px" }, [""]);
  const discountCodeInput = el("input", {
    class: "input",
    name: "discountCode",
    placeholder: "Nhập mã giảm giá",
    style: "text-transform:uppercase",
  });
  const applyDiscountBtn = el("button", { class: "btn btn--primary", type: "button" }, ["Xác nhận mã"]);
  const sellerPayBreakdownWrap = el("div", { class: "field", style: "margin-top:12px", hidden: "true" }, [
    el("div", { class: "label" }, ["Số tiền chuyển cho từng người bán (sau giảm giá)"]),
    el("div", { id: "sellerPayBreakdownList" }),
  ]);
  const sellerPayBreakdownList = sellerPayBreakdownWrap.querySelector("#sellerPayBreakdownList");
  const sellerQrWrap = form.querySelector("#checkoutSellerQrList");
  let qrLoaded = false;

  const loadSellerQrs = () => {
    if (!sellerQrWrap || typeof onLoadSellerPaymentQrs !== "function") return;
    sellerQrWrap.replaceChildren(el("div", { class: "muted" }, ["Đang tải mã QR người bán..."]));
    Promise.resolve(onLoadSellerPaymentQrs())
      .then((items) => {
        sellerQrWrap.replaceChildren();
        if (!Array.isArray(items) || !items.length) {
          sellerQrWrap.appendChild(el("div", { class: "muted" }, ["Không có mã QR nào từ người bán trong giỏ hàng."]));
          return;
        }
        items.forEach((it) => {
          const box = el("div", { class: "panel", style: "padding:10px;margin-bottom:8px" }, [
            el("div", { style: "font-weight:800;margin-bottom:6px" }, [`Người bán: ${it.username}`]),
          ]);
          if (it.qrUrl) {
            box.appendChild(el("img", {
              src: it.qrUrl,
              alt: `QR ${it.username}`,
              style: "width:180px;max-width:100%;border-radius:8px;border:1px solid var(--line)",
            }));
          } else {
            box.appendChild(el("div", { class: "muted" }, ["Người bán chưa cập nhật mã QR thanh toán."]));
          }
          sellerQrWrap.appendChild(box);
        });
      })
      .catch(() => {
        sellerQrWrap.replaceChildren(el("div", { class: "muted" }, ["Không thể tải mã QR người bán."]));
      });
  };

  function syncDeliveryUi() {
    const checked = form.querySelector('input[name="deliveryType"]:checked');
    const mode = checked?.value === "direct" ? "direct" : "shipper";
    directSection.hidden = mode !== "direct";
    bankSection.hidden = mode !== "shipper";
    form.querySelectorAll("[data-req-direct]").forEach((node) => {
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
        node.required = mode === "direct";
      }
    });
    form.querySelectorAll("[data-req-bank]").forEach((node) => {
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
        node.required = mode === "shipper";
      }
    });
    const paymentSel = form.querySelector('select[name="payment"]');
    const qrSection = form.querySelector("#checkoutQrSection");
    const isQrPayment = mode === "shipper" && String(paymentSel?.value || "COD") === "BANK_QR";
    if (qrSection) qrSection.hidden = !isQrPayment;
    if (sellerQrWrap) {
      if (isQrPayment) {
        if (!qrLoaded) {
          qrLoaded = true;
          loadSellerQrs();
        }
      } else {
        sellerQrWrap.replaceChildren();
      }
    }
    const total = Math.max(0, subtotal - discountState.discountAmount);
    discountValueEl.textContent = currencyVND(discountState.discountAmount);
    discountDisplayEl.textContent = `- ${discountValueEl.textContent}`;
    totalValueEl.textContent = currencyVND(total);

    const sellers = Object.keys(sellerTotalsMap);
    const shouldShowSplit = isQrPayment && sellers.length > 1 && discountState.discountAmount > 0;
    if (sellerPayBreakdownWrap) {
      if (!shouldShowSplit) {
        sellerPayBreakdownWrap.setAttribute("hidden", "");
        if (sellerPayBreakdownList) sellerPayBreakdownList.replaceChildren();
      } else {
        sellerPayBreakdownWrap.removeAttribute("hidden");
        const sellerDiscounts = splitDiscountAcrossSellers(sellerTotalsMap, discountState.discountAmount);
        if (sellerPayBreakdownList) {
          sellerPayBreakdownList.replaceChildren();
          sellers
            .sort((a, b) => Number(sellerTotalsMap[b] || 0) - Number(sellerTotalsMap[a] || 0))
            .forEach((seller) => {
              const sub = Number(sellerTotalsMap[seller] || 0);
              const dis = Number(sellerDiscounts[seller] || 0);
              const pay = Math.max(0, sub - dis);
              sellerPayBreakdownList.appendChild(
                el("div", { class: "summaryRow" }, [
                  el("div", {}, [
                    el("div", { style: "font-weight:800" }, [seller]),
                    el("div", { class: "muted", style: "font-size:12px" }, [`Tổng: ${currencyVND(sub)} • Giảm: ${currencyVND(dis)}`]),
                  ]),
                  el("div", { class: "price", style: "font-size:15px" }, [currencyVND(pay)]),
                ])
              );
            });
        }
      }
    }
  }

  form.querySelectorAll('input[name="deliveryType"]').forEach((r) => {
    r.addEventListener("change", syncDeliveryUi);
  });
  const paymentSelect = form.querySelector('select[name="payment"]');
  if (paymentSelect) paymentSelect.addEventListener("change", syncDeliveryUi);
  applyDiscountBtn.addEventListener("click", async () => {
    const code = String(discountCodeInput.value || "").trim().toUpperCase();
    if (!code) {
      discountState.code = "";
      discountState.discountAmount = 0;
      discountMsgEl.textContent = "Đã bỏ mã giảm giá.";
      syncDeliveryUi();
      return;
    }
    if (typeof onValidateDiscount !== "function") return;
    applyDiscountBtn.disabled = true;
    try {
      const data = await onValidateDiscount({ code, subtotal });
      discountState.code = code;
      discountState.discountAmount = Number(data?.discountAmount || 0);
      discountMsgEl.textContent = `Mã hợp lệ. Giảm ${currencyVND(discountState.discountAmount)}.`;
      syncDeliveryUi();
    } catch (err) {
      discountState.code = "";
      discountState.discountAmount = 0;
      discountMsgEl.textContent = String(err?.message || "Mã giảm giá không hợp lệ.");
      syncDeliveryUi();
    } finally {
      applyDiscountBtn.disabled = false;
    }
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
      const total = Math.max(0, subtotal - discountState.discountAmount);
      onSubmit({
        deliveryType: "direct",
        name,
        studentId,
        transactionDate,
        transactionPlace,
        note,
        discountCode: discountState.code,
        discountAmount: discountState.discountAmount,
        total,
      });
      return;
    }

    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const address = String(fd.get("address") || "").trim();
    if (!name || !phone || !address) return;
    const total = Math.max(0, subtotal - discountState.discountAmount);
    onSubmit({
      deliveryType: "shipper",
      name,
      phone,
      address,
      payment: String(fd.get("payment") || "COD").trim(),
      note,
      discountCode: discountState.code,
      discountAmount: discountState.discountAmount,
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
          el("div", { class: "muted" }, [`Mã SP: ${it.product.id} • Slg: ${it.qty}`]),
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
    el("div", { class: "muted" }, ["Mã giảm giá"]),
    discountDisplayEl,
  ]));
  right.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Nhập mã giảm giá"]),
      el("div", { style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" }, [discountCodeInput, applyDiscountBtn]),
      discountMsgEl,
    ])
  );
  right.appendChild(sellerPayBreakdownWrap);
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
        el("div", { class: "label" }, ["Tên sản phẩm"]),
        el("input", { class: "input", name: "name", required: "true", placeholder: "CTDL&GT Lê Minh Hoàng", value: data.name || "" }),
      ]),
    ])
  );
  form.appendChild(
    el("div", { class: "formRow", style: "margin-top:10px" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Hãng"]),
        el("input", { class: "input", name: "brand", required: "true", placeholder: "Lê Minh Hoàng", value: data.brand || "" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Danh mục"]),
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
      el("div", { class: "label" }, ["Email, SĐT hoặc MSSV"]),
      el("input", { class: "input", name: "username", required: "true" }),
    ])
  );
  const passwordField = renderPasswordField({ name: "password", placeholder: "" });
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Password"]),
      passwordField,
    ])
  );
  form.appendChild(
    el("div", { style: "margin-top:8px; text-align:right" }, [
      el("a", { href: "#/forgot-password", style: "font-size:12px; color:var(--primary)" }, ["Quên mật khẩu?"]),
    ])
  );
  const registerBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Register"]);
  form.appendChild(
    el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Login"]),
      registerBtn,
    ])
  );
  registerBtn.addEventListener("click", onGoRegister);
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

export function renderForgotPassword({ onSubmit, onBack }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Quên mật khẩu"]));
  const panel = el("div", { class: "panel" });
  const form = el("form");
  form.appendChild(
    el("div", { class: "field" }, [
      el("div", { class: "label" }, ["Nhập email của bạn"]),
      el("input", { class: "input", name: "email", type: "email", required: "true" }),
    ])
  );
  const backBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Quay lại"]);
  form.appendChild(
    el("div", { style: "display:flex; gap:10px; margin-top:16px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Gửi mã"]),
      backBtn,
    ])
  );
  backBtn.addEventListener("click", onBack);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim();
    if (email) onSubmit(email);
  });
  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

export function renderResetPassword({ email, onSubmit, onBack }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Đặt lại mật khẩu"]));
  const panel = el("div", { class: "panel" });
  const form = el("form");
  form.appendChild(el("p", { style: "font-size:14px; margin-bottom:12px" }, [`Email: ${email}`]));
  form.appendChild(
    el("div", { class: "field" }, [
      el("div", { class: "label" }, ["Mã xác minh (6 ký tự)"]),
      el("input", { class: "input", name: "code", required: "true" }),
    ])
  );
  const passwordField = renderPasswordField({ name: "newPassword", placeholder: "" });
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Mật khẩu mới"]),
      passwordField,
    ])
  );
  const cancelBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Hủy"]);
  form.appendChild(
    el("div", { style: "display:flex; gap:10px; margin-top:16px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Đổi mật khẩu"]),
      cancelBtn,
    ])
  );
  cancelBtn.addEventListener("click", onBack);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onSubmit({
      email,
      code: String(fd.get("code") || "").trim(),
      newPassword: String(fd.get("newPassword") || "").trim(),
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
  const passwordField = renderPasswordField({ name: "password", placeholder: "" });
  form.appendChild(
    el("div", { class: "formRow" }, [
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Username"]),
        el("input", { class: "input", name: "username", required: "true" }),
      ]),
      el("div", { class: "field" }, [
        el("div", { class: "label" }, ["Password"]),
        passwordField,
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
      el("div", { class: "label" }, ["Ảnh chụp chính"]),
      el("input", { class: "input", name: "avatarUrl", type: "url", placeholder: "https://..." }),
    ])
  );
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Mã QR thanh toán (Drive link)"]),
      el("input", { class: "input", name: "paymentQrUrl", type: "url", placeholder: "https://..." }),
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
  const loginBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Login"]);
  form.appendChild(
    el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--primary", type: "submit" }, ["Create account"]),
      loginBtn,
    ])
  );
  loginBtn.addEventListener("click", onGoLogin);
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
      paymentQrUrl: toGoogleDriveImageUrl(String(fd.get("paymentQrUrl") || "").trim()),
      role: String(fd.get("role") || "standard"),
      studentId: String(fd.get("studentId") || "").trim(),
      adminCode: String(fd.get("adminCode") || "").trim(),
    });
  });
  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

// helper tạo element
function elll(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  for (let key in attrs) {
    element.setAttribute(key, attrs[key]);
  }

  children.forEach(child => {
    if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });

  return element;
}

// 🔥 reusable function tạo 1 block hướng dẫn
function createGuideSection(title, steps) {
  return elll("div", { class: "guide-section" }, [
    elll("div", { class: "panel-title", style: "font-weight:900" }, ["📌 " + title]),
    elll("ol", { class: "guide-list" },
      steps.map(step => elll("li", { class: "muted", style: "margin-top:4px" }, [step]))
    )
  ]);
}

// main render
export function renderPostingGuide() {
  const root = elll("div");

  root.appendChild(
    elll("div", { class: "pageTitle" }, ["Hướng dẫn sử dụng & Đăng bài"])
  );

  const panel = elll("div", { class: "panel" }, [
    createGuideSection("Các bước đăng sản phẩm", [
      "Đăng nhập tài khoản đã được xác thực MSSV.",
      "Bấm nút Add ở góc phải trên cùng (hoặc trên thanh trên cùng).",
      "Nhập đầy đủ thông tin (Tên sản phẩm, Hãng, Phân loại, Giá tiền, Tình trạng, Số lượng, Mô tả, Tags).",
      "Nhập từ 1 đến 5 link ảnh (Google Drive). Hệ thống tự chuyển link Google Drive sang định dạng ảnh hiển thị.",
      "Ảnh đầu tiên sẽ tự động được chọn làm ảnh bìa ở trang chủ.",
      "Kiểm tra lại toàn bộ thông tin trước khi gửi.",
      "Nhấn nút \"Lưu\" để hoàn tất."
    ]),

    elll("div", { class: "note-box", style: "margin: 10px 0 20px 20px; padding: 10px; background: #f4f4f4; border-radius: 5px;" }, [
      elll("div", { class: "muted", style: "margin-bottom: 5px;" }, ["💡 Ví dụ chuyển đổi link Drive:"]),
      elll("div", { class: "muted" }, ["• Bạn nhập: https://drive.google.com/file/d/ID_ANH_CUA_BAN"]),
      elll("div", { class: "muted" }, ["• => Sẽ được chuyển thành: https://lh3.googleusercontent.com/d/ID_ANH_CUA_BAN"])
    ]),

    createGuideSection("Đăng bài tìm đồ thất lạc", [
      "Chọn loại bài \"Tìm đồ thất lạc\".",
      "Nhập tên món đồ bị mất (ví dụ: AirPods, thẻ sinh viên...).",
      "Mô tả chi tiết đặc điểm nhận dạng (màu sắc, hình dáng, vị trí mất...).",
      "Nhập ngày mất và nơi mất nếu có (cả hai đều không bắt buộc).",
      "Điền đầy đủ thông tin liên hệ (Họ tên, Ngày sinh, Gmail, SĐT, Địa chỉ, MSSV).",
      "Thêm ảnh món đồ bằng link Google Drive (nếu có).",
      "Kiểm tra lại thông tin.",
      "Nhấn nút \"Đăng bài\" để hoàn tất."
    ]),

    createGuideSection("Thanh toán", [
      "Chọn hình thức nhận hàng (trực tiếp hoặc qua shipper).",
      "Nhập họ tên và số điện thoại người nhận.",
      "Nhập địa chỉ nhận hàng chính xác.",
      "Chọn phương thức thanh toán (Chuyển khoản hoặc COD).",
      "Lưu ý khi thanh toán bằng chuyển khoản: Vui lòng liên hệ trực tiếp với người bán để trao đổi và cọc/ thanh toán.",
      "Thêm ghi chú nếu cần (không bắt buộc).",
      "Kiểm tra lại đơn hàng và tổng tiền.",
      "Nhấn \"Đặt hàng\" để hoàn tất."
    ]),

    createGuideSection("Gửi yêu cầu hoàn trả / khiếu nại", [
      "Nhập tên sản phẩm.",
      "Nhập mã sản phẩm (ID đã gửi qua email).",
      "Mô tả rõ lý do hoàn trả.",
      "Thêm link Google Drive chứa ảnh/video minh chứng (nếu có).",
      "Kiểm tra lại thông tin.",
      "Nhấn \"Gửi yêu cầu\" để hoàn tất."
    ]),

    elll("div", { class: "note-box", style: "margin-top: 15px; color: #d9534f;" }, [
      elll("b", {}, ["⚠️ Chú ý: "]),
      "Đảm bảo link Drive đã bật quyền \"Anyone with the link can view\" để có thể xem được ảnh."
    ])
  ]);

  root.appendChild(panel);
  return root;
}
function aggregatePurchasedItems(orders, products) {
  const map = new Map();
  for (const order of orders || []) {
    for (const item of order.items || []) {
      const pid = item.productId;
      if (pid == null) continue;
      const prod = products.find((p) => p.id === pid);
      const prev = map.get(pid);
      const qty = Number(item.qty) || 0;
      const line = Number(item.lineTotal) || 0;
      if (prev) {
        prev.qty += qty;
        prev.lineTotal += line;
      } else {
        const name = prod?.name || `Sản phẩm #${pid}`;
        const imageUrl =
          prod?.coverImageUrl || (Array.isArray(prod?.imageUrls) ? prod.imageUrls[0] : "") || "";
        map.set(pid, {
          productId: pid,
          name,
          imageUrl,
          qty,
          lineTotal: line,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.productId - b.productId);
}

export function renderReturnsRequest({ orders, products, onRequestRefund }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Yêu cầu hoàn trả / khiếu nại"]));
  const panel = el("div", { class: "panel" });
  panel.appendChild(
    el("div", { class: "muted", style: "margin-bottom:14px" }, [
      "Chọn sản phẩm đã mua, bấm Hoàn trả, điền lý do và link Drive chứng minh. Hệ thống sẽ gửi email cho người bán.",
    ])
  );

  const items = aggregatePurchasedItems(orders, products || []);
  if (items.length === 0) {
    panel.appendChild(
      el("div", { class: "muted", style: "padding:12px 0" }, [
        "Bạn chưa có sản phẩm nào trong lịch sử mua hàng để yêu cầu hoàn trả.",
      ])
    );
    panel.appendChild(
      el("div", { style: "margin-top:10px" }, [
        el("a", { class: "btn btn--primary", href: "#/" }, ["Về trang chủ"]),
      ])
    );
    root.appendChild(panel);
    return root;
  }

  const list = el("div", { class: "refundList" });
  let openForm = null;

  items.forEach((it) => {
    const row = el("div", { class: "refundItem" });
    const thumb = el("div", { class: "refundItem__thumb" });
    if (it.imageUrl) {
      thumb.appendChild(
        el("img", {
          src: it.imageUrl,
          alt: "",
          width: 56,
          height: 56,
          loading: "lazy",
          style: "object-fit:cover;border-radius:10px;width:56px;height:56px;background:#eff4ff",
        })
      );
    }
    const meta = el("div", { class: "refundItem__meta" }, [
      el("div", { class: "refundItem__title", style: "font-weight:900;font-size:15px" }, [it.name]),
      el("div", { class: "muted", style: "font-size:13px;margin-top:4px" }, [
        `Mã SP: ${it.productId} • SL: ${it.qty} • ${currencyVND(it.lineTotal)}`,
      ]),
    ]);
    const toggleBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Hoàn trả"]);
    const head = el("div", { class: "refundItem__head" }, [thumb, meta, toggleBtn]);

    const formWrap = el("div", { class: "refundItem__form", hidden: "true" });
    const form = el("form");
    form.appendChild(
      el("div", { class: "field", style: "margin-top:4px" }, [
        el("div", { class: "label" }, ["Lý do muốn hoàn trả"]),
        el("textarea", {
          class: "textarea",
          name: "reason",
          required: "true",
          rows: 3,
          placeholder: "Ví dụ: Hàng bị lỗi móp méo, mở ra không chạy được…",
        }),
      ])
    );
    form.appendChild(
      el("div", { class: "field", style: "margin-top:12px" }, [
        el("div", { class: "label" }, ["Link Google Drive (ảnh / video chứng minh)"]),
        el("input", {
          class: "input",
          name: "driveLink",
          type: "url",
          required: "true",
          placeholder: "https://drive.google.com/…",
        }),
      ])
    );
    form.appendChild(
      el("div", { class: "muted", style: "margin-top:10px;font-size:13px" }, [
        "Nên đặt quyền xem “Anyone with the link” để người bán có thể mở được.",
      ])
    );
    const submitBtn = el("button", { class: "btn btn--primary", type: "submit", style: "margin-top:14px" }, [
      "Gửi yêu cầu hoàn trả",
    ]);
    form.appendChild(submitBtn);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const reason = String(fd.get("reason") || "").trim();
      const driveLink = String(fd.get("driveLink") || "").trim();
      if (!reason || !driveLink) return;
      if (typeof onRequestRefund !== "function") return;
      submitBtn.disabled = true;
      Promise.resolve(onRequestRefund({ productId: it.productId, reason, driveLink }))
        .then(() => {
          form.reset();
          formWrap.setAttribute("hidden", "");
          toggleBtn.textContent = "Đã gửi";
          toggleBtn.disabled = true;
        })
        .catch(() => { })
        .finally(() => {
          submitBtn.disabled = false;
        });
    });

    toggleBtn.addEventListener("click", () => {
      if (toggleBtn.disabled) return;
      const willOpen = formWrap.hasAttribute("hidden");
      if (openForm && openForm !== formWrap) {
        openForm.setAttribute("hidden", "");
      }
      if (willOpen) {
        formWrap.removeAttribute("hidden");
        openForm = formWrap;
      } else {
        formWrap.setAttribute("hidden", "");
        openForm = null;
      }
    });

    formWrap.appendChild(form);
    row.appendChild(head);
    row.appendChild(formWrap);
    list.appendChild(row);
  });

  panel.appendChild(list);
  root.appendChild(panel);
  return root;
}

const ORDER_STATUS_OPTIONS = [
  "đã xác nhận",
  "đã huỷ bỏ",
  "đang chuẩn bị hàng",
  "đã giao cho người shipper",
  "đã xác nhận ngày trao đổi",
];

function orderStatusPill(status) {
  return el("span", { class: "orderStatusPill" }, [String(status || "đã xác nhận")]);
}

export function renderOrdersPage({
  role,
  orders,
  onBack,
  onRefresh,
  onUpdateStatus,
}) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Theo dõi đơn hàng"]));

  const panel = el("div", { class: "panel" });
  const topRow = el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:12px" });
  topRow.appendChild(el("div", { class: "muted" }, [
    role === "buyer"
      ? "Chi tiết đơn hàng của bạn và trạng thái giao hàng hiện tại."
      : role === "seller"
        ? "Đơn hàng có sản phẩm của bạn. Bạn có thể cập nhật trạng thái thủ công."
        : "Toàn bộ đơn hàng trong hệ thống, bao gồm người mua và người bán.",
  ]));
  const topActions = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" });
  const refreshBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Tải lại"]);
  refreshBtn.addEventListener("click", () => onRefresh?.());
  const backBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Quay lại"]);
  backBtn.addEventListener("click", () => onBack?.());
  topActions.append(refreshBtn, backBtn);
  topRow.appendChild(topActions);
  panel.appendChild(topRow);

  if (!orders?.length) {
    panel.appendChild(el("div", { class: "muted" }, ["Chưa có đơn hàng nào."]));
    root.appendChild(panel);
    return root;
  }

  orders.forEach((order) => {
    const card = el("div", { class: "orderCard" });
    card.appendChild(
      el("div", { class: "orderCard__head" }, [
        el("div", {}, [
          el("div", { style: "font-weight:900" }, [`Đơn #${order._id || "N/A"}`]),
          el("div", { class: "muted", style: "font-size:13px" }, [
            `Ngày tạo: ${order.createdAt || "N/A"} • Hình thức: ${order.deliveryType === "direct" ? "Trực tiếp" : "Shipper"}`,
          ]),
        ]),
        el("div", { class: "price" }, [currencyVND(order.total || 0)]),
      ])
    );

    if (role !== "buyer") {
      card.appendChild(
        el("div", { class: "muted", style: "font-size:15px;margin-top:6px" }, [
          `Người mua: ${order.username || "-"}`,
        ])
      );
    }

    (order.items || []).forEach((item) => {
      const row = el("div", { class: "orderItemRow" });
      const left = el("div", { style: "min-width:180px" }, [
        el("div", { style: "font-weight:800" }, [item.productName || `Sản phẩm #${item.productId}`]),
        el("div", { class: "muted", style: "font-size:13px" }, [
          `Mã: ${item.productId} • SL: ${item.qty} • ${currencyVND(item.lineTotal || 0)}`,
        ]),
      ]);
      row.appendChild(left);

      const right = el("div", { class: "orderItemRow__right" });
      if (role === "admin") {
        right.appendChild(el("div", { class: "muted", style: "font-size:15px" }, [`Người bán: ${item.sellerUsername || "-"}`]));
      }
      right.appendChild(orderStatusPill(item.status));

      if (role === "buyer" && typeof onUpdateStatus === "function") {
        const received = String(item.status || "").trim().toLowerCase() === "đã nhận được hàng";
        const receiveBtn = el(
          "button",
          { class: "btn btn--primary", type: "button", disabled: received ? "true" : undefined },
          [received ? "Đã xác nhận nhận hàng" : "Xác nhận đã nhận hàng"]
        );
        receiveBtn.addEventListener("click", () => {
          if (received) return;
          receiveBtn.disabled = true;
          Promise.resolve(onUpdateStatus(order._id, item.productId, "đã nhận được hàng"))
            .finally(() => {
              receiveBtn.disabled = false;
            });
        });
        right.appendChild(receiveBtn);
      }

      if ((role === "seller" || role === "admin") && typeof onUpdateStatus === "function") {
        const select = el(
          "select",
          { class: "select", style: "min-width:220px" },
          ORDER_STATUS_OPTIONS.map((s) => el("option", { value: s }, [s]))
        );
        select.value = String(item.status || ORDER_STATUS_OPTIONS[0]);
        const saveBtn = el("button", { class: "btn btn--primary", type: "button" }, ["Cập nhật"]);
        saveBtn.addEventListener("click", () => {
          saveBtn.disabled = true;
          Promise.resolve(onUpdateStatus(order._id, item.productId, select.value))
            .finally(() => {
              saveBtn.disabled = false;
            });
        });
        right.appendChild(el("div", { style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" }, [select, saveBtn]));
      }
      row.appendChild(right);
      card.appendChild(row);
    });
    panel.appendChild(card);
  });

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

export function renderAccountProfile({ profile, title = "My account", onBack, onToast, onRequestVerification }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, [title]));
  const panel = el("div", { class: "panel" });
  const top = el("div", { class: "accountProfile__top" });
  const profileAvatarSrc = String(profile.displayAvatarUrl || profile.avatarUrl || "").trim();
  if (profileAvatarSrc) {
    top.appendChild(el("img", { class: "accountProfile__avatar", src: profileAvatarSrc, alt: profile.username || "avatar" }));
  } else {
    top.appendChild(el("div", { class: "accountProfile__avatar accountProfile__avatar--fallback" }, ["👤"]));
  }
  top.appendChild(
    el("div", {}, [
      el("div", { style: "font-weight:1000;font-size:18px" }, [profile.fullName || profile.username || "-"]),
      el("div", { class: "muted" }, [`@${profile.username || "-"}`]),
      el("div", { class: "muted" }, [
        `Vai trò: ${profile.role || "-"} `,
        el("span", {
          class: profile.studentVerified ? "pill" : "pill pill--danger",
          style: profile.studentVerified ? "background:#d8f5e7;color:#39b282;" : "background:#ffe8e8;color:#ff5252;"
        }, [profile.studentVerified ? "✓ Đã xác minh" : "✗ Chưa xác minh"])
      ]),
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
  panel.appendChild(
    el("div", { class: "summaryRow" }, [
      el("div", { class: "muted" }, ["QR thanh toán"]),
      el("div", { style: "font-weight:800;max-width:60%;overflow:hidden;text-overflow:ellipsis" }, [profile.paymentQrUrl || "-"]),
    ])
  );

  const actions = el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" });

  if (profile.role === "standard" && !profile.studentVerified && onRequestVerification) {
    const reqBtn = el("button", { class: "btn btn--primary", type: "button" }, ["Gửi yêu cầu xác minh"]);
    reqBtn.addEventListener("click", async () => {
      reqBtn.disabled = true;
      reqBtn.textContent = "Đang gửi...";
      try {
        await onRequestVerification();
        reqBtn.textContent = "Đã gửi yêu cầu";
        onToast?.("Yêu cầu đã được gửi đến Admin", "success");
      } catch (err) {
        reqBtn.disabled = false;
        reqBtn.textContent = "Gửi yêu cầu xác minh";
        onToast?.(err.message, "error");
      }
    });
    actions.appendChild(reqBtn);
  }

  const backBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Back"]);
  backBtn.addEventListener("click", onBack);
  actions.appendChild(backBtn);

  panel.appendChild(actions);
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
  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Mã QR thanh toán URL"]),
      el("input", { class: "input", name: "paymentQrUrl", type: "url", value: profile.paymentQrUrl || "" }),
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
      paymentQrUrl: toGoogleDriveImageUrl(String(fd.get("paymentQrUrl") || "").trim()),
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

export function renderReportProduct({ product, onSubmit, onCancel }) {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Báo cáo sản phẩm"]));

  const panel = el("div", { class: "panel" });
  panel.appendChild(el("div", { class: "muted", style: "margin-bottom:10px" }, [
    "Bạn đang báo cáo sản phẩm: ", el("strong", {}, [product.name])
  ]));

  const form = el("form");
  form.appendChild(
    el("div", { class: "field" }, [
      el("div", { class: "label" }, ["Nội dung báo cáo"]),
      el("textarea", { class: "input", name: "reason", rows: 4, required: "true", placeholder: "Sản phẩm vi phạm, hàng giả, nội dung không phù hợp..." })
    ])
  );

  form.appendChild(
    el("div", { class: "field", style: "margin-top:10px" }, [
      el("div", { class: "label" }, ["Link bằng chứng (Google Drive)"]),
      el("input", { class: "input", name: "driveLink", type: "url", placeholder: "https://drive.google.com/..." })
    ])
  );

  form.appendChild(
    el("div", { style: "display:flex; gap:10px; margin-top:12px; flex-wrap:wrap" }, [
      el("button", { class: "btn btn--danger", type: "submit" }, ["Gửi báo cáo"]),
      el("button", { class: "btn btn--ghost", type: "button" }, ["Quay lại"])
    ])
  );

  form.querySelector('button[type="button"]').addEventListener("click", onCancel);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onSubmit({
      productId: product.id,
      reason: String(fd.get("reason") || "").trim(),
      driveLink: String(fd.get("driveLink") || "").trim(),
    });
  });

  panel.appendChild(form);
  root.appendChild(panel);
  return root;
}

function scrollChatHistoryToBottom(container) {
  if (!container) return;
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  });
}

export function renderConversations({ conversations, activeUser, onOpenChat }) {
  const list = el("div", { class: "chat-conversations" });
  if (!conversations || conversations.length === 0) {
    list.appendChild(el("div", { class: "muted", style: "padding:16px;text-align:center;" }, ["Chưa có tin nhắn."]));
    return list;
  }
  conversations.forEach(c => {
    const isActive = c.username === activeUser;
    const item = el("div", { class: "chat-conversation-item" + (isActive ? " active" : "") });

    // Add Avatar and Info container
    const leftSide = el("div", { style: "display: flex; align-items: center; gap: 12px; overflow: hidden;" });
    const peerSrc = String(c.peerAvatarUrl || "").trim();
    let avatarNode;
    if (peerSrc) {
      const avatarImg = el("img", {
        class: "chat-peer-avatar",
        src: peerSrc,
        alt: "",
        loading: "lazy",
      });
      avatarImg.addEventListener(
        "error",
        () => {
          const fb = el(
            "div",
            { class: "chat-avatar-fallback chat-avatar-fallback--lg" },
            [initialsFromUsername(c.username)]
          );
          avatarImg.replaceWith(fb);
        },
        { once: true }
      );
      avatarNode = avatarImg;
    } else {
      avatarNode = el(
        "div",
        { class: "chat-avatar-fallback chat-avatar-fallback--lg" },
        [initialsFromUsername(c.username)]
      );
    }

    const info = el("div", { class: "chat-conversation-info" });
    info.appendChild(el("div", { class: "chat-conversation-user" }, [c.username]));
    info.appendChild(el("div", { class: "chat-conversation-msg" }, [
      c.lastMessage.sender === c.username ? c.username + ": " + c.lastMessage.content : "Bạn: " + c.lastMessage.content
    ]));

    leftSide.appendChild(avatarNode);
    leftSide.appendChild(info);

    item.appendChild(leftSide);
    item.appendChild(el("div", { class: "muted", style: "font-size:11px; white-space: nowrap; flex-shrink: 0; padding-left: 8px;" }, [
      new Date(c.lastMessage.createdAt).toLocaleString("vi-VN", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    ]));
    item.addEventListener("click", () => onOpenChat(c.username));
    list.appendChild(item);
  });
  return list;
}

export function updateChatHistoryDOM(container, messages, currentUser, otherUserDisplayAvatarUrl) {
  if (!messages || messages.length === 0) {
    container.replaceChildren(el("div", { class: "muted", style: "text-align:center; margin-top:20px;" }, ["Bắt đầu cuộc trò chuyện!"]));
    return;
  }
  container.replaceChildren();
  messages.forEach(m => {
    const isMine = m.sender === currentUser.username;
    const alignRule = isMine ? 'flex-end' : 'flex-start';
    const wrapper = el("div", { style: `display: flex; flex-direction: column; align-items: ${alignRule}; margin-bottom: 8px; width: 100%;` });

    const rowEl = el("div", { style: "display: flex; align-items: flex-end; gap: 8px; max-width: 80%;" });

    let avatarEl;
    if (isMine) {
      const custom = String(currentUser.avatarUrl || "").trim();
      if (custom) {
        const avatarImg = el("img", {
          class: "chat-bubble-avatar",
          src: custom,
          alt: "",
        });
        avatarImg.addEventListener("error", () => {
          const fb = el(
            "div",
            { class: "chat-avatar-fallback chat-avatar-fallback--sm" },
            [userInitials(currentUser)]
          );
          avatarImg.replaceWith(fb);
        }, { once: true });
        avatarEl = avatarImg;
      } else {
        avatarEl = el(
          "div",
          { class: "chat-avatar-fallback chat-avatar-fallback--sm", title: currentUser.username || "" },
          [userInitials(currentUser)]
        );
      }
    } else {
      const peerSrc = String(otherUserDisplayAvatarUrl || "").trim();
      if (peerSrc) {
        const avatarImg = el("img", {
          class: "chat-bubble-avatar",
          src: peerSrc,
          alt: "",
        });
        avatarImg.addEventListener(
          "error",
          () => {
            const fb = el(
              "div",
              { class: "chat-avatar-fallback chat-avatar-fallback--sm" },
              [initialsFromUsername(m.sender)]
            );
            avatarImg.replaceWith(fb);
          },
          { once: true }
        );
        avatarEl = avatarImg;
      } else {
        avatarEl = el(
          "div",
          { class: "chat-avatar-fallback chat-avatar-fallback--sm" },
          [initialsFromUsername(m.sender)]
        );
      }
    }

    const msgContentWrapper = el("div", { style: `display: flex; flex-direction: column; align-items: ${alignRule}; max-width: 100%;` });
    const msgEl = el("div", { class: `chat-msg ${isMine ? 'chat-msg--mine' : 'chat-msg--theirs'}` }, [m.content]);

    const timeEl = el("div", { style: "font-size: 10px; color: var(--muted-color); margin-top: 4px;" }, [
      m.createdAt ? new Date(m.createdAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }) : ""
    ]);

    msgContentWrapper.appendChild(msgEl);
    msgContentWrapper.appendChild(timeEl);

    if (isMine) {
      rowEl.appendChild(msgContentWrapper);
      rowEl.appendChild(avatarEl);
    } else {
      rowEl.appendChild(avatarEl);
      rowEl.appendChild(msgContentWrapper);
    }

    wrapper.appendChild(rowEl);
    container.appendChild(wrapper);
  });
  scrollChatHistoryToBottom(container);
}

export function renderMessengerLayout({
  conversations,
  activeUser,
  messages,
  currentUser,
  otherUserAvatar,
  onSelectUser,
  onSend,
  onBackToList,
}) {
  const root = el("div", { style: "max-width:1200px;margin:auto" });
  root.appendChild(el("div", { class: "pageTitle" }, ["Tin nhắn"]));

  const layout = el("div", { class: "messenger-layout" });
  if (activeUser) layout.classList.add("has-active-chat");

  // Sidebar (30%)
  const sidebar = el("div", { class: "messenger-sidebar" });
  sidebar.appendChild(el("div", { class: "messenger-sidebar-header" }, ["Đoạn chat"]));

  let displayConversations = [...(conversations || [])];
  if (activeUser && !displayConversations.some(c => c.username === activeUser)) {
    displayConversations.unshift({
      username: activeUser,
      lastMessage: { content: "Chưa có cuộc trò chuyện", createdAt: new Date().toISOString(), sender: activeUser }
    });
  }

  sidebar.appendChild(renderConversations({ conversations: displayConversations, activeUser, onOpenChat: onSelectUser }));
  layout.appendChild(sidebar);

  // Main Content (70%)
  const main = el("div", { class: "messenger-main" });
  if (!activeUser) {
    main.style.alignItems = "center";
    main.style.justifyContent = "center";
    main.appendChild(el("div", { class: "muted", style: "font-size:18px;" }, ["Hãy chọn một người để bắt đầu trò chuyện."]));
  } else {
    const windowEl = el("div", { class: "chat-window" });
    const header = el("div", { class: "messenger-sidebar-header messenger-chat-header" }, [
      el("button", { class: "messenger-back-btn", type: "button" }, ["← Quay lại"]),
      el("span", {}, [`${activeUser}`]),
    ]);
    const backBtn = header.querySelector(".messenger-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (typeof onBackToList === "function") onBackToList();
      });
    }
    const historyEl = el("div", { class: "chat-history" });
    updateChatHistoryDOM(historyEl, messages, currentUser, otherUserAvatar);

    const inputBar = el("form", { class: "chat-input-bar" });
    const input = el("input", { class: "input", name: "content", placeholder: "Nhập tin nhắn...", autocomplete: "off" });
    const sendBtn = el("button", { class: "btn btn--primary", type: "submit" }, ["Gửi"]);
    inputBar.appendChild(input);
    inputBar.appendChild(sendBtn);

    inputBar.addEventListener("submit", (e) => {
      e.preventDefault();
      const content = String(input.value || "").trim();
      if (!content) return;
      onSend(content);
      input.value = "";
    });

    windowEl.appendChild(header);
    windowEl.appendChild(historyEl);
    windowEl.appendChild(inputBar);

    main.appendChild(windowEl);
  }

  layout.appendChild(main);
  root.appendChild(layout);
  return root;
}

function renderPasswordField({ name, placeholder = "", required = true }) {
  const input = el("input", {
    class: "input",
    type: "password",
    name,
    placeholder,
    required: required ? "true" : undefined,
  });
  const toggle = el("button", { class: "field__toggle", type: "button", "aria-label": "Toggle password visibility" }, [
    el("span", { class: "material-symbols-outlined", style: "font-size: 20px" }, ["visibility"]),
  ]);

  toggle.addEventListener("click", () => {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    toggle.replaceChildren(
      el("span", { class: "material-symbols-outlined", style: "font-size: 20px" }, [
        isPassword ? "visibility_off" : "visibility",
      ])
    );
  });

  return el("div", { class: "field__wrapper" }, [input, toggle]);
}
