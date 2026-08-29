import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Navbar({
  user,
  cartCount,
  onLogout
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className="navbar">

      {/* LOGO / BRAND */}
      <Link
        className="brand"
        to="/"
        onClick={closeMenu}
      >
        <img
          src={logo}
          alt="Naynaknots"
        />

        <span>Naynaknots</span>
      </Link>

      {/* DESKTOP NAVIGATION */}
      <nav className="desktop-nav">

        <NavLink to="/">
          Home
        </NavLink>

        <NavLink to="/shop">
          Shop
        </NavLink>

        <NavLink to="/custom-order">
          Custom
        </NavLink>

        <NavLink to="/about">
          Our Story
        </NavLink>

        <NavLink to="/contact">
          Contact
        </NavLink>

        {user?.role === "admin" && (
          <NavLink to="/admin">
            Admin
          </NavLink>
        )}

      </nav>

      {/* DESKTOP ACTIONS */}
      <div className="nav-actions">

        {user ? (
          <>
            <Link
              className="nav-btn"
              to="/account"
            >
              {user.name}
            </Link>

            <button
              type="button"
              className="nav-btn"
              onClick={onLogout}
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            className="nav-btn"
            to="/login"
          >
            Login
          </Link>
        )}

        <Link
          className="cart"
          to="/cart"
        >
          Cart <b>{cartCount}</b>
        </Link>

      </div>

      {/* MOBILE MENU BUTTON */}
      <button
        type="button"
        className={`mobile-menu-btn ${
          menuOpen ? "open" : ""
        }`}
        aria-label={
          menuOpen
            ? "Close navigation menu"
            : "Open navigation menu"
        }
        aria-expanded={menuOpen}
        onClick={() =>
          setMenuOpen(!menuOpen)
        }
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* MOBILE MENU */}
      <div
        className={`mobile-menu ${
          menuOpen ? "open" : ""
        }`}
      >

        <nav>

          <NavLink
            to="/"
            onClick={closeMenu}
          >
            Home
          </NavLink>

          <NavLink
            to="/shop"
            onClick={closeMenu}
          >
            Shop
          </NavLink>

          <NavLink
            to="/custom-order"
            onClick={closeMenu}
          >
            Custom
          </NavLink>

          <NavLink
            to="/about"
            onClick={closeMenu}
          >
            Our Story
          </NavLink>

          <NavLink
            to="/contact"
            onClick={closeMenu}
          >
            Contact
          </NavLink>

          {user?.role === "admin" && (
            <NavLink
              to="/admin"
              onClick={closeMenu}
            >
              Admin
            </NavLink>
          )}

        </nav>

        {/* MOBILE ACCOUNT ACTIONS */}
        <div className="mobile-actions">

          {user ? (
            <>
              <Link
                className="mobile-account"
                to="/account"
                onClick={closeMenu}
              >
                {user.name}
              </Link>

              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  onLogout?.();
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={closeMenu}
            >
              Login
            </Link>
          )}

          <Link
            className="mobile-cart"
            to="/cart"
            onClick={closeMenu}
          >
            Cart
            <b>{cartCount}</b>
          </Link>

        </div>

      </div>

    </header>
  );
}