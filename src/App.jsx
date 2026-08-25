import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetails from "./pages/ProductDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Cart from "./pages/Cart";
import CustomOrder from "./pages/CustomOrder";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Account from "./pages/Account";
import AdminDashboard from "./pages/admin/AdminDashboard";

function cartKey(user) { return user ? `nk_cart_${user.id}` : "nk_cart_guest"; }

export default function App() {
  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("nk_token") || ""}` });
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("nk_user") || "null"));
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("nk_token") || "");
  const [wishlistIds, setWishlistIds] = useState([]);

  useEffect(() => {
    setCart(user ? JSON.parse(localStorage.getItem(cartKey(user)) || "[]") : []);
  }, [user]);

  useEffect(() => {
    if (user) localStorage.setItem(cartKey(user), JSON.stringify(cart));
  }, [cart, user]);

  useEffect(() => {
    if (!user) { setWishlistIds([]); return; }
    fetch("/api/my/wishlist", { headers: authHeaders() })
      .then(async r => {
        if (!r.ok) throw new Error("Could not load wishlist");
        setWishlistIds(await r.json());
      })
      .catch(() => setWishlistIds([]));
  }, [user]);

  const loadProducts = async () => {
    try { const r = await fetch("/api/products"); if (r.ok) setProducts(await r.json()); } catch {}
  };
  useEffect(() => {
    loadProducts();
    const token = localStorage.getItem("nk_token");
    if (!token) return;
    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error("Session expired");
        const data = await r.json();
        setUser(data.user);
        localStorage.setItem("nk_user", JSON.stringify(data.user));
      })
      .catch(() => {
        setUser(null);
        setCart([]);
        localStorage.removeItem("nk_user");
        localStorage.removeItem("nk_token");
        setAdminToken("");
      });
  }, []);

  const login = (nextUser, token) => {
    setUser(nextUser);
    setAdminToken(token || "");
    localStorage.setItem("nk_user", JSON.stringify(nextUser));
    localStorage.setItem("nk_token", token || "");
  };

  const logout = () => {
    setUser(null); setCart([]); setAdminToken("");
    localStorage.removeItem("nk_user");
    localStorage.removeItem("nk_token");
  };

  const add = (product) => {
    if (!user) return alert("Please login or create an account before buying.");
    setCart(current => {
      const existing = current.find(item => item.id === product.id);
      return existing
        ? current.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
        : [...current, { ...product, qty: 1 }];
    });
  };

  const qty = (id, amount) => setCart(current => current.map(item => item.id === id ? { ...item, qty: item.qty + amount } : item).filter(item => item.qty > 0));

  const toggleWishlist = async (productId) => {
    if (!user) {
      alert("Please login to save products to your wishlist.");
      return;
    }
    const saved = wishlistIds.includes(Number(productId));
    try {
      const r = await fetch(`/api/my/wishlist/${productId}`, {
        method: saved ? "DELETE" : "POST",
        headers: authHeaders()
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Wishlist update failed.");
      setWishlistIds(d.productIds.map(Number));
    } catch (e) {
      alert(e.message);
    }
  };

  const order = async (createdOrder) => {
    setCart([]);
    const lines = (createdOrder?.items || []).map(item => `${item.name} x${item.qty} — ₹${item.price * item.qty}`).join("\n");
    const message = ["Hi Naynaknots! My order is ready:", `Order: ${createdOrder?.id || ""}`, lines, `Total: ₹${createdOrder?.total || 0}`].join("\n");
    window.setTimeout(() => {
      window.location.href = `https://www.instagram.com/naynaknots/?text=${encodeURIComponent(message)}`;
    }, 1200);
  };

  const custom = async (data) => {
    if (!user) return alert("Please login or create an account first.");
    try {
      const r = await fetch("/api/custom-orders", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Could not save custom request.");
      const message = ["Hi Naynaknots! I have a custom idea:", `Type: ${data.type}`, `Colour: ${data.color}`, `Size: ${data.size}`, `Occasion: ${data.occasion}`, `Idea: ${data.idea}`, `Estimated: ₹${data.price}`].join("\n");
      window.location.href = `https://www.instagram.com/naynaknots/?text=${encodeURIComponent(message)}`;
    } catch (e) { alert(e.message); }
  };

  return <BrowserRouter><a className="skip-link" href="#main-content">Skip to content</a>
    <Navbar user={user} onLogout={logout} cartCount={cart.reduce((s, x) => s + x.qty, 0)} />
    <main id="main-content"><Routes>
      <Route path="/" element={<Home user={user} onAdd={add} products={products} wishlistIds={wishlistIds} onToggleWishlist={toggleWishlist} />} />
      <Route path="/shop" element={<Shop user={user} onAdd={add} products={products} wishlistIds={wishlistIds} onToggleWishlist={toggleWishlist} />} />
      <Route path="/product/:id" element={<ProductDetails user={user} onAdd={add} products={products} wishlistIds={wishlistIds} onToggleWishlist={toggleWishlist} />} />
      <Route path="/login" element={<Login onLogin={login} />} />
      <Route path="/register" element={<Register onLogin={login} />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/account" element={<ProtectedRoute user={user}><Account user={user} wishlistIds={wishlistIds} products={products} onToggleWishlist={toggleWishlist} onProfileUpdated={(nextUser) => { setUser(nextUser); localStorage.setItem("nk_user", JSON.stringify(nextUser)); }} cartCount={cart.reduce((s, x) => s + x.qty, 0)} /></ProtectedRoute>} />
      <Route path="/custom-order" element={<ProtectedRoute user={user}><CustomOrder user={user} onCustom={custom} /></ProtectedRoute>} />
      <Route path="/cart" element={<ProtectedRoute user={user}><Cart cart={cart} onQty={qty} user={user} onOrder={order} /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute user={user} admin><AdminDashboard token={adminToken} onProductsChange={loadProducts} /></ProtectedRoute>} />
    </Routes></main>
    <Footer />
  </BrowserRouter>;
}
