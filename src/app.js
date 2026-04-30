import { currencyVND, clamp, debounce, el, escapeHtml, formatRating } from "./lib/ui.js";
import { CartStore } from "./store/cart.js";
import {
  renderHome,
  renderProduct,
  renderCheckout,
  renderNotFound,
  renderAdmin,
  renderLogin,
  renderRegister,
  renderVerifyQueue,
  renderAccountProfile,
  renderPostingGuide,
  renderReturnsRequest,
  renderEditAccount,
  renderManageAccounts,
  renderLostFoundPreviewStrip,
  renderLostFoundListPage,
  renderLostFoundDetail,
  renderLostFoundNewForm,
  renderReportProduct,
  renderConversations,
  renderMessengerLayout,
  updateChatHistoryDOM,
  renderForgotPassword,
  renderResetPassword,
  renderOrdersPage,
} from "./views/views.js";
import {
  fetchProducts,
  fetchCategories,
  upsertProduct,
  updateProduct,
  deleteProduct,
  registerUser,
  loginUser,
  fetchMe,
  logoutUser,
  verifyStudent,
  fetchPendingUsers,
  fetchStandardUsers,
  deleteUserAsAdmin,
  placeOrder,
  fetchUserProfile,
  fetchCart,
  saveCart,
  updateMe,
  fetchLostFound,
  fetchLostFoundPost,
  createLostFoundPost,
  deleteLostFoundPost,
  reportProduct,
  fetchMyOrders,
  fetchSellerOrders,
  fetchAdminOrders,
  updateOrderStatus,
  submitRefund,
  fetchConversations,
  fetchMessagesWith,
  sendMessage,
  requestVerification,
  forgotPassword,
  resetPassword,
  validateDiscountCode,
  fetchAdminDiscountCodes,
  createAdminDiscountCode,
  deleteAdminDiscountCode,
} from "./lib/api.js";

const cart = new CartStore("shopee_clone_cart_guest");

const view = document.getElementById("view");
const categoryBar = document.getElementById("categoryBar");
const year = document.getElementById("year");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

const cartDrawer = document.getElementById("cartDrawer");
const cartButton = document.getElementById("cartButton");
const searchToggleButton = document.getElementById("searchToggleButton");
const messagesButton = document.getElementById("messagesButton");
const accountMessagesLink = document.getElementById("accountMessagesLink");
const cartDrawerBody = document.getElementById("cartDrawerBody");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartCountBadge = document.getElementById("cartCountBadge");
const clearCartBtn = document.getElementById("clearCartBtn");
const authStatus = document.getElementById("authStatus");
const accountMenu = document.querySelector(".accountMenu");
const accountButton = document.getElementById("accountButton");
const accountDropdown = document.getElementById("accountDropdown");
const navAvatar = document.getElementById("navAvatar");
const navAvatarFallback = document.getElementById("navAvatarFallback");
const accountProfileInfo = document.getElementById("accountProfileInfo");
const accountProfileName = document.getElementById("accountProfileName");
const accountProfileMssv = document.getElementById("accountProfileMssv");
const accountLoginLink = document.getElementById("accountLoginLink");
const accountRegisterLink = document.getElementById("accountRegisterLink");
const accountAdminVerifyLink = document.getElementById("accountAdminVerifyLink");
const accountManageAccountsLink = document.getElementById("accountManageAccountsLink");
const accountDiscountCodesLink = document.getElementById("accountDiscountCodesLink");
const accountViewLink = document.getElementById("accountViewLink");
const accountPostingGuideLink = document.getElementById("accountPostingGuideLink");
const accountReturnsLink = document.getElementById("accountReturnsLink");
const accountOrdersLink = document.getElementById("accountOrdersLink");
const addProductButton = document.getElementById("addProductButton");

const toastHost = document.getElementById("toastHost");

year.textContent = String(new Date().getFullYear());

let products = [];
let categories = [];
let currentUser = null;

const state = {
  selectedCategory: "All",
  q: "",
  lostFoundQ: "",
  filters: {
    sort: "relevance", // relevance | price_asc | price_desc | name_asc | name_desc | brand_asc | brand_desc
    brand: "All",
    category: "All", // mirror of selectedCategory but controlled via filter panel too
    priceMin: 0,
    priceMax: 10_000_000,
    open: false,
  },
};

function isLostFoundRoute() {
  const { parts } = getRoute();
  return parts[0] === "lost-found";
}

const PRICE_MIN = 0;
const PRICE_MAX = 10_000_000;
const PRICE_STEP = 50_000;

let filterPanelEl = null;

function isMobileViewport() {
  return window.matchMedia("(max-width: 700px)").matches;
}

function setMobileSearchOpen(nextOpen) {
  const open = Boolean(nextOpen);
  document.body.classList.toggle("mobile-search-open", open);
  if (searchToggleButton) searchToggleButton.setAttribute("aria-expanded", open ? "true" : "false");
  if (open && searchInput && isMobileViewport()) {
    window.setTimeout(() => searchInput.focus(), 30);
  }
}

function clampPrice(n) {
  const x = Number(n || 0);
  return clamp(x, PRICE_MIN, PRICE_MAX);
}

function setFilters(next) {
  state.filters = { ...state.filters, ...next };
  // Keep category in sync with existing category chips + URL cat param logic
  if (state.filters.category !== state.selectedCategory) {
    setCategory(state.filters.category);
    return; // setCategory triggers re-render via hash change
  }
  renderCategories();
  render();
}

function getBrandsFromCatalog() {
  const set = new Set();
  for (const p of products || []) {
    const b = String(p.brand || "").trim();
    if (b) set.add(b);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
}

function ensureFilterPanel() {
  if (filterPanelEl) return filterPanelEl;
  if (!categoryBar || !categoryBar.parentElement) return null;
  filterPanelEl = el("div", { class: "filterPanel", hidden: "true" });
  categoryBar.parentElement.insertBefore(filterPanelEl, categoryBar.nextSibling);

  document.addEventListener("click", (e) => {
    if (!state.filters.open) return;
    const t = e.target;
    const inPanel = filterPanelEl && filterPanelEl.contains(t);
    const inChip = t && t.closest && t.closest(".chip--filter");
    if (!inPanel && !inChip) setFilters({ open: false });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.filters.open) setFilters({ open: false });
  });
  return filterPanelEl;
}

function renderFilterPanel() {
  const panel = ensureFilterPanel();
  if (!panel) return;
  if (!state.filters.open) {
    panel.setAttribute("hidden", "");
    panel.replaceChildren();
    return;
  }

  panel.removeAttribute("hidden");
  const brands = ["All", ...getBrandsFromCatalog()];
  const cats = ["All", ...categories];

  const sortSelect = el("select", { class: "select", name: "sort" }, [
    el("option", { value: "relevance" }, ["Mặc định"]),
    el("option", { value: "price_asc" }, ["Giá tăng dần"]),
    el("option", { value: "price_desc" }, ["Giá giảm dần"]),
    el("option", { value: "name_asc" }, ["Tên A → Z"]),
    el("option", { value: "name_desc" }, ["Tên Z → A"]),
    el("option", { value: "brand_asc" }, ["Hãng A → Z"]),
    el("option", { value: "brand_desc" }, ["Hãng Z → A"]),
  ]);
  sortSelect.value = state.filters.sort;

  const brandSelect = el("select", { class: "select", name: "brand" }, brands.map((b) => el("option", { value: b }, [b])));
  brandSelect.value = state.filters.brand;

  const categorySelect = el("select", { class: "select", name: "category" }, cats.map((c) => el("option", { value: c }, [c])));
  categorySelect.value = state.filters.category;

  const minRange = el("input", {
    class: "filterRange filterRange--min",
    type: "range",
    min: String(PRICE_MIN),
    max: String(PRICE_MAX),
    step: String(PRICE_STEP),
    value: String(state.filters.priceMin),
  });
  const maxRange = el("input", {
    class: "filterRange filterRange--max",
    type: "range",
    min: String(PRICE_MIN),
    max: String(PRICE_MAX),
    step: String(PRICE_STEP),
    value: String(state.filters.priceMax),
  });
  const minText = el("div", { class: "muted", style: "font-size:13px" }, [currencyVND(state.filters.priceMin)]);
  const maxText = el("div", { class: "muted", style: "font-size:13px;text-align:right" }, [currencyVND(state.filters.priceMax)]);

  const minBox = el("input", {
    class: "input",
    name: "priceMin",
    type: "number",
    min: String(PRICE_MIN),
    max: String(PRICE_MAX),
    step: String(PRICE_STEP),
    value: String(state.filters.priceMin),
    inputmode: "numeric",
  });
  const maxBox = el("input", {
    class: "input",
    name: "priceMax",
    type: "number",
    min: String(PRICE_MIN),
    max: String(PRICE_MAX),
    step: String(PRICE_STEP),
    value: String(state.filters.priceMax),
    inputmode: "numeric",
  });

  const normalizePair = (aRaw, bRaw) => {
    let a = clampPrice(aRaw);
    let b = clampPrice(bRaw);
    if (a > b) [a, b] = [b, a];
    return [a, b];
  };

  const updatePreview = (aRaw, bRaw) => {
    const [a, b] = normalizePair(aRaw, bRaw);
    minRange.value = String(a);
    maxRange.value = String(b);
    minBox.value = String(a);
    maxBox.value = String(b);
    minText.textContent = currencyVND(a);
    maxText.textContent = currencyVND(b);

    // Ensure both thumbs are draggable (top-most thumb near overlap)
    if (a > PRICE_MAX * 0.6) {
      minRange.style.zIndex = "6";
      maxRange.style.zIndex = "5";
    } else {
      minRange.style.zIndex = "5";
      maxRange.style.zIndex = "6";
    }
  };

  const commitPair = (aRaw, bRaw) => {
    const [a, b] = normalizePair(aRaw, bRaw);
    updatePreview(a, b);
    setFilters({ priceMin: a, priceMax: b });
  };

  // Smooth dragging: update preview on input, commit on change (mouse up)
  minRange.addEventListener("input", () => updatePreview(minRange.value, maxRange.value));
  maxRange.addEventListener("input", () => updatePreview(minRange.value, maxRange.value));
  minRange.addEventListener("change", () => commitPair(minRange.value, maxRange.value));
  maxRange.addEventListener("change", () => commitPair(minRange.value, maxRange.value));

  // Manual entry: preview while typing, commit on blur/change/Enter
  const onBoxInput = () => updatePreview(minBox.value, maxBox.value);
  const onBoxCommit = () => commitPair(minBox.value, maxBox.value);
  minBox.addEventListener("input", onBoxInput);
  maxBox.addEventListener("input", onBoxInput);
  minBox.addEventListener("change", onBoxCommit);
  maxBox.addEventListener("change", onBoxCommit);
  minBox.addEventListener("blur", onBoxCommit);
  maxBox.addEventListener("blur", onBoxCommit);
  minBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onBoxCommit();
  });
  maxBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onBoxCommit();
  });

  sortSelect.addEventListener("change", () => setFilters({ sort: sortSelect.value }));
  brandSelect.addEventListener("change", () => setFilters({ brand: brandSelect.value }));
  categorySelect.addEventListener("change", () => setFilters({ category: categorySelect.value }));

  const clearBtn = el("button", { class: "btn btn--ghost", type: "button" }, ["Xóa lọc"]);
  clearBtn.addEventListener("click", () => {
    setFilters({
      sort: "relevance",
      brand: "All",
      category: "All",
      priceMin: PRICE_MIN,
      priceMax: PRICE_MAX,
    });
  });

  const closeBtn = el("button", { class: "btn btn--primary", type: "button" }, ["Đóng"]);
  closeBtn.addEventListener("click", () => setFilters({ open: false }));

  panel.replaceChildren(
    el("div", { class: "filterPanel__grid" }, [
      el("div", { class: "field" }, [el("div", { class: "label" }, ["Sắp xếp theo"]), sortSelect]),
      el("div", { class: "field" }, [el("div", { class: "label" }, ["Danh mục"]), categorySelect]),
      el("div", { class: "field" }, [el("div", { class: "label" }, ["Hãng"]), brandSelect]),
      el("div", { class: "field", style: "grid-column: 1 / -1" }, [
        el("div", { class: "label" }, ["Khoảng giá"]),
        el("div", { class: "filterRangeRow" }, [minText, maxText]),
        el("div", { class: "filterRangeWrap" }, [minRange, maxRange]),
        el("div", { class: "filterPriceInputs" }, [
          el("div", { class: "field" }, [el("div", { class: "label" }, ["Từ (đ)"]), minBox]),
          el("div", { class: "field" }, [el("div", { class: "label" }, ["Đến (đ)"]), maxBox]),
        ]),
      ]),
    ]),
    el("div", { class: "filterPanel__actions" }, [clearBtn, closeBtn])
  );

  // initialize preview & z-index
  updatePreview(state.filters.priceMin, state.filters.priceMax);
}

function applyTopBarMode() {
  const lf = isLostFoundRoute();
  if (categoryBar) categoryBar.hidden = lf;
  if (cartButton) {
    if (lf) cartButton.hidden = true;
    else cartButton.hidden = !currentUser;
  }
  if (addProductButton) {
    if (lf) {
      addProductButton.href = "#/lost-found/new";
      const lab = addProductButton.querySelector(".iconbtn__label");
      if (lab) lab.textContent = "Đăng";
      addProductButton.setAttribute("aria-label", "Đăng bài tìm đồ thất lạc");
      addProductButton.hidden = !canSell();
    } else {
      addProductButton.href = "#/admin";
      const lab = addProductButton.querySelector(".iconbtn__label");
      if (lab) lab.textContent = "Add";
      addProductButton.setAttribute("aria-label", "Add product");
      addProductButton.hidden = !canSell();
    }
  }
  searchInput.placeholder = lf
    ? "Tìm trong bài đăng tìm đồ thất lạc…"
    : "Tìm sản phẩm, thương hiệu và nhiều hơn nữa…";
}

function getRoute() {
  const raw = location.hash || "#/";
  const [path, query] = raw.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const searchParams = new URLSearchParams(query || "");
  return { parts, searchParams };
}

function setQuery(q) {
  state.q = q;
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (state.selectedCategory !== "All") params.set("cat", state.selectedCategory);
  location.hash = `#/${params.toString() ? "?" + params.toString() : ""}`;
}

function setCategory(cat) {
  state.selectedCategory = cat;
  state.filters.category = cat;
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (cat !== "All") params.set("cat", cat);
  location.hash = `#/${params.toString() ? "?" + params.toString() : ""}`;
}

function filteredProducts() {
  const q = state.q.trim().toLowerCase();
  let list = products.filter((p) => {
    if (state.selectedCategory !== "All" && p.category !== state.selectedCategory) return false;
    if (state.filters.brand !== "All" && String(p.brand || "") !== String(state.filters.brand)) return false;
    const price = Number(p.price || 0);
    if (price < state.filters.priceMin || price > state.filters.priceMax) return false;
    if (!q) return true;
    const hay = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
    return hay.includes(q);
  });

  const s = state.filters.sort;
  if (s === "price_asc") list = [...list].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  else if (s === "price_desc") list = [...list].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  else if (s === "name_asc") list = [...list].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "vi", { sensitivity: "base" }));
  else if (s === "name_desc") list = [...list].sort((a, b) => String(b.name || "").localeCompare(String(a.name || ""), "vi", { sensitivity: "base" }));
  else if (s === "brand_asc") list = [...list].sort((a, b) => String(a.brand || "").localeCompare(String(b.brand || ""), "vi", { sensitivity: "base" }));
  else if (s === "brand_desc") list = [...list].sort((a, b) => String(b.brand || "").localeCompare(String(a.brand || ""), "vi", { sensitivity: "base" }));
  return list;
}

async function loadCatalog() {
  products = await fetchProducts();
  categories = await fetchCategories();
}

async function refreshCurrentUser() {
  currentUser = await fetchMe();
  syncCartScope();
  if (currentUser) {
    try {
      const remoteItems = await fetchCart();
      cart.setItems(remoteItems);
    } catch {
      cart.setItems([]);
    }
  } else {
    cart.setItems([]);
  }
  updateAuthUI();
}

function syncCartScope() {
  const key = currentUser?.username
    ? `shopee_clone_cart_${currentUser.username}`
    : "shopee_clone_cart_guest";
  cart.setStorageKey(key);
}

function canSell() {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  return !!currentUser.studentVerified;
}

function canBuy() {
  return canSell();
}

function getAddToCartLabel() {
  if (!currentUser) return "Đăng nhập để mua";
  if (!canBuy()) return "Need to verify";
  return "Add";
}

function canDeleteProduct(p) {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  return !!currentUser.studentVerified && p.ownerUsername === currentUser.username;
}

function isOwnerProduct(p) {
  if (!currentUser || !p) return false;
  return p.ownerUsername === currentUser.username;
}

function stockForProduct(productId) {
  const p = products.find((x) => x.id === productId);
  return p ? Number(p.quantity || 0) : 0;
}

function inCartQty(productId) {
  const found = cart.items().find((x) => x.productId === productId);
  return found ? Number(found.qty || 0) : 0;
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (String(a[i] || "").trim() !== String(b[i] || "").trim()) return false;
  }
  return true;
}

function looksLikeSameProduct(p, payload) {
  if (!p || !payload) return false;
  return (
    String(p.ownerUsername || "") === String(currentUser?.username || "")
    && String(p.name || "").trim() === String(payload.name || "").trim()
    && String(p.brand || "").trim() === String(payload.brand || "").trim()
    && String(p.category || "").trim() === String(payload.category || "").trim()
    && Number(p.price || 0) === Number(payload.price || 0)
    && Number(p.status || 0) === Number(payload.status || 0)
    && Number(p.quantity || 0) === Number(payload.quantity || 0)
    && String(p.description || "").trim() === String(payload.description || "").trim()
    && arraysEqual(p.imageUrls || [], payload.imageUrls || [])
  );
}

function updateAuthUI() {
  if (!currentUser) {
    authStatus.textContent = "Guest";
    if (navAvatar && navAvatarFallback) {
      navAvatar.style.display = "none";
      navAvatarFallback.style.display = "inline";
    }
    if (accountProfileInfo) accountProfileInfo.style.display = "none";
    if (accountMessagesLink) accountMessagesLink.hidden = true;
    cartButton.hidden = true;
    if (messagesButton) messagesButton.hidden = true;
    accountLoginLink.hidden = false;
    accountRegisterLink.hidden = false;
    accountViewLink.hidden = true;
    if (accountOrdersLink) accountOrdersLink.hidden = true;
    accountReturnsLink.hidden = true;
    if (accountReturnsLink) accountReturnsLink.hidden = true;
    accountAdminVerifyLink.hidden = true;
    if (accountManageAccountsLink) accountManageAccountsLink.hidden = true;
    if (accountDiscountCodesLink) accountDiscountCodesLink.hidden = true;
    logoutButton.hidden = true;
    cart.clear();
    closeDrawer();
    updateCartBadge();
    applyTopBarMode();
    return;
  }
  authStatus.textContent = currentUser.username;
  if (navAvatar && navAvatarFallback) {
    const navSrc = String(currentUser.displayAvatarUrl || currentUser.avatarUrl || "").trim();
    if (navSrc) {
      navAvatar.src = navSrc;
      navAvatar.style.display = "inline";
      navAvatarFallback.style.display = "none";
    } else {
      navAvatar.style.display = "none";
      navAvatarFallback.style.display = "inline";
    }
  }
  if (accountProfileInfo) {
    accountProfileInfo.style.display = "flex";
    accountProfileName.textContent = currentUser.fullName || currentUser.username;
    accountProfileMssv.textContent = currentUser.mssv ? `MSSV: ${currentUser.mssv}` : "";
  }
  if (accountMessagesLink) accountMessagesLink.hidden = false;
  cartButton.hidden = false;
  if (messagesButton) messagesButton.hidden = false;
  accountLoginLink.hidden = true;
  accountRegisterLink.hidden = true;
  accountViewLink.hidden = false;
  if (accountOrdersLink) accountOrdersLink.hidden = false;
  if (accountOrdersLink) {
    accountOrdersLink.setAttribute(
      "href",
      currentUser.role === "admin" ? "#/orders" : "#/seller-orders"
    );
    accountOrdersLink.textContent = currentUser.role === "admin" ? "Đơn hàng toàn hệ thống" : "Đơn hàng của tôi";
  }
  accountPostingGuideLink.hidden = false;
  if (accountReturnsLink) accountReturnsLink.hidden = false;
  accountAdminVerifyLink.hidden = currentUser.role !== "admin";
  if (accountManageAccountsLink) accountManageAccountsLink.hidden = currentUser.role !== "admin";
  if (accountDiscountCodesLink) accountDiscountCodesLink.hidden = currentUser.role !== "admin";
  logoutButton.hidden = false;
  updateCartBadge();
  applyTopBarMode();
}

function renderDiscountCodesAdminPage() {
  const root = el("div");
  root.appendChild(el("div", { class: "pageTitle" }, ["Quản lý mã giảm giá"]));
  const panel = el("div", { class: "panel" });
  const form = el("form");
  form.appendChild(el("div", { class: "formRow" }, [
    el("div", { class: "field" }, [el("div", { class: "label" }, ["Mã"]), el("input", { class: "input", name: "code", required: "true", placeholder: "VD: HELLO10" })]),
    el("div", { class: "field" }, [el("div", { class: "label" }, ["Loại"]), el("select", { class: "select", name: "type" }, [
      el("option", { value: "fixed" }, ["Giảm cố định (đ)"]),
      el("option", { value: "percent" }, ["Giảm theo %"]),
    ])]),
  ]));
  form.appendChild(el("div", { class: "formRow", style: "margin-top:10px" }, [
    el("div", { class: "field" }, [el("div", { class: "label" }, ["Giá trị"]), el("input", { class: "input", name: "value", type: "number", required: "true", min: "1" })]),
    el("div", { class: "field" }, [el("div", { class: "label" }, ["Đơn tối thiểu"]), el("input", { class: "input", name: "minOrderAmount", type: "number", min: "0", value: "0" })]),
  ]));
  form.appendChild(el("div", { class: "formRow", style: "margin-top:10px" }, [
    el("div", { class: "field" }, [el("div", { class: "label" }, ["Giảm tối đa (với %)"]), el("input", { class: "input", name: "maxDiscountAmount", type: "number", min: "0", value: "0" })]),
    el("div", { class: "field" }, [el("div", { class: "label" }, ["Số lượt dùng tối đa (0 = không giới hạn)"]), el("input", { class: "input", name: "totalUses", type: "number", min: "0", value: "0" })]),
  ]));
  form.appendChild(el("div", { class: "field", style: "margin-top:10px" }, [
    el("div", { class: "label" }, ["Ngày hết hạn (tuỳ chọn)"]),
    el("input", { class: "input", name: "expiresAt", type: "datetime-local" }),
  ]));
  form.appendChild(el("div", { style: "margin-top:12px" }, [el("button", { class: "btn btn--primary", type: "submit" }, ["Tạo mã giảm giá"])]));
  const listWrap = el("div", { style: "margin-top:16px" }, [el("div", { class: "muted" }, ["Đang tải danh sách mã..."])]);
  panel.appendChild(form);
  panel.appendChild(listWrap);
  root.appendChild(panel);

  const loadCodes = async () => {
    listWrap.replaceChildren(el("div", { class: "muted" }, ["Đang tải danh sách mã..."]));
    try {
      const codes = await fetchAdminDiscountCodes();
      listWrap.replaceChildren();
      if (!codes.length) {
        listWrap.appendChild(el("div", { class: "muted" }, ["Chưa có mã giảm giá nào."]));
        return;
      }
      codes.forEach((c) => {
        const row = el("div", { class: "summaryRow" }, [
          el("div", {}, [
            el("div", { style: "font-weight:900" }, [c.code]),
            el("div", { class: "muted", style: "font-size:13px" }, [
              `${c.type === "percent" ? `${c.value}%` : `${currencyVND(c.value)}`} • Min ${currencyVND(c.minOrderAmount || 0)} • Đã dùng ${c.usesCount}${c.totalUses > 0 ? `/${c.totalUses}` : ""}`,
            ]),
          ]),
          el("div", { style: "display:flex;align-items:center;gap:8px" }, [
            el("div", { class: "muted", style: "font-size:12px" }, [c.expiresAt ? `HSD: ${c.expiresAt}` : "Không giới hạn"]),
            el("button", { class: "btn btn--danger", type: "button", style: "padding:6px 10px;font-size:12px" }, ["Xoá"]),
          ]),
        ]);
        const deleteBtn = row.querySelector("button");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", async () => {
            if (!window.confirm(`Xoá mã giảm giá "${c.code}"?`)) return;
            deleteBtn.disabled = true;
            try {
              await deleteAdminDiscountCode(c.code);
              toast("Đã xoá mã giảm giá");
              loadCodes();
            } catch (err) {
              toast(err?.message || "Không thể xoá mã");
              deleteBtn.disabled = false;
            }
          });
        }
        listWrap.appendChild(row);
      });
    } catch (err) {
      listWrap.replaceChildren(el("div", { class: "muted" }, [String(err?.message || err)]));
    }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await createAdminDiscountCode({
        code: String(fd.get("code") || "").trim().toUpperCase(),
        type: String(fd.get("type") || "fixed").trim(),
        value: Number(fd.get("value") || 0),
        minOrderAmount: Number(fd.get("minOrderAmount") || 0),
        maxDiscountAmount: Number(fd.get("maxDiscountAmount") || 0),
        totalUses: Number(fd.get("totalUses") || 0),
        expiresAt: String(fd.get("expiresAt") || "").trim(),
      });
      toast("Tạo mã giảm giá thành công");
      form.reset();
      loadCodes();
    } catch (err) {
      toast(err?.message || "Không thể tạo mã");
    }
  });

  loadCodes();
  return root;
}

const persistCartToServerDebounced = debounce(() => {
  if (!currentUser) return;
  saveCart(cart.items()).catch(() => {
    // Ignore transient sync errors; local cart is still available.
  });
}, 250);

function persistCartIfLoggedIn() {
  if (!currentUser) return;
  persistCartToServerDebounced();
}

function closeAccountMenu() {
  accountDropdown.hidden = true;
}

function openDrawer() {
  cartDrawer.dataset.open = "true";
  cartDrawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderCartDrawer();
}

function closeDrawer() {
  cartDrawer.dataset.open = "false";
  cartDrawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function toast(message, action) {
  const node = el("div", { class: "toast", role: "status" }, [
    el("span", {}, [message]),
  ]);
  if (action?.label && typeof action.onClick === "function") {
    node.appendChild(
      el("button", { class: "toast__btn", type: "button" }, [action.label])
    );
    node.querySelector("button").addEventListener("click", () => action.onClick());
  }
  toastHost.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

function updateCartBadge() {
  const count = cart.countItems();
  cartCountBadge.textContent = String(count);
  cartCountBadge.hidden = count <= 0;
}

function categoryIconName(cat) {
  const key = String(cat || "").toLowerCase();
  if (key === "tất cả") return "apps";
  if (key.includes("học") || key.includes("chuyên ngành")) return "school";
  if (key.includes("điện tử") || key.includes("công nghệ")) return "devices";
  if (key.includes("thời trang")) return "checkroom";
  if (key.includes("giải trí")) return "sports_soccer";
  if (key.includes("phòng trọ")) return "home";
  if (key.includes("khác")) return "category";
  return "category";
}

function renderCategories() {
  categoryBar.replaceChildren();

  const hasActiveFilters =
    state.filters.brand !== "All"
    || state.filters.sort !== "relevance"
    || state.filters.priceMin !== PRICE_MIN
    || state.filters.priceMax !== PRICE_MAX
    || state.filters.category !== "All";

  const filterBtn = el(
    "button",
    {
      class: `chip chip--filter ${state.filters.open || hasActiveFilters ? "chip--active" : ""}`,
      type: "button",
      "aria-label": "Filter / sort",
      title: "Filter / sort",
    },
    [
      el("span", { class: "material-symbols-outlined", style: "font-size:18px;vertical-align:-4px" }, ["filter_alt"]),
      el("span", { style: "margin-left:6px" }, ["Lọc"]),
    ]
  );
  filterBtn.addEventListener("click", () => {
    setFilters({ open: !state.filters.open });
    renderFilterPanel();
  });
  categoryBar.appendChild(filterBtn);

  const all = ["Tất cả", ...categories];
  all.forEach((cat) => {
    const btn = el("button", {
      class: `categoryItem ${state.selectedCategory === cat ? "categoryItem--active" : ""}`,
      type: "button",
      "aria-label": `Nhóm ${cat}`,
    }, [
      el("span", { class: "categoryItem__iconWrap" }, [
        el("span", { class: "material-symbols-outlined categoryItem__icon" }, [categoryIconName(cat)]),
      ]),
      el("span", { class: "categoryItem__label" }, [cat]),
    ]);
    btn.addEventListener("click", () => setCategory(cat));
    categoryBar.appendChild(btn);
  });

  renderFilterPanel();
}

function cartItemRow(item) {
  const p = products.find((x) => x.id === item.productId);
  if (!p) return el("div", { class: "muted" }, ["Unknown item"]);

  const wrapper = el("div", { class: "cartItem" });
  wrapper.appendChild(el("div", { class: "cartItem__thumb" }, ["SHP"]));

  const right = el("div");
  const top = el("div", { class: "cartItem__top" });
  top.appendChild(el("div", {}, [
    el("div", { class: "cartItem__name" }, [p.name]),
    el("div", { class: "muted" }, [`${p.brand} • ${p.category}`]),
  ]));
  const removeBtn = el("button", { class: "btn btn--danger", type: "button" }, ["Remove"]);
  removeBtn.addEventListener("click", () => {
    cart.removeItem(p.id);
    persistCartIfLoggedIn();
    renderCartDrawer();
    updateCartBadge();
    toast("Removed from cart");
  });
  top.appendChild(removeBtn);

  const bottom = el("div", { class: "cartItem__bottom" });
  bottom.appendChild(el("div", { class: "price" }, [currencyVND(p.price)]));
  const controls = el("div", { class: "cartItem__controls" });
  const minus = el("button", { class: "cartItem__miniBtn", type: "button" }, ["−"]);
  const plus = el("button", { class: "cartItem__miniBtn", type: "button" }, ["+"]);
  const qty = el("div", { class: "qty__value" }, [String(item.qty)]);
  minus.addEventListener("click", () => {
    cart.setQty(p.id, item.qty - 1);
    persistCartIfLoggedIn();
    renderCartDrawer();
    updateCartBadge();
  });
  plus.addEventListener("click", () => {
    const maxQty = stockForProduct(p.id);
    if (item.qty >= maxQty) {
      toast("Reached max stock for this product");
      return;
    }
    cart.setQty(p.id, Math.min(item.qty + 1, maxQty));
    persistCartIfLoggedIn();
    renderCartDrawer();
    updateCartBadge();
  });
  controls.append(minus, qty, plus);
  bottom.appendChild(controls);

  right.append(top, bottom);
  wrapper.appendChild(right);
  return wrapper;
}

function renderCartDrawer() {
  cartDrawerBody.replaceChildren();
  const items = cart.items();
  if (items.length === 0) {
    cartDrawerBody.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "pageTitle" }, ["Giỏ hàng trống"]),
      el("div", { class: "muted" }, ["Thêm sản phẩm từ trang chủ."]),
      el("div", { style: "margin-top:12px" }, [
        el("button", { class: "btn btn--primary", type: "button" }, ["Xem sản phẩm"]),
      ]),
    ]));
    cartDrawerBody.querySelector("button").addEventListener("click", () => {
      closeDrawer();
      location.hash = "#/";
    });
  } else {
    items.forEach((it) => cartDrawerBody.appendChild(cartItemRow(it)));
  }

  // Khung lịch sử đơn hàng
  const historyContainer = el("div", { class: "cartHistory", style: "border-top:1px solid var(--border-color); margin-top:20px; padding-top:20px;" });
  const historyHead = el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;" });
  historyHead.appendChild(el("div", { style: "font-weight:900;" }, ["Đơn hàng gần đây"]));
  const viewAllBtn = el("button", { class: "btn btn--ghost", type: "button", style: "padding:6px 10px;font-size:13px" }, ["Xem toàn bộ"]);
  viewAllBtn.addEventListener("click", () => {
    closeDrawer();
    location.hash = "#/orders";
  });
  historyHead.appendChild(viewAllBtn);
  historyContainer.appendChild(historyHead);
  const loadingText = el("div", { class: "muted" }, ["Đang tải lịch sử mua..."]);
  historyContainer.appendChild(loadingText);
  cartDrawerBody.appendChild(historyContainer);

  if (currentUser) {
    fetchMyOrders().then((orders) => {
      loadingText.remove();
      if (!orders || orders.length === 0) {
        historyContainer.appendChild(el("div", { class: "muted", style: "font-size:14px" }, ["Chưa có đơn hàng nào."]));
        return;
      }

      orders.slice(0, 3).forEach(order => {
        const orderCard = el("div", { style: "margin-bottom:10px; border:1px solid var(--border-color); border-radius:6px; padding:10px;" });
        const dateStr = order.transactionDate || order.createdAt || "N/A";
        const deliveryMode = order.deliveryType === "direct" ? "Giao dịch trực tiếp" : "Shipper";
        orderCard.appendChild(el("div", { class: "muted", style: "font-size:12px; margin-bottom:6px;" }, [
          `Ngày: ${dateStr} • Hình thức: ${deliveryMode}`
        ]));

        (order.items || []).forEach(item => {
          const p = products.find(prod => prod.id === item.productId);
          const pName = p ? p.name : "Sản phẩm không xác định";
          orderCard.appendChild(el("div", { style: "display:flex; justify-content:space-between; margin-top:6px; gap:8px;align-items:flex-start;" }, [
            el("div", { style: "font-size:14px;flex:1" }, [
              `${pName} (Mã SP: ${item.productId}) x ${item.qty}`,
              el("div", { class: "muted", style: "font-size:12px" }, [`Trạng thái: ${item.status || "đã xác nhận"}`]),
            ]),
            el("div", { style: "text-align:right" }, [
              el("div", { class: "price", style: "font-size:14px;" }, [currencyVND(item.lineTotal || 0)]),
            ])
          ]));
        });
        historyContainer.appendChild(orderCard);
      });
    }).catch(err => {
      loadingText.textContent = "Không thể tải lịch sử đơn hàng.";
    });
  } else {
    loadingText.textContent = "Đăng nhập để xem đơn hàng đã mua.";
  }

  cartSubtotal.textContent = currencyVND(cart.subtotal(products));
}

function render() {
  const { parts, searchParams } = getRoute();
  const [first, second] = parts;

  const qParam = searchParams.get("q") || "";
  const cat = searchParams.get("cat") || "All";
  const lfRoute = first === "lost-found";
  if (lfRoute) {
    state.lostFoundQ = qParam;
    searchInput.value = state.lostFoundQ;
  } else {
    state.q = qParam;
    searchInput.value = state.q;
  }
  state.selectedCategory = categories.includes(cat) ? cat : "All";

  applyTopBarMode();
  if (searchInput) {
    searchInput.disabled = lfRoute && second === "new";
  }
  renderCategories();
  if (!first) {
    const list = filteredProducts();
    fetchLostFound({ limit: 3 })
      .then((posts) => {
        const { parts: p2 } = getRoute();
        if (p2[0]) return;
        const strip = renderLostFoundPreviewStrip({
          posts,
          onMore: () => (location.hash = "#/lost-found"),
          onOpen: (id) => (location.hash = `#/lost-found/${id}`),
        });
        view.replaceChildren(
          renderHome({
            products: list,
            q: state.q,
            category: state.selectedCategory,
            lostFoundPreview: strip,
            onOpen: (id) => (location.hash = `#/product/${id}`),
            onAdd: (id) => {
              if (!canBuy()) {
                toast("Login + verified student ID required to buy");
                return;
              }
              const stock = stockForProduct(id);
              const current = inCartQty(id);
              if (current >= stock) {
                toast("Cannot add more than available stock");
                return;
              }
              cart.addItem(id, 1);
              persistCartIfLoggedIn();
              updateCartBadge();
              toast("Added to cart", { label: "View cart", onClick: openDrawer });
            },
            onDelete: async (id) => {
              try {
                await deleteProduct(id);
                await loadCatalog();
                render();
                toast("Product deleted");
              } catch (err) {
                toast(err?.message || "Delete failed");
              }
            },
            canAddToCart: canBuy(),
            addToCartLabel: getAddToCartLabel(),
            canDeleteProduct,
            isOwnerProduct,
          })
        );
      })
      .catch(() => {
        const { parts: p2 } = getRoute();
        if (p2[0]) return;
        view.replaceChildren(
          renderHome({
            products: list,
            q: state.q,
            category: state.selectedCategory,
            lostFoundPreview: null,
            onOpen: (id) => (location.hash = `#/product/${id}`),
            onAdd: (id) => {
              if (!canBuy()) {
                toast("Login + verified student ID required to buy");
                return;
              }
              const stock = stockForProduct(id);
              const current = inCartQty(id);
              if (current >= stock) {
                toast("Cannot add more than available stock");
                return;
              }
              cart.addItem(id, 1);
              persistCartIfLoggedIn();
              updateCartBadge();
              toast("Added to cart", { label: "View cart", onClick: openDrawer });
            },
            onDelete: async (id) => {
              try {
                await deleteProduct(id);
                await loadCatalog();
                render();
                toast("Product deleted");
              } catch (err) {
                toast(err?.message || "Delete failed");
              }
            },
            canAddToCart: canBuy(),
            addToCartLabel: getAddToCartLabel(),
            canDeleteProduct,
            isOwnerProduct,
          })
        );
      });
    return;
  }

  if (first === "lost-found") {
    if (second === "new") {
      if (!currentUser || !canSell()) {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Cần đăng nhập"]),
            el("div", { class: "muted" }, ["Chỉ tài khoản đã xác thực MSSV (hoặc admin) mới đăng bài được."]),
            el("a", { class: "btn btn--primary", href: "#/login", style: "display:inline-block;margin-top:12px" }, ["Login"]),
          ])
        );
        return;
      }
      fetchUserProfile(currentUser.username)
        .then((profile) => {
          view.replaceChildren(
            renderLostFoundNewForm({
              profile,
              onError: (msg) => toast(msg),
              onCancel: () => (location.hash = "#/lost-found"),
              onSubmit: async (payload) => {
                try {
                  await createLostFoundPost(payload);
                  toast("Đã đăng bài");
                  location.hash = "#/lost-found";
                } catch (err) {
                  toast(err?.message || "Đăng bài thất bại");
                }
              },
            })
          );
        })
        .catch((err) => {
          view.replaceChildren(
            el("div", { class: "panel", style: "margin-top:14px" }, [
              el("div", { class: "pageTitle" }, ["Lỗi tải hồ sơ"]),
              el("div", { class: "muted" }, [String(err?.message || err)]),
            ])
          );
        });
      return;
    }
    if (second && second !== "new") {
      const pid = Number(second);
      if (!Number.isNaN(pid)) {
        fetchLostFoundPost(pid)
          .then((post) => {
            const canDelete =
              !!currentUser &&
              (currentUser.role === "admin" || post.authorUsername === currentUser.username);
            view.replaceChildren(
              renderLostFoundDetail({
                post,
                onBack: () => (location.hash = "#/lost-found"),
                onToast: (m) => toast(m),
                canDelete,
                onDelete: canDelete
                  ? async () => {
                    if (!window.confirm("Xóa bài đăng này? Hành động không thể hoàn tác.")) return;
                    try {
                      await deleteLostFoundPost(pid);
                      toast("Đã xóa bài");
                      location.hash = "#/lost-found";
                    } catch (err) {
                      toast(err?.message || "Xóa thất bại");
                    }
                  }
                  : undefined,
              })
            );
          })
          .catch((err) => {
            view.replaceChildren(
              el("div", { class: "panel", style: "margin-top:14px" }, [
                el("div", { class: "pageTitle" }, ["Không tìm thấy bài"]),
                el("div", { class: "muted" }, [String(err?.message || err)]),
              ])
            );
          });
        return;
      }
    }
    fetchLostFound({ q: state.lostFoundQ })
      .then((posts) => {
        view.replaceChildren(
          renderLostFoundListPage({
            posts,
            onOpen: (id) => (location.hash = `#/lost-found/${id}`),
            onBackHome: () => (location.hash = "#/"),
          })
        );
      })
      .catch((err) => {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Không tải được danh sách"]),
            el("div", { class: "muted" }, [String(err?.message || err)]),
          ])
        );
      });
    return;
  }

  if (first === "product" && second) {
    const id = Number(second);
    const p = products.find((x) => x.id === id);
    if (!p) {
      view.replaceChildren(renderNotFound());
      return;
    }
    view.replaceChildren(renderProduct({
      product: p,
      onAdd: (qty) => {
        if (!canBuy()) {
          toast("Cần đăng nhập và xác minh ID để mua");
          return;
        }
        const current = inCartQty(p.id);
        const stock = stockForProduct(p.id);
        const canAdd = Math.max(0, stock - current);
        if (canAdd <= 0) {
          toast("Đầy");
          return;
        }
        const appliedQty = Math.min(qty, canAdd);
        if (appliedQty < qty) toast(`Only ${appliedQty} đã đạt giới hạn mua`);
        cart.addItem(p.id, appliedQty);
        persistCartIfLoggedIn();
        updateCartBadge();
        toast("Added to cart", { label: "Checkout", onClick: () => (location.hash = "#/checkout") });
      },
      onBuyNow: (qty) => {
        if (!canBuy()) {
          toast("Cần đăng nhập và xác minh ID để mua");
          return;
        }
        const stock = stockForProduct(p.id);
        if (stock <= 0) {
          toast("Sản phẩm đã hết hàng");
          return;
        }
        const appliedQty = Math.min(qty, stock);
        location.hash = `#/checkout?buyNow=${p.id}&qty=${appliedQty}`;
      },
      canBuy: canBuy(),
      canDelete: canDeleteProduct(p),
      isOwner: isOwnerProduct(p),
      onDelete: async (id) => {
        try {
          await deleteProduct(id);
          await loadCatalog();
          location.hash = "#/";
          toast("Product deleted");
        } catch (err) {
          toast(err?.message || "Delete failed");
        }
      },
      onBack: () => (location.hash = "#/"),
      onViewSeller: (username) => (location.hash = `#/account/${encodeURIComponent(username)}`),
      onEdit: (id) => (location.hash = `#/edit-product/${id}`),
      onReport: (id) => (location.hash = `#/report-product/${id}`),
      onChat: (username) => {
        if (!currentUser) return toast("Đăng nhập để chat");
        if (!canBuy()) return toast("Chỉ có tài khoản đã được xác minh mới có thể chat!");
        location.hash = `#/messages/${encodeURIComponent(username)}`;
      }
    }));
    return;
  }

  if (first === "report-product" && second) {
    const id = Number(second);
    const p = products.find((x) => x.id === id);
    if (!p) {
      view.replaceChildren(renderNotFound());
      return;
    }
    view.replaceChildren(renderReportProduct({
      product: p,
      onCancel: () => (location.hash = `#/product/${id}`),
      onSubmit: async (payload) => {
        try {
          await reportProduct(payload);
          toast("Gửi báo cáo thành công!");
          location.hash = `#/product/${id}`;
        } catch (err) {
          toast(err?.message || "Lỗi khi gửi báo cáo");
        }
      }
    }));
    return;
  }

  // --- Messages routes ---
  if (first === "messages") {
    if (!currentUser) return (location.hash = "#/login");
    if (!canBuy()) {
      view.replaceChildren(el("div", { class: "panel", style: "text-align:center; padding: 40px;" }, ["Chỉ phần lớn tài khoản đã được xác minh mới có thể sử dụng hòm thư. Vui lòng gửi yêu cầu để Admin duyệt tài khoản!"]));
      return;
    }

    let isSubmitting = false;
    let renderedChat = false;

    // Clear any previous global polling timer (we can attach it to window.appPollingTimer just in case)
    if (window.appPollingTimer) clearInterval(window.appPollingTimer);

    // Prevent frozen UI on slow networks
    view.replaceChildren(el("div", { class: "muted", style: "padding: 20px; text-align: center;" }, ["Đang tải hộp thư..."]));

    const refreshChat = async () => {
      // Check if we navigated away from the messenger entirely
      const { parts } = getRoute();
      if (parts[0] !== "messages") {
        clearInterval(window.appPollingTimer);
        return;
      }

      const currentSelectedUser = parts[1] ? decodeURIComponent(parts[1]) : null;

      try {
        const [conversations, messages, otherProfile] = await Promise.all([
          fetchConversations(),
          currentSelectedUser ? fetchMessagesWith(currentSelectedUser) : Promise.resolve([]),
          currentSelectedUser ? fetchUserProfile(currentSelectedUser).catch(() => null) : Promise.resolve(null)
        ]);

        if (getRoute().parts[0] !== "messages") return; // Double check post-await

        if (!renderedChat) {
          const peerRow = (conversations || []).find((c) => c.username === currentSelectedUser);
          const otherAvatar =
            otherProfile?.displayAvatarUrl ||
            otherProfile?.avatarUrl ||
            peerRow?.peerAvatarUrl ||
            "";
          view.replaceChildren(renderMessengerLayout({
            conversations,
            activeUser: currentSelectedUser,
            messages,
            currentUser,
            otherUserAvatar: otherAvatar,
            onBackToList: () => {
              location.hash = "#/messages";
            },
            onSelectUser: (u) => {
              renderedChat = false; // Force re-render when switching user to reconstruct listeners
              location.hash = `#/messages/${encodeURIComponent(u)}`;
            },
            onSend: async (content) => {
              if (isSubmitting) return;
              isSubmitting = true;
              try {
                await sendMessage(currentSelectedUser, { content });
                await refreshChat();
              } catch (err) {
                toast(err.message);
              } finally {
                isSubmitting = false;
              }
            }
          }));
          renderedChat = true;
        } else {
          // Re-render sidebar component
          const sidebar = view.querySelector(".messenger-sidebar");
          if (sidebar) {
            const sidebarHeader = el("div", { class: "messenger-sidebar-header" }, ["Đoạn chat"]);
            let displayConversations = [...(conversations || [])];
            if (currentSelectedUser && !displayConversations.some(c => c.username === currentSelectedUser)) {
              displayConversations.unshift({
                username: currentSelectedUser,
                lastMessage: { content: "Cuộc trò chuyện mới...", createdAt: new Date().toISOString(), sender: currentSelectedUser }
              });
            }
            const newList = renderConversations({
              conversations: displayConversations, activeUser: currentSelectedUser, onOpenChat: (u) => {
                renderedChat = false;
                location.hash = `#/messages/${encodeURIComponent(u)}`;
              }
            });
            sidebar.replaceChildren(sidebarHeader, newList);
          }

          if (currentSelectedUser) {
            const historyEl = view.querySelector(".chat-history");
            if (historyEl) {
              const peerRow = (conversations || []).find((c) => c.username === currentSelectedUser);
              const otherAvatar =
                otherProfile?.displayAvatarUrl ||
                otherProfile?.avatarUrl ||
                peerRow?.peerAvatarUrl ||
                "";
              updateChatHistoryDOM(historyEl, messages, currentUser, otherAvatar);
            }
          }
        }
      } catch (err) {
        if (!renderedChat) {
          view.replaceChildren(el("div", { class: "panel" }, [err.message || err]));
        }
      }
    };

    refreshChat();
    window.appPollingTimer = setInterval(refreshChat, 3000);
    return;
  }

  if (first === "checkout") {
    const buyNowProductId = Number(searchParams.get("buyNow") || 0);
    const buyNowQty = Math.max(1, Number(searchParams.get("qty") || 1));
    const buyNowProduct = products.find((x) => x.id === buyNowProductId);
    const checkoutItems = buyNowProduct
      ? [{ product: buyNowProduct, qty: buyNowQty, lineTotal: Number(buyNowProduct.price || 0) * buyNowQty }]
      : cart.itemsDetailed(products);

    const getSellerQrList = async () => {
      const usernames = Array.from(new Set(
        checkoutItems.map((it) => String(it?.product?.ownerUsername || "").trim()).filter(Boolean)
      ));
      const profiles = await Promise.all(
        usernames.map(async (u) => {
          try {
            const p = await fetchUserProfile(u);
            return { username: u, qrUrl: String(p?.paymentQrUrl || "").trim() };
          } catch {
            return { username: u, qrUrl: "" };
          }
        })
      );
      return profiles;
    };
    view.replaceChildren(renderCheckout({
      cartItems: checkoutItems,
      subtotal: checkoutItems.reduce((sum, it) => sum + Number(it?.lineTotal || 0), 0),
      onValidateDiscount: ({ code, subtotal }) => validateDiscountCode({ code, subtotal }),
      onLoadSellerPaymentQrs: getSellerQrList,
      onSubmit: (order) => {
        if (!canBuy()) {
          toast("Login + verified student ID required to buy");
          return;
        }
        placeOrder({
          ...order,
          items: checkoutItems.map((it) => ({
            productId: it.product.id,
            qty: it.qty,
            lineTotal: it.lineTotal,
          })),
        })
          .then(() => {
            if (!buyNowProduct) {
              cart.clear();
              persistCartIfLoggedIn();
            }
            updateCartBadge();
            closeDrawer();
            toast("Order placed!");
            location.hash = "#/";
            alert(
              order.deliveryType === "direct"
                ? `Đặt hàng thành công\n\nHình thức: Giao dịch trực tiếp\nHọ tên: ${order.name}\nMSSV: ${order.studentId}\nNgày giao dịch: ${order.transactionDate}\nĐịa điểm: ${order.transactionPlace}\nTổng: ${currencyVND(order.total)}\n\nCảm ơn bạn!`
                : `Đặt hàng thành công\n\nHình thức: ${order.payment === "BANK_QR" ? "Shipper - Chuyển khoản QR" : "Shipper - COD"}\nHọ tên: ${order.name}\nSĐT: ${order.phone}\nĐịa chỉ: ${order.address}\nTổng: ${currencyVND(order.total)}\n\nCảm ơn bạn!`
            );
          })
          .catch((err) => toast(err?.message || "Đặt hàng thất bại"));
      },
      onOpenCart: openDrawer,
    }));
    return;
  }

  if (first === "admin") {
    view.replaceChildren(
      renderAdmin({
        onSubmit: async (payload) => {
          if (!canSell()) {
            toast("Only admin or verified student can add/update products");
            return;
          }
          let res = null;
          try {
            res = await upsertProduct(payload);
          } catch (err) {
            // Some networks fail on response phase even when backend has already created the product.
            if (String(err?.message || "").toLowerCase().includes("failed to fetch")) {
              try {
                await loadCatalog();
                const matched = products.some((p) => looksLikeSameProduct(p, payload));
                if (matched) {
                  render();
                  toast("Đăng sản phẩm thành công");
                  return;
                }
              } catch {
                // Fall back to error toast below.
              }
            }
            toast(`Đăng sản phẩm thất bại: ${err?.message || "unknown error"}`);
            return;
          }

          try {
            await loadCatalog();
            render();
          } catch {
            // Product may already be created successfully even if refresh fails.
            render();
            toast("Đăng sản phẩm thành công, nhưng chưa thể tải lại danh sách");
            return;
          }

          toast(res?.mode === "updated" ? "Cập nhật sản phẩm thành công" : "Đăng sản phẩm thành công");
        },
        onCancel: () => (location.hash = "#/"),
        onError: (message) => toast(message),
      })
    );
    return;
  }

  if (first === "edit-product" && second) {
    const id = Number(second);
    const p = products.find((x) => x.id === id);
    if (!p) {
      view.replaceChildren(renderNotFound());
      return;
    }
    if (!canDeleteProduct(p)) {
      view.replaceChildren(
        el("div", { class: "panel", style: "margin-top:14px" }, [
          el("div", { class: "pageTitle" }, ["Forbidden"]),
          el("div", { class: "muted" }, ["Only owner (verified) or admin can edit this product."]),
        ])
      );
      return;
    }
    view.replaceChildren(
      renderAdmin({
        title: "Sửa sản phẩm",
        submitLabel: "Cập nhật",
        initialData: p,
        onSubmit: async (payload) => {
          try {
            const res = await updateProduct(id, payload);
            await loadCatalog();
            if (res?.mode === "deleted") {
              toast("Sản phẩm đã được xóa vì số lượng bằng 0");
              location.hash = "#/";
              return;
            }
            toast("Cập nhật sản phẩm thành công");
            location.hash = `#/product/${id}`;
          } catch (err) {
            toast(err?.message || "Cập nhật sản phẩm thất bại");
          }
        },
        onCancel: () => (location.hash = `#/product/${id}`),
        onError: (message) => toast(message),
      })
    );
    return;
  }

  if (first === "login") {
    view.replaceChildren(
      renderLogin({
        onSubmit: async (payload) => {
          try {
            const data = await loginUser(payload);
            localStorage.setItem("shopee_auth_token", data.token);
            await refreshCurrentUser();
            toast("Logged in");
            location.hash = "#/";
          } catch (err) {
            toast(err?.message || "Login failed");
          }
        },
        onGoRegister: () => (location.hash = "#/register"),
      })
    );
    return;
  }

  if (first === "register") {
    view.replaceChildren(
      renderRegister({
        onSubmit: async (payload) => {
          try {
            await registerUser(payload);
            toast("Registered. Please login.");
            location.hash = "#/login";
          } catch (err) {
            toast(err?.message || "Register failed");
          }
        },
        onGoLogin: () => (location.hash = "#/login"),
      })
    );
    return;
  }

  if (first === "forgot-password") {
    view.replaceChildren(
      renderForgotPassword({
        onSubmit: async (email) => {
          try {
            await forgotPassword(email);
            toast("Mã khôi phục đã được gửi về email của bạn");
            location.hash = `#/reset-password?email=${encodeURIComponent(email)}`;
          } catch (err) {
            toast(err?.message || "Yêu cầu thất bại");
          }
        },
        onBack: () => (location.hash = "#/login"),
      })
    );
    return;
  }

  if (first === "reset-password") {
    const email = searchParams.get("email") || "";
    view.replaceChildren(
      renderResetPassword({
        email,
        onSubmit: async (payload) => {
          try {
            await resetPassword(payload);
            toast("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
            location.hash = "#/login";
          } catch (err) {
            toast(err?.message || "Đặt lại mật khẩu thất bại");
          }
        },
        onBack: () => (location.hash = "#/login"),
      })
    );
    return;
  }

  if (first === "posting-guide") {
    if (!currentUser) {
      location.hash = "#/login";
      return;
    }
    view.replaceChildren(renderPostingGuide());
    return;
  }

  if (first === "orders") {
    if (!currentUser) {
      location.hash = "#/login";
      return;
    }
    view.replaceChildren(el("div", { class: "muted", style: "padding:14px" }, ["Đang tải đơn hàng…"]));
    const role = currentUser.role === "admin" ? "admin" : "buyer";
    const loader = role === "admin"
      ? fetchAdminOrders
      : fetchMyOrders;
    const roleKey = currentUser.role === "admin" ? "admin" : "buyer";

    Promise.resolve(loader())
      .then((orders) => {
        view.replaceChildren(
          renderOrdersPage({
            role: roleKey,
            orders,
            onBack: () => (location.hash = "#/"),
            onRefresh: () => render(),
            onUpdateStatus: async (orderId, productId, status) => {
              try {
                await updateOrderStatus(orderId, { productId, status });
                toast("Đã cập nhật trạng thái");
                render();
              } catch (err) {
                toast(err?.message || "Cập nhật trạng thái thất bại");
              }
            },
          })
        );
      })
      .catch((err) => {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Không tải được đơn hàng"]),
            el("div", { class: "muted" }, [String(err?.message || err)]),
          ])
        );
      });
    return;
  }

  if (first === "seller-orders") {
    if (!currentUser) {
      location.hash = "#/login";
      return;
    }
    view.replaceChildren(el("div", { class: "muted", style: "padding:14px" }, ["Đang tải đơn hàng người bán…"]));
    fetchSellerOrders()
      .then((orders) => {
        view.replaceChildren(
          renderOrdersPage({
            role: "seller",
            orders,
            onBack: () => (location.hash = "#/"),
            onRefresh: () => render(),
            onUpdateStatus: async (orderId, productId, status) => {
              try {
                await updateOrderStatus(orderId, { productId, status });
                toast("Đã cập nhật trạng thái");
                render();
              } catch (err) {
                toast(err?.message || "Cập nhật trạng thái thất bại");
              }
            },
          })
        );
      })
      .catch((err) => {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Không tải được đơn hàng"]),
            el("div", { class: "muted" }, [String(err?.message || err)]),
          ])
        );
      });
    return;
  }

  if (first === "returns") {
    if (!currentUser) {
      location.hash = "#/login";
      return;
    }
    view.replaceChildren(el("div", { class: "muted", style: "padding:14px" }, ["Đang tải đơn hàng…"]));
    fetchMyOrders()
      .then((orders) => {
        view.replaceChildren(
          renderReturnsRequest({
            orders,
            products,
            onRequestRefund: (payload) =>
              submitRefund(payload)
                .then(() => {
                  toast("Đã gửi yêu cầu hoàn trả. Người bán sẽ nhận email thông báo.");
                })
                .catch((err) => {
                  toast(err?.message || "Gửi yêu cầu hoàn trả thất bại.");
                  return Promise.reject(err);
                }),
          })
        );
      })
      .catch((err) => {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Hoàn trả"]),
            el("div", { class: "muted" }, [String(err?.message || err)]),
          ])
        );
      });
    return;
  }

  if (first === "manage-accounts") {
    if (!currentUser || currentUser.role !== "admin") {
      view.replaceChildren(
        el("div", { class: "panel", style: "margin-top:14px" }, [
          el("div", { class: "pageTitle" }, ["Admin only"]),
          el("div", { class: "muted" }, ["Login as admin to manage user accounts."]),
        ])
      );
      return;
    }
    fetchStandardUsers()
      .then((users) => {
        view.replaceChildren(
          renderManageAccounts({
            users,
            onViewProfile: (username) => {
              location.hash = `#/account/${encodeURIComponent(username)}`;
            },
            onDelete: async (username) => {
              if (!window.confirm(`Delete user "${username}" and their products? This cannot be undone.`)) return;
              try {
                await deleteUserAsAdmin(username);
                toast("Account deleted");
                await loadCatalog();
                location.hash = "#/manage-accounts";
                render();
              } catch (err) {
                toast(err?.message || "Delete failed");
              }
            },
          })
        );
      })
      .catch((err) => {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Cannot load accounts"]),
            el("div", { class: "muted" }, [String(err?.message || err)]),
          ])
        );
      });
    return;
  }

  if (first === "discount-codes") {
    if (!currentUser || currentUser.role !== "admin") {
      view.replaceChildren(
        el("div", { class: "panel", style: "margin-top:14px" }, [
          el("div", { class: "pageTitle" }, ["Admin only"]),
          el("div", { class: "muted" }, ["Chỉ admin mới quản lý mã giảm giá."]),
        ])
      );
      return;
    }
    view.replaceChildren(renderDiscountCodesAdminPage());
    return;
  }

  if (first === "verify-student") {
    if (!currentUser || currentUser.role !== "admin") {
      view.replaceChildren(
        el("div", { class: "panel", style: "margin-top:14px" }, [
          el("div", { class: "pageTitle" }, ["Admin only"]),
          el("div", { class: "muted" }, ["Login as admin to verify student IDs."]),
        ])
      );
      return;
    }
    fetchPendingUsers()
      .then((users) => {
        view.replaceChildren(
          renderVerifyQueue({
            users,
            onVerify: async (username, valid) => {
              try {
                await verifyStudent({ username, valid });
                toast("Student verification updated");
                location.hash = "#/verify-student";
                render();
              } catch (err) {
                toast(err?.message || "Verify failed");
              }
            },
          })
        );
      })
      .catch((err) => {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Cannot load pending users"]),
            el("div", { class: "muted" }, [String(err?.message || err)]),
          ])
        );
      });
    return;
  }

  if (first === "my-account") {
    if (!currentUser) {
      location.hash = "#/login";
      return;
    }
    fetchUserProfile(currentUser.username)
      .then((profile) => {
        view.replaceChildren(
          renderAccountProfile({
            profile,
            title: "My account",
            onBack: () => (history.length > 1 ? history.back() : (location.hash = "#/")),
            onToast: (m, type) => toast(m, type),
            onRequestVerification: async () => {
              await requestVerification();
            }
          })
        );
        const panel = view.querySelector(".panel");
        if (panel) {
          const editBtn = el("button", { class: "btn btn--primary", type: "button", style: "margin-top:10px" }, ["Chỉnh sửa thông tin cá nhân"]);
          editBtn.addEventListener("click", () => {
            location.hash = "#/edit-account";
          });
          panel.appendChild(editBtn);
        }
      })
      .catch((err) => {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Cannot load account"]),
            el("div", { class: "muted" }, [String(err?.message || err)]),
          ])
        );
      });
    return;
  }

  if (first === "edit-account") {
    if (!currentUser) {
      location.hash = "#/login";
      return;
    }
    fetchUserProfile(currentUser.username)
      .then((profile) => {
        view.replaceChildren(
          renderEditAccount({
            profile,
            onCancel: () => (location.hash = "#/my-account"),
            onSubmit: async (payload) => {
              try {
                await updateMe(payload);
                await refreshCurrentUser();
                toast("Cập nhật tài khoản thành công");
                location.hash = "#/my-account";
              } catch (err) {
                toast(err?.message || "Cập nhật tài khoản thất bại");
              }
            },
          })
        );
      })
      .catch((err) => {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Cannot load account"]),
            el("div", { class: "muted" }, [String(err?.message || err)]),
          ])
        );
      });
    return;
  }

  if (first === "account" && second) {
    const username = decodeURIComponent(second);
    fetchUserProfile(username)
      .then((profile) => {
        view.replaceChildren(
          renderAccountProfile({
            profile,
            title: "Seller account",
            onBack: () => (history.length > 1 ? history.back() : (location.hash = "#/")),
            onToast: (m) => toast(m),
          })
        );
      })
      .catch((err) => {
        view.replaceChildren(
          el("div", { class: "panel", style: "margin-top:14px" }, [
            el("div", { class: "pageTitle" }, ["Cannot load seller account"]),
            el("div", { class: "muted" }, [String(err?.message || err)]),
          ])
        );
      });
    return;
  }

  view.replaceChildren(renderNotFound());
}

// Header interactions
const topbarRow = document.querySelector(".topbar__row");
if (topbarRow) {
  topbarRow.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    // Only reload if clicking the logo (brand)
    if (t.closest(".brand")) {
      // Let the anchor's own onclick handle reload logic
      return;
    }
    // Allow default for <a> links (login/register)
    if (t.closest("a[href]")) return;
    // Prevent reload for all other navbar clicks
    e.preventDefault();
  });
}

if (searchToggleButton) {
  searchToggleButton.addEventListener("click", () => {
    setMobileSearchOpen(!document.body.classList.contains("mobile-search-open"));
  });
}

if (messagesButton) {
  messagesButton.addEventListener("click", () => {
    if (!currentUser) {
      location.hash = "#/login";
      return;
    }
    if (!canBuy()) {
      toast("Chỉ tài khoản đã được xác minh mới có thể chat!");
      return;
    }
    location.hash = "#/messages";
  });
}

cartButton.addEventListener("click", () => openDrawer());
cartDrawer.addEventListener("click", (e) => {
  const target = e.target;
  if (target && target.matches("[data-close-drawer]")) closeDrawer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDrawer();
    closeAccountMenu();
    setMobileSearchOpen(false);
  }
});
clearCartBtn.addEventListener("click", () => {
  cart.clear();
  persistCartIfLoggedIn();
  renderCartDrawer();
  updateCartBadge();
  toast("Cart cleared");
});
logoutButton.addEventListener("click", async () => {
  try {
    await logoutUser();
  } catch {
    // Still clear client session and reload.
  }
  cart.clear();
  localStorage.removeItem("shopee_auth_token");
  currentUser = null;
  syncCartScope();
  closeAccountMenu();
  location.reload();
});
if (accountViewLink) {
  accountViewLink.addEventListener("click", () => closeAccountMenu());
}
if (accountPostingGuideLink) {
  accountPostingGuideLink.addEventListener("click", () => closeAccountMenu());
}
if (accountReturnsLink) {
  accountReturnsLink.addEventListener("click", () => closeAccountMenu());
}
if (accountOrdersLink) {
  accountOrdersLink.addEventListener("click", () => closeAccountMenu());
}
if (accountManageAccountsLink) {
  accountManageAccountsLink.addEventListener("click", () => closeAccountMenu());
}
if (accountDiscountCodesLink) {
  accountDiscountCodesLink.addEventListener("click", () => closeAccountMenu());
}
accountButton.addEventListener("click", () => {
  accountDropdown.hidden = !accountDropdown.hidden;
});
document.addEventListener("click", (e) => {
  if (!accountDropdown || !accountButton) return;
  const target = e.target;
  if (!(target instanceof Node)) return;
  if (accountDropdown.hidden) return;
  if (accountDropdown.contains(target) || accountButton.contains(target)) return;
  closeAccountMenu();
});

const debouncedRouteUpdate = debounce(() => {
  const q = searchInput.value || "";
  const { parts } = getRoute();
  if (parts[0] === "lost-found" && parts[1] === "new") return;
  if (parts[0] === "lost-found") {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const next = `#/lost-found${params.toString() ? "?" + params.toString() : ""}`;
    if (location.hash !== next) location.hash = next;
    return;
  }
  state.q = q;
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (state.selectedCategory !== "All") params.set("cat", state.selectedCategory);
  const next = `#/${params.toString() ? "?" + params.toString() : ""}`;
  if (location.hash !== next) location.hash = next;
}, 250);

searchInput.addEventListener("input", () => debouncedRouteUpdate());
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = searchInput.value || "";
  const { parts } = getRoute();
  if (parts[0] === "lost-found" && parts[1] === "new") return;
  if (parts[0] === "lost-found") {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    location.hash = `#/lost-found${params.toString() ? "?" + params.toString() : ""}`;
    return;
  }
  setQuery(q);
  if (isMobileViewport()) setMobileSearchOpen(false);
});

window.addEventListener("hashchange", () => {
  setMobileSearchOpen(false);
  render();
});

// initial
Promise.all([loadCatalog(), refreshCurrentUser()])
  .then(() => render())
  .catch((err) => {
    view.replaceChildren(
      el("div", { class: "panel", style: "margin-top:14px" }, [
        el("div", { class: "pageTitle" }, ["Cannot load products from MongoDB API"]),
        el("div", { class: "muted" }, [String(err?.message || err)]),
        el("div", { class: "muted", style: "margin-top:8px" }, [
          "Start backend API at http://127.0.0.1:8000, then refresh this page.",
        ]),
      ])
    );
  });

// avoid unused imports being tree-shaken in some editors
void clamp;
void escapeHtml;
void formatRating;
