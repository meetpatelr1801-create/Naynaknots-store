import { useEffect, useMemo, useState } from "react";

const blank = { name:"", price:"", category:"Flowers", image:"", description:"", stock:0, rating:5 };
const orderStatuses=["Placed","Confirmed","Preparing","Ready","Completed","Cancelled"];
const customStatuses=["Submitted","Reviewed","Accepted","In Progress","Ready","Completed","Cancelled"];

export default function AdminDashboard({ token, onProductsChange }) {
  const [data,setData]=useState({users:[],products:[],orders:[],customOrders:[],messages:[]});
  const [tab,setTab]=useState("overview");
  const [form,setForm]=useState(blank);
  const [editingId,setEditingId]=useState(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [imagePreview,setImagePreview]=useState("");
  const [orderSearch,setOrderSearch]=useState("");
  const [messageSearch,setMessageSearch]=useState("");
  const headers={Authorization:`Bearer ${token}`};

  const load=async()=>{
    const r=await fetch("/api/admin/data",{headers});
    if(!r.ok){setMessage("Admin session expired. Please login again.");return}
    const d=await r.json();
    d.orders=(d.orders||[]).map(o=>({...o,status:o.status||"Placed"}));
    d.customOrders=(d.customOrders||[]).map(o=>({...o,status:o.status||"Submitted"}));
    setData(d);
  };
  useEffect(()=>{load()},[]);

  const update=(key,value)=>setForm(c=>({...c,[key]:value}));
  const uploadImage=async(file)=>{
    if(!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)){
      setMessage("Please choose a PNG, JPG or WebP image."); return;
    }
    if(file.size>5*1024*1024){
      setMessage("Image must be smaller than 5 MB."); return;
    }
    setUploading(true);setMessage("");
    try{
      const dataUrl=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=()=>reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      });
      // Resize before sending so product images stay fast.
      const optimized=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>{
          const max=1200, scale=Math.min(1,max/Math.max(img.width,img.height));
          const canvas=document.createElement("canvas");
          canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
          const ctx=canvas.getContext("2d");
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL("image/jpeg",.86));
        };
        img.onerror=()=>reject(new Error("Could not process image."));
        img.src=dataUrl;
      });
      const r=await fetch("/api/admin/upload-image",{
        method:"POST",headers:{...headers,"Content-Type":"application/json"},
        body:JSON.stringify({dataUrl:optimized})
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Upload failed.");
      setForm(cur=>({...cur,image:d.url}));
      setImagePreview(d.url);
      setMessage("Image uploaded. Save the product to publish it.");
    }catch(e){setMessage(e.message)}
    finally{setUploading(false)}
  };

  const submit=async e=>{
    e.preventDefault();setBusy(true);setMessage("");
    try{
      const r=await fetch(editingId?`/api/admin/products/${editingId}`:"/api/admin/products",{
        method:editingId?"PUT":"POST",
        headers:{...headers,"Content-Type":"application/json"},
        body:JSON.stringify(form)
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||"Could not save product.");
      setForm(blank);setImagePreview("");setEditingId(null);setMessage(editingId?"Product updated successfully.":"Product added successfully.");
      await load();onProductsChange?.();
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  };

  const edit=p=>{
    setEditingId(p.id);
    setForm({...p,price:p.price,stock:p.stock,rating:p.rating});setImagePreview(p.image);
    setTab("products");
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const remove=async p=>{
    if(!window.confirm(`Remove “${p.name}” from the shop?`))return;
    const r=await fetch(`/api/admin/products/${p.id}`,{method:"DELETE",headers});
    const d=await r.json();
    if(!r.ok){setMessage(d.message||"Could not remove product.");return}
    setMessage(`${p.name} was removed.`);await load();onProductsChange?.();
  };

  const updateStatus=async(type,id,status)=>{
    const url=type==="order"?`/api/admin/orders/${id}/status`:`/api/admin/custom-orders/${id}/status`;
    const r=await fetch(url,{method:"PATCH",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({status})});
    const d=await r.json();
    if(!r.ok){setMessage(d.message||"Could not update status.");return}
    setData(cur=>({...cur,
      orders:type==="order"?cur.orders.map(o=>o.id===id?d.order:o):cur.orders,
      customOrders:type==="custom"?cur.customOrders.map(o=>o.id===id?d.order:o):cur.customOrders
    }));
    setMessage(`${id} updated to ${status}.`);
  };

  const updateRole=async(user,role)=>{
    if(user.role===role)return;
    if(!window.confirm(`${role==="admin"?"Give":"Remove"} admin access ${role==="admin"?"to":"from"} ${user.name}?`))return;
    const r=await fetch(`/api/admin/users/${user.id}/role`,{method:"PATCH",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({role})});
    const d=await r.json();
    if(!r.ok){setMessage(d.message||"Could not update role.");return}
    setData(cur=>({...cur,users:cur.users.map(u=>u.id===user.id?{...u,role:d.user.role}:u)}));
    setMessage(`${user.name}'s role is now ${role}.`);
  };

  const revenue=useMemo(()=>data.orders.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+Number(o.total||0),0),[data.orders]);
  const pendingOrders=data.orders.filter(o=>!["Completed","Cancelled"].includes(o.status||"Placed")).length;
  const pendingCustom=data.customOrders.filter(o=>!["Completed","Cancelled"].includes(o.status||"Submitted")).length;
  const filteredOrders=data.orders.filter(o=>`${o.id} ${o.email} ${o.customer?.name||""} ${o.customer?.phone||""}`.toLowerCase().includes(orderSearch.toLowerCase()));
  const filteredMessages=data.messages.filter(m=>`${m.name||""} ${m.email||""} ${m.message||m.body||""}`.toLowerCase().includes(messageSearch.toLowerCase()));
  const copyOrder=o=>{
    const text=[`Naynaknots Order ${o.id}`,`Customer: ${o.customer?.name||o.email}`,`Phone: ${o.customer?.phone||"—"}`,`Address: ${o.customer?.address||"—"}`,`Items: ${(o.items||[]).map(i=>`${i.name} × ${i.qty}`).join(", ")}`,`Total: ₹${o.total}`,`Status: ${o.status}`].join("\n");
    navigator.clipboard?.writeText(text).then(()=>setMessage("Order details copied."));
  };

  return <main className="page admin-page">
    <div className="admin-top">
      <div className="heading"><span className="eyebrow">ADMIN CONTROL CENTER</span><h1>Run Naynaknots.</h1><p>Products, orders, customers and custom ideas — organized in one focused workspace.</p></div>
      <div className="admin-live"><span></span>Live store</div>
    </div>

    <nav className="admin-tabs">
      {[
        ["overview","Overview"],["products","Products"],["orders","Orders"],["custom","Custom orders"],["customers","Customers"],["messages","Messages"]
      ].map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}
    </nav>

    {message&&<div className="admin-message">{message}</div>}

    {tab==="overview"&&<section className="admin-dashboard-view">
      <div className="stats">
        <div><b>{data.products.length}</b><span>Products</span></div>
        <div><b>{data.users.filter(u=>u.role==="customer").length}</b><span>Customers</span></div>
        <div><b>{data.orders.length}</b><span>Total orders</span></div>
        <div><b>₹{revenue}</b><span>Order value</span></div>
      </div>
      <div className="admin-overview-grid">
        <section className="admin-overview-card">
          <div className="admin-section-title"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Work queue</h2></div></div>
          <div className="queue-grid">
            <button onClick={()=>setTab("orders")}><b>{pendingOrders}</b><span>Pending orders</span><strong>→</strong></button>
            <button onClick={()=>setTab("custom")}><b>{pendingCustom}</b><span>Custom requests</span><strong>→</strong></button>
            <button onClick={()=>setTab("messages")}><b>{data.messages.length}</b><span>Messages</span><strong>→</strong></button>
            <button onClick={()=>setTab("products")}><b>{data.products.filter(p=>Number(p.stock)<=2).length}</b><span>Low stock</span><strong>→</strong></button>
          </div>
        </section>
        <section className="admin-overview-card">
          <div className="admin-section-title"><div><span className="eyebrow">RECENT</span><h2>Latest orders</h2></div><button className="admin-secondary" onClick={()=>setTab("orders")}>View all</button></div>
          {data.orders.slice(-5).reverse().map(o=><div className="admin-mini-row" key={o.id}><b>{o.id}</b><span>{o.email}</span><strong>₹{o.total}</strong><em>{o.status}</em></div>)}
          {!data.orders.length&&<p className="admin-muted">No orders yet.</p>}
        </section>
      </div>
    </section>}

    {tab==="products"&&<section>
      <section className="admin-product-editor">
        <div className="admin-section-title"><div><span className="eyebrow">PRODUCT MANAGEMENT</span><h2>{editingId?"Edit product":"Add a product"}</h2></div>{editingId&&<button className="admin-secondary" onClick={()=>{setEditingId(null);setForm(blank);setImagePreview("")}}>Cancel edit</button>}</div>
        <form className="product-admin-form" onSubmit={submit}>
          <label>Product name<input value={form.name} onChange={e=>update("name",e.target.value)} required/></label>
          <label>Price (₹)<input type="number" min="0" value={form.price} onChange={e=>update("price",e.target.value)} required/></label>
          <label>Category<select value={form.category} onChange={e=>update("category",e.target.value)}><option>Flowers</option><option>Plushies</option><option>Charms</option><option>Bouquets</option><option>Custom</option></select></label>
          <label>Stock<input type="number" min="0" value={form.stock} onChange={e=>update("stock",e.target.value)}/></label>
          <label>Rating<input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={e=>update("rating",e.target.value)}/></label>
          <label className="image-upload-field">Product image
  <div className="image-upload-box">
    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadImage(e.target.files?.[0])} />
    <span>{uploading?"Uploading image...":"Choose PNG, JPG or WebP"}</span>
    <small>Max 5 MB · automatically optimized</small>
  </div>
  {form.image&&<div className="image-upload-preview"><img src={imagePreview||form.image} alt="Product preview"/><button type="button" className="admin-secondary" onClick={()=>{update("image","");setImagePreview("")}}>Remove image</button></div>}
  <input value={form.image} onChange={e=>{update("image",e.target.value);setImagePreview(e.target.value)}} placeholder="Or paste an image URL"/>
</label>
          <label className="full-field">Description<textarea value={form.description} onChange={e=>update("description",e.target.value)} required/></label>
          <button className="btn primary" disabled={busy}>{busy?"Saving...":editingId?"Save changes":"Add product"}</button>
        </form>
      </section>
      <section className="admin-product-list"><div className="admin-section-title"><div><span className="eyebrow">YOUR CATALOGUE</span><h2>Products</h2></div></div>
        <div className="admin-product-grid">{data.products.map(p=><article className="admin-product-card" key={p.id}><img src={p.image} alt={p.name}/><div className="admin-product-info"><span>{p.category}</span><h3>{p.name}</h3><p>₹{p.price} · Stock {p.stock}</p><div className="admin-product-actions"><button className="admin-secondary" onClick={()=>edit(p)}>Edit</button><button className="admin-danger" onClick={()=>remove(p)}>Remove</button></div></div></article>)}</div>
      </section>
    </section>}

    {tab==="orders"&&<section className="admin-work-panel">
      <div className="admin-section-title"><div><span className="eyebrow">ORDER MANAGEMENT</span><h2>Customer orders</h2></div><span className="admin-count">{data.orders.length} orders</span></div><div className="admin-search"><input value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} placeholder="Search order, name, email or phone..."/></div>
      {filteredOrders.length?<div className="admin-order-list">{filteredOrders.slice().reverse().map(o=><article className="admin-order-card" key={o.id}>
        <div className="order-main"><div><b>{o.id}</b><span>{new Date(o.createdAt).toLocaleString()}</span></div><strong>₹{o.total}</strong></div>
        <div className="order-customer"><span>Customer</span><b>{o.customer?.name||o.email}</b><small>{o.email} · {o.customer?.phone||"No phone"}</small><small>{o.items?.map(i=>`${i.name} × ${i.qty}`).join(" · ")}</small></div>
        <div className="order-status-control"><button className="admin-secondary copy-order" onClick={()=>copyOrder(o)}>Copy details</button><label>Status<select value={o.status||"Placed"} onChange={e=>updateStatus("order",o.id,e.target.value)}>{orderStatuses.map(x=><option key={x}>{x}</option>)}</select></label></div>
      </article>)}</div>:<div className="admin-empty">No customer orders yet.</div>}
    </section>}

    {tab==="custom"&&<section className="admin-work-panel">
      <div className="admin-section-title"><div><span className="eyebrow">KNOT STUDIO</span><h2>Custom orders</h2></div><span className="admin-count">{data.customOrders.length} requests</span></div>
      {data.customOrders.length?<div className="admin-custom-list">{data.customOrders.slice().reverse().map(o=><article className="admin-custom-card" key={o.id}>
        <div className="custom-head"><div><b>{o.id}</b><span>{o.email} · {new Date(o.createdAt).toLocaleDateString()}</span></div><strong>₹{o.price}</strong></div>
        <div className="custom-specs"><span><b>Type</b>{o.type}</span><span><b>Colour</b>{o.color}</span><span><b>Size</b>{o.size}</span><span><b>Occasion</b>{o.occasion}</span></div>
        <div className="custom-idea"><b>Customer idea</b><p>{o.idea}</p></div>
        <label>Status<select value={o.status||"Submitted"} onChange={e=>updateStatus("custom",o.id,e.target.value)}>{customStatuses.map(x=><option key={x}>{x}</option>)}</select></label>
      </article>)}</div>:<div className="admin-empty">No custom requests yet.</div>}
    </section>}

    {tab==="customers"&&<section className="admin-work-panel">
      <div className="admin-section-title"><div><span className="eyebrow">CUSTOMER MANAGEMENT</span><h2>Accounts</h2></div><span className="admin-count">{data.users.length} accounts</span></div>
      <div className="customer-admin-list">{data.users.map(u=><article className="customer-admin-card" key={u.id}><div className="customer-avatar">{u.name?.charAt(0).toUpperCase()}</div><div><b>{u.name}</b><span>{u.email}</span></div><label>Role<select value={u.role} onChange={e=>updateRole(u,e.target.value)}><option value="customer">Customer</option><option value="admin">Admin</option></select></label></article>)}</div>
      <p className="admin-muted">Admin access should only be given to people you trust. Your own admin access cannot be removed from this screen.</p>
    </section>}

    {tab==="messages"&&<section className="admin-work-panel">
      <div className="admin-section-title"><div><span className="eyebrow">INBOX</span><h2>Contact messages</h2></div><span className="admin-count">{data.messages.length} messages</span></div><div className="admin-search"><input value={messageSearch} onChange={e=>setMessageSearch(e.target.value)} placeholder="Search messages..."/></div>
      {filteredMessages.length?<div className="message-list">{filteredMessages.slice().reverse().map(m=><article className="message-card" key={m.id}><div><b>{m.name||"Visitor"}</b><span>{m.email||"No email"} · {new Date(m.createdAt).toLocaleString()}</span></div><p>{m.message||m.body||"No message text."}</p></article>)}</div>:<div className="admin-empty">Your inbox is empty.</div>}
    </section>}
  </main>;
}