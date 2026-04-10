import { currencyPHP, clamp, debounce, el, escapeHtml, formatRating } from "./lib/ui.js";
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
} from "./views/views.js";
import {
  fetchProducts,
  fetchCategories,
  upsertProduct,
  deleteProduct,
  registerUser,
  loginUser,
  fetchMe,
  logoutUser,
  verifyStudent,
  fetchPendingUsers,
  placeOrder,
} from "./lib/api.js";

const cart = new CartStore("shopee_clone_cart_v1");

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
const addProductButton = document.getElementById("addProductButton");

const toastHost = document.getElementById("toastHost");

year.textContent = String(new Date().getFullYear());

let products = [];
let categories = [];
let currentUser = null;

const state = {
  selectedCategory: "All",
  q: "",
};

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
  updateAuthUI();
}

function canSell() {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  return !!currentUser.studentVerified;
}

function canBuy() {
  return canSell();
}

function canDeleteProduct(p) {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  return !!currentUser.studentVerified && p.ownerUsername === currentUser.username;
}

function updateAuthUI() {
  if (!currentUser) {
    authStatus.textContent = "Account";
    accountLoginLink.hidden = false;
    accountRegisterLink.hidden = false;
    accountAdminVerifyLink.hidden = true;
    logoutButton.hidden = true;
    if (addProductButton) addProductButton.hidden = true;
    return;
  }
  authStatus.textContent = currentUser.username;
  accountLoginLink.hidden = true;
  accountRegisterLink.hidden = true;
  accountAdminVerifyLink.hidden = currentUser.role !== "admin";
  logoutButton.hidden = false;
  if (addProductButton) addProductButton.hidden = !canSell();
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
    renderCartDrawer();
    updateCartBadge();
    toast("Removed from cart");
  });
  top.appendChild(removeBtn);

  const bottom = el("div", { class: "cartItem__bottom" });
  bottom.appendChild(el("div", { class: "price" }, [currencyPHP(p.price)]));
  const controls = el("div", { class: "cartItem__controls" });
  const minus = el("button", { class: "cartItem__miniBtn", type: "button" }, ["−"]);
  const plus = el("button", { class: "cartItem__miniBtn", type: "button" }, ["+"]);
  const qty = el("div", { class: "qty__value" }, [String(item.qty)]);
  minus.addEventListener("click", () => {
    cart.setQty(p.id, item.qty - 1);
    renderCartDrawer();
    updateCartBadge();
  });
  plus.addEventListener("click", () => {
    cart.setQty(p.id, item.qty + 1);
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
  cartSubtotal.textContent = currencyPHP(cart.subtotal(products));
}

function render() {
  const { parts, searchParams } = getRoute();

  const q = searchParams.get("q") || "";
  const cat = searchParams.get("cat") || "All";
  state.q = q;
  state.selectedCategory = categories.includes(cat) ? cat : "All";

  searchInput.value = state.q;
  renderCategories();

  const [first, second] = parts;
  if (!first) {
    const list = filteredProducts();
    view.replaceChildren(renderHome({
      products: list,
      q: state.q,
      category: state.selectedCategory,
      onOpen: (id) => (location.hash = `#/product/${id}`),
      onAdd: (id) => {
        if (!canBuy()) {
          toast("Login + verified student ID required to buy");
          return;
        }
        cart.addItem(id, 1);
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
      canDeleteProduct,
    }));
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
        cart.addItem(p.id, qty);
        updateCartBadge();
        toast("Added to cart", { label: "Checkout", onClick: () => (location.hash = "#/checkout") });
      },
      canBuy: canBuy(),
      canDelete: canDeleteProduct(p),
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
      onBack: () => history.length > 1 ? history.back() : (location.hash = "#/"),
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
            updateCartBadge();
            closeDrawer();
            toast("Order placed!");
            location.hash = "#/";
            alert(
              `Order confirmed\n\nName: ${order.name}\nAddress: ${order.address}\nPayment: ${order.payment}\nTotal: ${currencyPHP(order.total)}\n\nThank you!`
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
          try {
            const res = await upsertProduct(payload);
            await loadCatalog();
            render();
            toast(`Product ${res.mode}`);
          } catch (err) {
            toast(err?.message || "Failed to save product");
          }
        },
        onCancel: () => (location.hash = "#/"),
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

  view.replaceChildren(renderNotFound());
}

// Header interactions
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
  renderCartDrawer();
  updateCartBadge();
  toast("Cart cleared");
});
logoutButton.addEventListener("click", async () => {
  await logoutUser();
  localStorage.removeItem("shopee_auth_token");
  currentUser = null;
  updateAuthUI();
  toast("Logged out");
  location.hash = "#/";
  closeAccountMenu();
});
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
  setQuery(searchInput.value || "");
});

window.addEventListener("hashchange", render);

// initial
updateCartBadge();
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
