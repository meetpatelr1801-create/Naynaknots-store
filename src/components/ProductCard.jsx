import { Link } from "react-router-dom";

const API_BASE =
  String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

function getImageUrl(url) {
  if (!url) return "";

  const value = String(url).trim();

  if (!value) return "";

  // Full external URL or data URL
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  // Backend uploaded image
  if (value.startsWith("/")) {
    return `${API_BASE}${value}`;
  }

  return value;
}

export default function ProductCard({
  product,
  onAdd,
  user,
  wishlistIds = [],
  onToggleWishlist
}) {
  const saved = wishlistIds.includes(
    Number(product.id)
  );

  const out =
    Number(product.stock) <= 0;

  const imageUrl =
    getImageUrl(product.image);

  return (
    <article
      className={`card product-card ${
        out ? "sold-out" : ""
      }`}
    >
      {/* IMAGE */}
      <div className="card-img">
        <Link
          className="product-image-link"
          to={`/product/${product.id}`}
          aria-label={`View ${product.name}`}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display =
                  "none";

                e.currentTarget.parentElement.classList.add(
                  "image-error"
                );
              }}
            />
          ) : (
            <div className="product-image-placeholder">
              <span>🧶</span>
              <small>
                Image unavailable
              </small>
            </div>
          )}
        </Link>

        {/* CATEGORY */}
        <span className="product-category">
          {product.category}
        </span>

        {/* WISHLIST */}
        <button
          type="button"
          className={`wish-btn ${
            saved ? "saved" : ""
          }`}
          aria-label={
            saved
              ? "Remove from wishlist"
              : "Save to wishlist"
          }
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            onToggleWishlist?.(
              product.id
            );
          }}
        >
          {saved ? "♥" : "♡"}
        </button>

        {/* SOLD OUT */}
        {out && (
          <b className="sold-label">
            Sold out
          </b>
        )}
      </div>

      {/* CONTENT */}
      <div className="card-body">
        {/* RATING */}
        <div className="rating">
          <span
            aria-label={`Rating ${product.rating} out of 5`}
          >
            ★★★★★
          </span>

          <small>
            {product.rating}
          </small>
        </div>

        {/* NAME */}
        <h3 className="product-title">
          <Link
            to={`/product/${product.id}`}
          >
            {product.name}
          </Link>
        </h3>

        {/* SHORT DESCRIPTION */}
        <p className="product-description">
          {product.description}
        </p>

        {/* PRICE */}
        <div className="product-price">
          ₹{product.price}
        </div>

        {/* ACTIONS */}
        <div className="product-actions">
          <Link
            className="view-product-btn"
            to={`/product/${product.id}`}
          >
            View product
          </Link>

          <button
            className="add-cart-btn"
            disabled={out}
            onClick={() =>
              onAdd?.(product)
            }
          >
            {out
              ? "Sold out"
              : user
              ? "Add to cart"
              : "Login to buy"}
          </button>
        </div>

        {/* LOW STOCK */}
        {!out &&
          Number(product.stock) <= 2 && (
            <small className="low-stock">
              Only {product.stock} left
            </small>
          )}
      </div>
    </article>
  );
}