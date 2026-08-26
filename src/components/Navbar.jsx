import { Link, NavLink } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Navbar({
  user,
  cartCount,
  onLogout
}) {
  return (
    <header className="navbar">
      <Link className="brand" to="/">
        <img
          src={logo}
          alt="Naynaknots"
        />

        <span>Naynaknots</span>
      </Link>

      <nav>
        <NavLink to="/">Home</NavLink>

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
    </header>
  );
}