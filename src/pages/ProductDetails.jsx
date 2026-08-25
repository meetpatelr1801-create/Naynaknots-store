import { Link, useParams } from "react-router-dom";

export default function ProductDetails({ user, onAdd, products = [], wishlistIds = [], onToggleWishlist }) {
  const { id } = useParams();
  const product = products.find((item) => Number(item.id) === Number(id));
  if (!product) return <main className="page"><h1>Product not found</h1><Link to="/shop">Back to shop</Link></main>;
  const saved=wishlistIds.includes(Number(product.id));
  const out=Number(product.stock)<=0;
  return <main className="page detail">
    <div className="detail-visual"><img className="detail-image" src={product.image} alt={product.name}/><button className={`detail-wish ${saved?"saved":""}`} onClick={()=>onToggleWishlist?.(product.id)}>{saved?"♥ Saved to wishlist":"♡ Save to wishlist"}</button></div>
    <div>
      <span className="eyebrow">{product.category}</span>
      <h1>{product.name}</h1>
      <div className="rating">★★★★★ {product.rating}</div>
      <div className="price">₹{product.price}</div>
      <p>{product.description}</p>
      <p className="muted">{product.stock} pieces currently available.</p>
      <button disabled={out} className="btn primary wide" onClick={() => onAdd(product)}>{out?"Sold out":user ? "Add to cart" : "Login to buy"}</button>
      <Link className="back" to="/shop">← Back to collection</Link>
    </div>
  </main>;
}