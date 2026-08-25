import {Link} from "react-router-dom";

export default function ProductCard({product,onAdd,user,wishlistIds=[],onToggleWishlist}){
  const saved=wishlistIds.includes(Number(product.id));
  const out=Number(product.stock)<=0;
  return <article className={`card ${out?"sold-out":""}`}>
    <div className="card-img">
      <Link to={`/product/${product.id}`}><img src={product.image} alt={product.name}/></Link>
      <span>{product.category}</span>
      <button className={`wish-btn ${saved?"saved":""}`} aria-label={saved?"Remove from wishlist":"Save to wishlist"} onClick={()=>onToggleWishlist?.(product.id)}>{saved?"♥":"♡"}</button>
      {out&&<b className="sold-label">Sold out</b>}
    </div>
    <div className="card-body">
      <div className="rating">★★★★★ <small>{product.rating}</small></div>
      <h3><Link to={`/product/${product.id}`}>{product.name}</Link></h3>
      <p>{product.description}</p>
      <div className="card-row"><strong>₹{product.price}</strong><button disabled={out} onClick={()=>onAdd(product)}>{out?"Sold out":user?"Add to cart":"Login to buy"}</button></div>
      {!out&&Number(product.stock)<=2&&<small className="low-stock">Only {product.stock} left</small>}
    </div>
  </article>
}