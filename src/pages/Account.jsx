import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const statusClass = (status="Placed") => `account-status status-${status.toLowerCase().replace(/\s+/g,"-")}`;

export default function Account({ user, wishlistIds=[], products=[], onToggleWishlist, onProfileUpdated, cartCount=0 }) {
  const [orders,setOrders]=useState([]);
  const [customOrders,setCustomOrders]=useState([]);
  const [profileName,setProfileName]=useState(user.name);
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const wishlist=useMemo(
    ()=>products.filter(p=>wishlistIds.includes(Number(p.id))),
    [products,wishlistIds]
  );

  const load = async () => {
    const h={Authorization:`Bearer ${localStorage.getItem("nk_token")||""}`};
    try{
      const [a,b]=await Promise.all([
        fetch("/api/my/orders",{headers:h}),
        fetch("/api/my/custom-orders",{headers:h})
      ]);
      if(!a.ok||!b.ok) throw new Error("Please login again.");
      setOrders(await a.json());
      setCustomOrders(await b.json());
    }catch(e){setError(e.message)}
  };

  useEffect(()=>{setProfileName(user.name);load()},[user.id]);

  const saveProfile=async()=>{
    if(profileName.trim().length<2){setError("Please enter a valid name.");return}
    setSaving(true);setError("");setMessage("");
    try{
      const r=await fetch("/api/my/profile",{
        method:"PATCH",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("nk_token")||""}`},
        body:JSON.stringify({name:profileName.trim()})
      });
      const d=await r.json();
      if(!r.ok) throw new Error(d.message||"Could not update profile.");
      onProfileUpdated?.(d.user);
      setEditing(false);
      setMessage("Profile updated successfully.");
    }catch(e){setError(e.message)}
    finally{setSaving(false)}
  };

  const totalSpent=orders.reduce((sum,o)=>sum+Number(o.total||0),0);

  return <main className="page account-page">
    <section className="account-hero">
      <div>
        <span className="eyebrow">MY ACCOUNT</span>
        <h1>Welcome back, <em>{user.name}</em>.</h1>
        <p>Your personal Naynaknots space — orders, custom ideas and saved pieces, all in one place.</p>
      </div>
      <div className="account-avatar">{user.name?.charAt(0).toUpperCase()}</div>
    </section>

    {error&&<div className="error account-alert">{error}</div>}
    {message&&<div className="account-success">{message}</div>}

    <section className="account-stats">
      <div><span>Orders</span><b>{orders.length}</b><small>Placed with Naynaknots</small></div>
      <div><span>Custom requests</span><b>{customOrders.length}</b><small>Your made-to-order ideas</small></div>
      <div><span>Wishlist</span><b>{wishlist.length}</b><small>Pieces you've saved</small></div>
      <div><span>Total spent</span><b>₹{totalSpent}</b><small>Across your orders</small></div>
    </section>

    <section className="account-layout">
      <div className="account-main">
        <div className="account-panel">
          <div className="account-panel-head"><div><span className="eyebrow">PROFILE</span><h2>Your details</h2></div>{!editing&&<button className="account-small-btn" onClick={()=>setEditing(true)}>Edit</button>}</div>
          {editing ? <div className="profile-edit">
            <label>Name<input value={profileName} onChange={e=>setProfileName(e.target.value)} maxLength={60}/></label>
            <label>Email<input value={user.email} disabled/></label>
            <div className="profile-actions"><button className="btn ghost" onClick={()=>{setEditing(false);setProfileName(user.name)}}>Cancel</button><button className="btn primary" onClick={saveProfile} disabled={saving}>{saving?"Saving...":"Save changes"}</button></div>
          </div> : <div className="profile-grid"><div><span>Name</span><b>{user.name}</b></div><div><span>Email</span><b>{user.email}</b></div></div>}
        </div>

        <div className="account-panel">
          <div className="account-panel-head"><div><span className="eyebrow">ORDERS</span><h2>Your orders</h2></div><Link className="account-link" to="/shop">Shop more →</Link></div>
          {orders.length ? <div className="account-list">{orders.map(o=><div className="account-order" key={o.id}>
            <div><b>{o.id}</b><span>{new Date(o.createdAt).toLocaleDateString()}</span></div>
            <div><span>{o.items?.length||0} item{(o.items?.length||0)!==1?"s":""}</span><strong>₹{o.total}</strong></div>
            <details className="order-details"><summary>View details</summary><div className="order-details-body"><p><b>Delivery:</b> {o.customer?.name}, {o.customer?.phone}</p><p>{o.customer?.address}, {o.customer?.city}</p><p><b>Items:</b> {o.items?.map(i=>`${i.name} × ${i.qty}`).join(", ")}</p><div className="order-detail-actions"><button onClick={()=>navigator.clipboard?.writeText(`Order ${o.id}\n${o.items?.map(i=>`${i.name} x${i.qty}`).join(", ")}\nTotal ₹${o.total}`)}>Copy order</button><a target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Hi Naynaknots, I want to ask about order ${o.id}.` )}`}>WhatsApp</a></div></div></details>
            <span className={statusClass(o.status)}>{o.status||"Placed"}</span>
          </div>)}</div> : <div className="account-empty"><span>🧶</span><div><b>Your first order is waiting.</b><p>Find a little piece that feels like you.</p></div><Link className="btn primary" to="/shop">Explore shop</Link></div>}
        </div>

        <div className="account-panel">
          <div className="account-panel-head"><div><span className="eyebrow">CUSTOM</span><h2>Custom orders</h2></div><Link className="account-link" to="/custom-order">Create one →</Link></div>
          {customOrders.length ? <div className="account-list">{customOrders.map(o=><div className="account-order custom-order" key={o.id}>
            <div><b>{o.id}</b><span>{new Date(o.createdAt).toLocaleDateString()}</span></div>
            <div><span>{o.type} · {o.color} · {o.size}</span><strong>₹{o.price}</strong></div>
            <span className={statusClass(o.status||"Submitted")}>{o.status||"Submitted"}</span>
          </div>)}</div> : <div className="account-empty"><span>✿</span><div><b>Have something special in mind?</b><p>Tell us your colour, size and occasion.</p></div><Link className="btn ghost" to="/custom-order">Open Knot Studio</Link></div>}
        </div>

        <div className="account-panel">
          <div className="account-panel-head"><div><span className="eyebrow">WISHLIST</span><h2>Saved for later</h2></div><Link className="account-link" to="/shop">Discover more →</Link></div>
          {wishlist.length ? <div className="wishlist-grid">{wishlist.map(p=><article className="wishlist-card" key={p.id}>
            <Link to={`/product/${p.id}`}><img src={p.image} alt={p.name}/></Link>
            <div><b>{p.name}</b><span>₹{p.price}</span><button onClick={()=>onToggleWishlist?.(p.id)}>Remove</button></div>
          </article>)}</div> : <div className="account-empty"><span>♡</span><div><b>Nothing saved yet.</b><p>Tap the heart on any product to keep it here.</p></div><Link className="btn ghost" to="/shop">Browse products</Link></div>}
        </div>
      </div>

      <aside className="account-side">
        <div className="account-quick">
          <span className="eyebrow">QUICK ACTIONS</span>
          <Link to="/shop">🛍️ <span>Continue shopping</span><b>→</b></Link>
          <Link to="/custom-order">🧶 <span>Create custom order</span><b>→</b></Link>
          <Link to="/cart">🛒 <span>Open cart</span><b>{cartCount}</b></Link>
        </div>
        <div className="account-note"><span>♡</span><h3>Made slowly.<br/>Made for you.</h3><p>Every Naynaknots piece is handmade with patience, softness and love.</p></div>
      </aside>
    </section>
  </main>;
}