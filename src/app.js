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
} from "./lib/api.js";

const cart = new CartStore("shopee_clone_cart_guest");

const view = document.getElementById("view");
const categoryBar = document.getElementById("categoryBar");
const year = document.getElementById("year");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

const cartDrawer = document.getElementById("cartDrawer");
const cartButton = document.getElementById("cartButton");
const cartDrawerBody = document.getElementById("cartDrawerBody");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartCountBadge = document.getElementById("cartCountBadge");
const clearCartBtn = document.getElementById("clearCartBtn");
const authStatus = document.getElementById("authStatus");
const logoutButton = document.getElementById("logoutButton");
const accountButton = document.getElementById("accountButton");
const accountDropdown = document.getElementById("accountDropdown");
const accountLoginLink = document.getElementById("accountLoginLink");
const accountRegisterLink = document.getElementById("accountRegisterLink");
const accountAdminVerifyLink = document.getElementById("accountAdminVerifyLink");
const accountManageAccountsLink = document.getElementById("accountManageAccountsLink");
const accountViewLink = document.getElementById("accountViewLink");
const accountPostingGuideLink = document.getElementById("accountPostingGuideLink");
const accountReturnsLink = document.getElementById("accountReturnsLink");
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
};

function isLostFoundRoute() {
  const { parts } = getRoute();
  return parts[0] === "lost-found";
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
      if (lab) lab.textContent = "Đăng bài";
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
    : "Search products, brands and more…";
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
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (cat !== "All") params.set("cat", cat);
  location.hash = `#/${params.toString() ? "?" + params.toString() : ""}`;
}

function filteredProducts() {
  const q = state.q.trim().toLowerCase();
  return products.filter((p) => {
    if (state.selectedCategory !== "All" && p.category !== state.selectedCategory) return false;
    if (!q) return true;
    const hay = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
    return hay.includes(q);
  });
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
  if (!currentUser) return "Login to buy";
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
    authStatus.textContent = "Account";
    accountLoginLink.hidden = false;
    accountRegisterLink.hidden = false;
    accountViewLink.hidden = true;
    accountPostingGuideLink.hidden = true;
    if (accountReturnsLink) accountReturnsLink.hidden = true;
    accountAdminVerifyLink.hidden = true;
    if (accountManageAccountsLink) accountManageAccountsLink.hidden = true;
    logoutButton.hidden = true;
    cart.clear();
    closeDrawer();
    updateCartBadge();
    applyTopBarMode();
    return;
  }
  authStatus.textContent = currentUser.username;
  accountLoginLink.hidden = true;
  accountRegisterLink.hidden = true;
  accountViewLink.hidden = false;
  accountPostingGuideLink.hidden = false;
  if (accountReturnsLink) accountReturnsLink.hidden = false;
  accountAdminVerifyLink.hidden = currentUser.role !== "admin";
  if (accountManageAccountsLink) accountManageAccountsLink.hidden = currentUser.role !== "admin";
  logoutButton.hidden = false;
  updateCartBadge();
  applyTopBarMode();
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

function renderCategories() {
  categoryBar.replaceChildren();
  const all = ["All", ...categories];
  all.forEach((cat) => {
    const btn = el("button", {
      class: `chip ${state.selectedCategory === cat ? "chip--active" : ""}`,
      type: "button",
    }, [cat]);
    btn.addEventListener("click", () => setCategory(cat));
    categoryBar.appendChild(btn);
  });
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
      el("div", { class: "pageTitle" }, ["Cart is empty"]),
      el("div", { class: "muted" }, ["Add some products from the home page."]),
      el("div", { style: "margin-top:12px" }, [
        el("button", { class: "btn btn--primary", type: "button" }, ["Browse products"]),
      ]),
    ]));
    cartDrawerBody.querySelector("button").addEventListener("click", () => {
      closeDrawer();
      location.hash = "#/";
    });
  } else {
    items.forEach((it) => cartDrawerBody.appendChild(cartItemRow(it)));
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
          toast("Login + verified student ID required to buy");
          return;
        }
        const current = inCartQty(p.id);
        const stock = stockForProduct(p.id);
        const canAdd = Math.max(0, stock - current);
        if (canAdd <= 0) {
          toast("This product is already at max quantity in your cart");
          return;
        }
        const appliedQty = Math.min(qty, canAdd);
        if (appliedQty < qty) toast(`Only ${appliedQty} item(s) can be added due to stock limit`);
        cart.addItem(p.id, appliedQty);
        persistCartIfLoggedIn();
        updateCartBadge();
        toast("Added to cart", { label: "Checkout", onClick: () => (location.hash = "#/checkout") });
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
    }));
    return;
  }

  if (first === "checkout") {
    view.replaceChildren(renderCheckout({
      cartItems: cart.itemsDetailed(products),
      subtotal: cart.subtotal(products),
      onSubmit: (order) => {
        if (!canBuy()) {
          toast("Login + verified student ID required to buy");
          return;
        }
        placeOrder({
          ...order,
          items: cart.itemsDetailed(products).map((it) => ({
            productId: it.product.id,
            qty: it.qty,
            lineTotal: it.lineTotal,
          })),
        })
          .then(() => {
            cart.clear();
            persistCartIfLoggedIn();
            updateCartBadge();
            closeDrawer();
            toast("Order placed!");
            location.hash = "#/";
            alert(
              order.deliveryType === "direct"
                ? `Đặt hàng thành công\n\nHình thức: Giao dịch trực tiếp\nHọ tên: ${order.name}\nMSSV: ${order.studentId}\nNgày giao dịch: ${order.transactionDate}\nĐịa điểm: ${order.transactionPlace}\nTổng: ${currencyVND(order.total)}\n\nCảm ơn bạn!`
                : `Đặt hàng thành công\n\nHình thức: Giao hàng qua shipper\nHọ tên: ${order.name}\nSĐT: ${order.phone}\nĐịa chỉ: ${order.address}\nThanh toán: ${order.payment}\nTổng: ${currencyVND(order.total)}\n\nCảm ơn bạn!`
            );
          })
          .catch((err) => toast(err?.message || "Order failed"));
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
        title: "Edit Product",
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

  if (first === "posting-guide") {
    if (!currentUser) {
      location.hash = "#/login";
      return;
    }
    view.replaceChildren(renderPostingGuide());
    return;
  }

  if (first === "returns") {
    if (!currentUser) {
      location.hash = "#/login";
      return;
    }
    view.replaceChildren(
      renderReturnsRequest({
        onRequestRefund: () => {
          toast("Đã ghi nhận (demo). API hoàn trả sẽ được kết nối sau.");
        },
      })
    );
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
            onToast: (m) => toast(m),
          })
        );
        const panel = view.querySelector(".panel");
        if (panel) {
          const editBtn = el("button", { class: "btn btn--primary", type: "button", style: "margin-top:10px" }, ["Edit profile"]);
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
    if (t.closest("#searchForm, .topbar__actions, .brand")) return;
    e.preventDefault();
    location.reload();
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
    if (currentUser) await saveCart([]);
  } catch {
    // Continue logout even if cart sync fails.
  }
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
if (accountManageAccountsLink) {
  accountManageAccountsLink.addEventListener("click", () => closeAccountMenu());
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
});

window.addEventListener("hashchange", render);

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
