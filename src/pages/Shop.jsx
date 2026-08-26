import {
  useMemo,
  useState
} from "react";

import ProductCard from "../components/ProductCard";

import {
  categories
} from "../data/products";

export default function Shop({
  user,
  onAdd,
  products = [],
  wishlistIds = [],
  onToggleWishlist
}) {
  const [cat, setCat] =
    useState("All");

  const [query, setQuery] =
    useState("");

  const [sort, setSort] =
    useState("featured");

  const [stock, setStock] =
    useState("all");

  const list = useMemo(() => {
    const search =
      query
        .trim()
        .toLowerCase();

    let result =
      products.filter(
        (product) => {
          const text =
            `${product.name} ${
              product.category
            } ${
              product.description
            }`.toLowerCase();

          const matchesQuery =
            !search ||
            text.includes(search);

          const matchesCategory =
            cat === "All" ||
            product.category === cat;

          const matchesStock =
            stock === "all" ||
            (
              stock ===
              "available" &&
              Number(product.stock) > 0
            ) ||
            (
              stock === "out" &&
              Number(product.stock) <= 0
            );

          return (
            matchesQuery &&
            matchesCategory &&
            matchesStock
          );
        }
      );

    result = [...result];

    if (sort === "low") {
      result.sort(
        (a, b) =>
          Number(a.price) -
          Number(b.price)
      );
    }

    if (sort === "high") {
      result.sort(
        (a, b) =>
          Number(b.price) -
          Number(a.price)
      );
    }

    if (sort === "rating") {
      result.sort(
        (a, b) =>
          Number(b.rating) -
          Number(a.rating)
      );
    }

    if (sort === "name") {
      result.sort((a, b) =>
        String(a.name).localeCompare(
          String(b.name)
        )
      );
    }

    return result;
  }, [
    products,
    query,
    cat,
    sort,
    stock
  ]);

  const clearFilters = () => {
    setQuery("");
    setCat("All");
    setStock("all");
    setSort("featured");
  };

  return (
    <main className="page shop-page">

      {/* HEADER */}
      <div className="shop-heading">

        <div className="heading">
          <span className="eyebrow">
            THE COLLECTION
          </span>

          <h1>
            Find your little
            forever piece.
          </h1>

          <p>
            Browse handmade pieces
            by mood, category and
            price. Every item is made
            slowly and packed with
            care.
          </p>
        </div>

        <div className="shop-result-count">
          <b>
            {list.length}
          </b>

          <span>
            {list.length === 1
              ? "piece"
              : "pieces"}{" "}
            found
          </span>
        </div>

      </div>

      {/* SEARCH / SORT */}
      <div className="shop-toolbar">

        <div className="search-wrap">
          <span>⌕</span>

          <input
            value={query}
            onChange={(e) =>
              setQuery(
                e.target.value
              )
            }
            placeholder="Search flowers, plushies, charms..."
            aria-label="Search products"
          />
        </div>

        <select
          value={sort}
          onChange={(e) =>
            setSort(
              e.target.value
            )
          }
          aria-label="Sort products"
        >
          <option value="featured">
            Featured
          </option>

          <option value="low">
            Price: low to high
          </option>

          <option value="high">
            Price: high to low
          </option>

          <option value="rating">
            Top rated
          </option>

          <option value="name">
            Name A–Z
          </option>
        </select>

      </div>

      {/* FILTERS */}
      <div className="shop-filters">

        <div className="filter-scroll">

          {[
            "All",
            ...categories.filter(
              (c) => c !== "All"
            )
          ].map((category) => (
            <button
              type="button"
              className={
                cat === category
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCat(category)
              }
              key={category}
            >
              {category}
            </button>
          ))}

        </div>

        <div className="stock-filters">

          <button
            type="button"
            className={
              stock === "all"
                ? "active"
                : ""
            }
            onClick={() =>
              setStock("all")
            }
          >
            All stock
          </button>

          <button
            type="button"
            className={
              stock === "available"
                ? "active"
                : ""
            }
            onClick={() =>
              setStock(
                "available"
              )
            }
          >
            Available
          </button>

          <button
            type="button"
            className={
              stock === "out"
                ? "active"
                : ""
            }
            onClick={() =>
              setStock("out")
            }
          >
            Sold out
          </button>

        </div>

      </div>

      {/* PRODUCTS */}
      {list.length > 0 ? (
        <div className="grid product-grid">

          {list.map(
            (product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={onAdd}
                user={user}
                wishlistIds={
                  wishlistIds
                }
                onToggleWishlist={
                  onToggleWishlist
                }
              />
            )
          )}

        </div>
      ) : (
        <div className="shop-empty">

          <div>⌕</div>

          <h2>
            No knots found.
          </h2>

          <p>
            Try a different search
            or clear your filters.
          </p>

          <button
            type="button"
            className="btn ghost"
            onClick={
              clearFilters
            }
          >
            Clear filters
          </button>

        </div>
      )}

    </main>
  );
}