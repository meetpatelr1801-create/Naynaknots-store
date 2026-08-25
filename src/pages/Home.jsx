import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";

export default function Home({ user, onAdd, products = [], wishlistIds = [], onToggleWishlist }) {
  return (
    <main>
      <section className="hero">
        <div>
          <span className="eyebrow">HANDMADE • HEARTMADE</span>
          <h1>Little knots.<br /><em>Big feelings.</em></h1>
          <p>Soft crochet pieces made slowly by hand, for gifting, collecting and keeping forever.</p>
          <div className="actions">
            <Link className="btn primary" to="/shop">Explore collection</Link>
            <Link className="btn ghost" to="/custom-order">Create your own</Link>
          </div>
        </div>
        <div className="hero-art"><div className="yarn">🧶</div><div className="note">Made one stitch<br />at a time ♡</div></div>
      </section>
      <section className="section">
        <div className="section-head"><div><span className="eyebrow">SHOP THE CUTIES</span><h2>Made to make you smile</h2></div><Link to="/shop" className="text-link">View all →</Link></div>
        <div className="grid">{products.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} user={user} wishlistIds={wishlistIds} onToggleWishlist={onToggleWishlist} />)}</div>
      </section>
      <section className="studio-banner"><div><span className="eyebrow">YOUR IDEA, OUR YARN</span><h2>Can't find exactly what you imagined?</h2><p>Build a custom piece with your colour, size, occasion and little details.</p><Link className="btn primary" to="/custom-order">Open Knot Studio</Link></div><div className="flower">✿<br />♡<br />✿</div></section>
    </main>
  );
}
