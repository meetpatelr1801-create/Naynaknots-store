import { Link, useParams } from "react-router-dom";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

function getImageUrl(url) {
  if (!url) return "";

  const value = String(url).trim();

  if (!value) return "";

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_BASE}${value}`;
  }

  return value;
}

export default function ProductDetails({
  user,
  onAdd,
  products = [],
  wishlistIds = [],
  onToggleWishlist
}) {
  const { id } = useParams();

  const product = products.find(
    (item) =>
      Number(item.id) === Number(id)
  );

  if (!product) {
    return (
      <main className="page detail-not-found">
        <div>
          <span className="eyebrow">
            COLLECTION
          </span>

          <h1>
            Product not found
          </h1>

          <p>
            This product may have been
            removed or is no longer
            available.
          </p>

          <Link
            className="btn primary"
            to="/shop"
          >
            ← Back to shop
          </Link>
        </div>
      </main>
    );
  }

  const saved =
    wishlistIds.includes(
      Number(product.id)
    );

  const out =
    Number(product.stock) <= 0;

  const imageUrl =
    getImageUrl(product.image);

  return (
    <main className="page product-detail-page">

      {/* BREADCRUMB */}
      <div className="detail-breadcrumb">
        <Link to="/">
          Home
        </Link>

        <span> / </span>

        <Link to="/shop">
          Shop
        </Link>

        <span> / </span>

        <span>
          {product.name}
        </span>
      </div>

      <div className="detail">

        {/* IMAGE */}
        <div className="detail-visual">

          <div className="detail-image-wrap">

            {imageUrl ? (
              <img
                className="detail-image"
                src={imageUrl}
                alt={product.name}
                onError={(e) => {
                  e.currentTarget.style.display =
                    "none";

                  e.currentTarget.parentElement.classList.add(
                    "image-error"
                  );
                }}
              />
            ) : (
              <div className="detail-image-placeholder">
                <span>🧶</span>

                <small>
                  Image unavailable
                </small>
              </div>
            )}

            {out && (
              <span className="detail-sold-label">
                Sold out
              </span>
            )}

          </div>

          {/* WISHLIST */}
          <button
            type="button"
            className={`detail-wish ${
              saved ? "saved" : ""
            }`}
            onClick={() =>
              onToggleWishlist?.(
                product.id
              )
            }
          >
            {saved
              ? "♥ Saved to wishlist"
              : "♡ Save to wishlist"}
          </button>

        </div>

        {/* INFORMATION */}
        <div className="detail-info">

          <span className="eyebrow">
            {product.category}
          </span>

          <h1>
            {product.name}
          </h1>

          {/* RATING */}
          <div className="detail-rating">
            <span>
              ★★★★★
            </span>

            <b>
              {product.rating}
            </b>

            <span className="rating-label">
              Customer rating
            </span>
          </div>

          {/* PRICE */}
          <div className="detail-price">
            ₹{product.price}
          </div>

          {/* STOCK */}
          <div
            className={`detail-stock ${
              out ? "out" : ""
            }`}
          >
            {out ? (
              <>
                <span>
                  ●
                </span>
                Currently sold out
              </>
            ) : (
              <>
                <span>
                  ●
                </span>

                {Number(product.stock) <=
                2
                  ? `Only ${product.stock} left`
                  : `${product.stock} pieces available`}
              </>
            )}
          </div>

          {/* FULL DESCRIPTION */}
          <section className="detail-description">

            <h2>
              About this piece
            </h2>

            <p>
              {product.description}
            </p>

          </section>

          {/* PRODUCT META */}
          <div className="detail-meta">

            <div>
              <span>
                Category
              </span>

              <b>
                {product.category}
              </b>
            </div>

            <div>
              <span>
                Handmade
              </span>

              <b>
                Yes
              </b>
            </div>

            <div>
              <span>
                Availability
              </span>

              <b>
                {out
                  ? "Sold out"
                  : "In stock"}
              </b>
            </div>

          </div>

          {/* ACTION */}
          <button
            type="button"
            disabled={out}
            className="btn primary wide detail-cart-btn"
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

          <Link
            className="back"
            to="/shop"
          >
            ← Back to collection
          </Link>

        </div>

      </div>

    </main>
  );
}