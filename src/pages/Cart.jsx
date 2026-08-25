import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Cart({cart,onQty,onOrder,user}){
  const [checkout,setCheckout]=useState(false);
  const [details,setDetails]=useState({name:user?.name||"",phone:"",city:"",address:"",note:""});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [placed,setPlaced]=useState(null);
  const total=cart.reduce((s,x)=>s+x.price*x.qty,0);

  const update=(k,v)=>setDetails(d=>({...d,[k]:v}));

  if(placed) return <main className="page checkout-success-page">
    <div className="checkout-success">
      <span className="success-icon">✓</span>
      <span className="eyebrow">ORDER CREATED</span>
      <h1>Your order is on its way.</h1>
      <p>Order <b>{placed.id}</b> has been saved to your Naynaknots account.</p>
      <div className="success-order-meta"><span>Total</span><b>₹{placed.total}</b><span>Status</span><b>{placed.status}</b></div>
      <div className="success-actions">
        <a className="btn primary" href="https://www.instagram.com/naynaknots/" target="_blank" rel="noreferrer">Continue on Instagram</a><a className="btn ghost" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Hi Naynaknots! I just placed order ${placed.id}. Total ₹${placed.total}.`)}`}>Open WhatsApp</a>
        <Link className="btn ghost" to="/account">View my order</Link>
      </div>
      <small>We’ll use Instagram to confirm the handmade order with you.</small>
    </div>
  </main>;

  if(!cart.length)return <main className="page empty"><div>🧶</div><h1>Your cart is waiting.</h1><p>Add a little handmade happiness.</p><Link className="btn primary" to="/shop">Shop now</Link></main>;

  const submit=async e=>{
    e.preventDefault();setError("");setBusy(true);
    try{
      const r=await fetch("/api/orders",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("nk_token")||""}`},
        body:JSON.stringify({items:cart,customer:details})
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not create your order.");
      onOrder?.(d.order);
      setPlaced(d.order);
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  };

  if(checkout) return <main className="page checkout-page">
    <div className="heading"><span className="eyebrow">CHECKOUT</span><h1>One last detail.</h1><p>Your order will be saved first, then we’ll take you to Instagram to coordinate the handmade delivery.</p></div>
    <div className="checkout-layout">
      <form className="checkout-form" onSubmit={submit}>
        <h2>Delivery details</h2>
        {error&&<div className="error">{error}</div>}
        <div className="checkout-fields">
          <label>Name<input value={details.name} onChange={e=>update("name",e.target.value)} required maxLength={80}/></label>
          <label>Phone<input value={details.phone} onChange={e=>update("phone",e.target.value)} required maxLength={30} placeholder="+91 ..."/></label>
          <label>City<input value={details.city} onChange={e=>update("city",e.target.value)} required maxLength={80}/></label>
          <label className="full-field">Address<textarea value={details.address} onChange={e=>update("address",e.target.value)} required maxLength={250} placeholder="House / flat, area, landmark"/></label>
          <label className="full-field">Order note <span className="optional">(optional)</span><textarea value={details.note} onChange={e=>update("note",e.target.value)} maxLength={300} placeholder="Any colour, packaging or delivery note?"/></label>
        </div>
        <div className="checkout-actions"><button type="button" className="btn ghost" onClick={()=>setCheckout(false)}>Back to cart</button><button className="btn primary" disabled={busy}>{busy?"Creating order...":"Confirm order →"}</button></div>
      </form>
      <aside className="summary checkout-summary"><h2>Order summary</h2>{cart.map(x=><div className="checkout-line" key={x.id}><span>{x.name} × {x.qty}</span><b>₹{x.price*x.qty}</b></div>)}<hr/><div className="total"><span>Total</span><b>₹{total}</b></div><small>Payment and final delivery details are confirmed through Instagram.</small></aside>
    </div>
  </main>;

  return <main className="page"><div className="heading"><span className="eyebrow">YOUR BAG</span><h1>Ready to go.</h1></div><div className="cart-layout"><div>{cart.map(x=><div className="cart-item" key={x.id}><img src={x.image} alt=""/><div><h3>{x.name}</h3><p>₹{x.price}</p><div className="qty"><button onClick={()=>onQty(x.id,-1)}>−</button><span>{x.qty}</span><button onClick={()=>onQty(x.id,1)}>+</button></div></div><strong>₹{x.price*x.qty}</strong></div>)}</div><aside className="summary"><h2>Summary</h2><div><span>Items</span><b>₹{total}</b></div><div><span>Delivery</span><b>To confirm</b></div><hr/><div className="total"><span>Total</span><b>₹{total}</b></div><button className="btn primary wide" onClick={()=>setCheckout(true)}>Continue to checkout</button><small>You'll review your delivery details before the order is created.</small></aside></div></main>;
}