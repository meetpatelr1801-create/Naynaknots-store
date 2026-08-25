import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.join(dir, "data.json");
const uploadsDir = path.join(dir, "uploads");
fs.mkdirSync(uploadsDir,{recursive:true});

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";
const SECRET = process.env.NAYNAKNOTS_SECRET;
if(!SECRET){console.warn("WARNING: NAYNAKNOTS_SECRET is not set. Set a long random secret before production.");}
const TOKEN_SECRET = SECRET || "local-only-change-this-secret";

function hashPassword(password,salt=crypto.randomBytes(16).toString("hex")){
  return {passwordHash:crypto.scryptSync(String(password),salt,64).toString("hex"),passwordSalt:salt};
}
function passwordMatches(password,user){
  if(!user?.passwordHash||!user?.passwordSalt)return false;
  const {passwordHash}=hashPassword(password,user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(passwordHash,"hex"),Buffer.from(user.passwordHash,"hex"));
}
function sanitizeUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role};}
function read(){
  if(!fs.existsSync(dbFile)){
    const salt=crypto.randomBytes(16).toString("hex");
    const h=crypto.scryptSync("Admin@123",salt,64).toString("hex");
    const now=new Date().toISOString();
    const seed={users:[{id:"admin-1",name:"Naynaknots Admin",email:"admin@naynaknots.com",passwordHash:h,passwordSalt:salt,role:"admin",createdAt:now}],products:[],orders:[],customOrders:[],messages:[],wishlists:[]};
    fs.writeFileSync(dbFile,JSON.stringify(seed,null,2));
  }
  const d=JSON.parse(fs.readFileSync(dbFile,"utf8"));
  for(const k of ["users","products","orders","customOrders","messages","wishlists"])if(!Array.isArray(d[k]))d[k]=[];
  let changed=false;
  d.users=d.users.map(u=>{
    if(u.password&&!u.passwordHash){
      const h=hashPassword(u.password); const n={...u,...h}; delete n.password; changed=true; return n;
    }
    return u;
  });
  if(changed)write(d);
  return d;
}
function write(d){
  const tmp=dbFile+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(d,null,2));
  fs.renameSync(tmp,dbFile);
}

function readProducts(){
  return read().products;
}
function snapshot(){
  return read();
}
function findUser(id){
  return read().users.find(u=>u.id===id);
}

function signToken(u){
  const payload=Buffer.from(JSON.stringify({id:u.id,role:u.role,exp:Date.now()+7*24*60*60*1000})).toString("base64url");
  const sig=crypto.createHmac("sha256",TOKEN_SECRET).update(payload).digest("base64url");
  return payload+"."+sig;
}
function verifyToken(token){
  try{
    const [payload,sig]=String(token||"").split(".");
    const expected=crypto.createHmac("sha256",TOKEN_SECRET).update(payload).digest("base64url");
    if(!payload||!sig||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
    const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    if(!data.exp||Date.now()>data.exp)return null;
    return data;
  }catch{return null}
}
function authUser(req){
  const raw=req.headers.authorization||"";
  const token=raw.startsWith("Bearer ")?raw.slice(7):"";
  const claims=verifyToken(token); if(!claims)return null;
  return read().users.find(u=>u.id===claims.id)||null;
}
function requireUser(req,res,next){
  const u=authUser(req); if(!u)return res.status(401).json({message:"Please log in."});
  req.user=u; next();
}
function requireAdmin(req,res,next){
  const u=authUser(req); if(!u||u.role!=="admin")return res.status(403).json({message:"Admin permission required."});
  req.user=u; req.admin=u; next();
}
function rateLimit(limit,windowMs){
  const buckets=new Map();
  return (req,res,next)=>{
    const key=`${req.ip}:${req.path}`,now=Date.now(),row=buckets.get(key);
    if(!row||now-row.start>windowMs){buckets.set(key,{start:now,count:1});return next();}
    row.count++; if(row.count>limit)return res.status(429).json({message:"Too many attempts. Please wait and try again."});
    next();
  };
}
function makeId(prefix){return `${prefix}-${Date.now()}-${crypto.randomInt(100,999)}`;}

const starterProducts = [
  { id: 1, name: "Daisy Bloom", price: 299, category: "Flowers", image: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85", description: "A forever crochet daisy for desks, gifts and sunny corners.", stock: 12, rating: 5 },
  { id: 2, name: "Berry Bunny", price: 549, category: "Plushies", image: "https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&w=900&q=85", description: "A tiny handmade bunny made to be hugged and kept.", stock: 7, rating: 5 },
  { id: 3, name: "Mini Tulip", price: 249, category: "Flowers", image: "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=900&q=85", description: "A cheerful crochet tulip that never wilts.", stock: 15, rating: 4.8 },
  { id: 4, name: "Cloud Bear", price: 699, category: "Plushies", image: "https://images.unsplash.com/photo-1585832770485-e68a5dbfad52?auto=format&fit=crop&w=900&q=85", description: "A soft little bear with a cloud-like handmade feel.", stock: 5, rating: 5 }
];

const app=express();
if(!fs.existsSync(uploadsDir))fs.mkdirSync(uploadsDir,{recursive:true});
app.use(express.json({limit:"8mb"}));
app.disable("x-powered-by");
app.use((req,res,next)=>{
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
  next();
});
const rateBuckets=new Map();

app.use("/uploads",express.static(uploadsDir));
app.get("/api/health",(_,res)=>{
  res.json({ok:true,service:"naynaknots-api",time:new Date().toISOString()});
});app.get("/api/store-config",(_,res)=>res.json({
  instagram:"naynaknots",
  whatsapp:"916352198619",
  storeName:"Naynaknots",
  supportEmail:"meetpatelr1801@gmail.com"
}));

const initial=read();
if(initial.products.length===0){initial.products=starterProducts.map(p=>({...p,createdAt:new Date().toISOString()}));write(initial);}
app.get("/api/products",(_,res)=>res.json(readProducts()));

app.post("/api/register",rateLimit(10,15*60*1000),(req,res)=>{
  const name=String(req.body?.name||"").trim(),email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");
  if(name.length<2||name.length>60)return res.status(400).json({message:"Name must be between 2 and 60 characters."});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:"Please enter a valid email address."});
  if(password.length<8)return res.status(400).json({message:"Password must be at least 8 characters."});
  const d=read(); if(d.users.some(u=>u.email.toLowerCase()===email))return res.status(409).json({message:"An account with this email already exists."});
  const u={id:crypto.randomUUID(),name,email,...hashPassword(password),role:"customer",createdAt:new Date().toISOString()};
  d.users.push(u);write(d);res.json({user:sanitizeUser(u),token:signToken(u)});
});
app.post("/api/login",rateLimit(10,15*60*1000),(req,res)=>{
  const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||""),d=read(),u=d.users.find(x=>x.email.toLowerCase()===email);
  if(!u||!passwordMatches(password,u))return res.status(401).json({message:"Incorrect email or password."});
  res.json({user:sanitizeUser(u),token:signToken(u)});
});
app.get("/api/me",requireUser,(req,res)=>res.json({user:sanitizeUser(req.user)}));

app.patch("/api/my/profile",requireUser,(req,res)=>{
  const name=String(req.body?.name||"").trim();if(name.length<2||name.length>60)return res.status(400).json({message:"Name must be between 2 and 60 characters."});
  const d=read(),u=d.users.find(x=>x.id===req.user.id);u.name=name;write(d);res.json({user:sanitizeUser(u)});
});
app.get("/api/my/wishlist",requireUser,(req,res)=>res.json((read().wishlists.find(w=>w.userId===req.user.id)?.productIds||[])));
app.post("/api/my/wishlist/:productId",requireUser,(req,res)=>{
  const id=Number(req.params.productId),d=read();if(!d.products.some(p=>Number(p.id)===id))return res.status(404).json({message:"Product not found."});
  let w=d.wishlists.find(x=>x.userId===req.user.id);if(!w){w={userId:req.user.id,productIds:[]};d.wishlists.push(w)};if(!w.productIds.includes(id))w.productIds.push(id);write(d);res.json({productIds:w.productIds});
});
app.delete("/api/my/wishlist/:productId",requireUser,(req,res)=>{
  const id=Number(req.params.productId),d=read(),w=d.wishlists.find(x=>x.userId===req.user.id);if(w)w.productIds=w.productIds.filter(x=>Number(x)!==id);write(d);res.json({productIds:w?.productIds||[]});
});
app.get("/api/my/orders",requireUser,(req,res)=>res.json(read().orders.filter(o=>o.userId===req.user.id)));
app.get("/api/my/custom-orders",requireUser,(req,res)=>res.json(read().customOrders.filter(o=>o.userId===req.user.id)));

app.post("/api/orders",requireUser,(req,res)=>{
  const {items,customer}=req.body||{};
  if(!Array.isArray(items)||!items.length)return res.status(400).json({message:"Your cart is empty."});
  if(!customer||["name","phone","city","address"].some(k=>!String(customer[k]||"").trim()))return res.status(400).json({message:"Please complete your delivery details."});
  const d=read(),safeItems=[];
  for(const item of items){
    const p=d.products.find(x=>Number(x.id)===Number(item.id)),qty=Math.floor(Number(item.qty));
    if(!p)return res.status(400).json({message:"One of the products is no longer available."});
    if(!Number.isInteger(qty)||qty<1)return res.status(400).json({message:"Invalid item quantity."});
    if(Number(p.stock)<qty)return res.status(400).json({message:`Only ${p.stock} ${p.name} available.`});
    safeItems.push({id:p.id,name:p.name,price:Number(p.price),qty});
  }
  const total=safeItems.reduce((sum,x)=>sum+x.price*x.qty,0);
  safeItems.forEach(i=>{const p=d.products.find(x=>Number(x.id)===Number(i.id));p.stock-=i.qty;});
  const order={id:makeId("ORD"),createdAt:new Date().toISOString(),status:"Placed",userId:req.user.id,email:req.user.email,customer:{name:String(customer.name).trim().slice(0,80),phone:String(customer.phone).trim().slice(0,30),city:String(customer.city).trim().slice(0,80),address:String(customer.address).trim().slice(0,250),note:String(customer.note||"").trim().slice(0,300)},items:safeItems,total};
  d.orders.push(order);write(d);res.status(201).json({order});
});
app.post("/api/custom-orders",requireUser,(req,res)=>{
  const d=read(),order={id:makeId("CUS"),createdAt:new Date().toISOString(),status:"Submitted",userId:req.user.id,email:req.user.email,type:String(req.body.type||"").slice(0,60),color:String(req.body.color||"").slice(0,60),size:String(req.body.size||"").slice(0,60),occasion:String(req.body.occasion||"").slice(0,80),idea:String(req.body.idea||"").slice(0,800),price:Number(req.body.price)||0};
  d.customOrders.push(order);write(d);res.status(201).json({ok:true,order});
});
app.post("/api/contact",(req,res)=>{
  const d=read();d.messages.push({id:makeId("MSG"),name:String(req.body.name||"").slice(0,80),email:String(req.body.email||"").slice(0,120),message:String(req.body.message||"").slice(0,1500),createdAt:new Date().toISOString()});write(d);res.json({ok:true});
});
app.get("/api/admin/data",requireAdmin,(req,res)=>res.json(snapshot()));
app.patch("/api/admin/orders/:id/status",requireAdmin,(req,res)=>{
  const allowed=["Placed","Confirmed","Preparing","Ready","Completed","Cancelled"],status=String(req.body?.status||"");if(!allowed.includes(status))return res.status(400).json({message:"Invalid order status."});
  const d=read(),o=d.orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({message:"Order not found."});o.status=status;write(d);res.json({order:o});
});
app.patch("/api/admin/custom-orders/:id/status",requireAdmin,(req,res)=>{
  const allowed=["Submitted","Reviewed","Accepted","In Progress","Ready","Completed","Cancelled"],status=String(req.body?.status||"");if(!allowed.includes(status))return res.status(400).json({message:"Invalid custom order status."});
  const d=read(),o=d.customOrders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({message:"Custom order not found."});o.status=status;write(d);res.json({order:o});
});
app.patch("/api/admin/users/:id/role",requireAdmin,(req,res)=>{
  const role=String(req.body?.role||"");if(!["customer","admin"].includes(role))return res.status(400).json({message:"Invalid role."});
  if(req.params.id===req.admin.id&&role!=="admin")return res.status(400).json({message:"You cannot remove your own admin access."});
  const d=read(),u=d.users.find(x=>x.id===req.params.id);if(!u)return res.status(404).json({message:"User not found."});u.role=role;write(d);res.json({user:sanitizeUser(u)});
});
app.post("/api/admin/upload-image",requireAdmin,(req,res)=>{
  const {dataUrl}=req.body||{};if(typeof dataUrl!=="string"||!dataUrl.startsWith("data:image/"))return res.status(400).json({message:"Please select a valid image."});
  const match=dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);if(!match)return res.status(400).json({message:"Only PNG, JPG or WebP images are supported."});
  const ext=match[1]==="jpeg"||match[1]==="jpg"?"jpg":match[1],buffer=Buffer.from(match[2],"base64");if(buffer.length>5*1024*1024)return res.status(400).json({message:"Image must be smaller than 5 MB."});
  const filename=`product-${Date.now()}-${crypto.randomUUID()}.${ext}`;fs.writeFileSync(path.join(uploadsDir,filename),buffer);res.status(201).json({url:`/uploads/${filename}`});
});
app.post("/api/admin/products",requireAdmin,(req,res)=>{
  const d=read(),{name,price,category,image,description,stock,rating}=req.body||{},n=String(name||"").trim(),cat=String(category||"").trim(),img=String(image||"").trim(),desc=String(description||"").trim(),pr=Number(price),st=Math.max(0,Math.floor(Number(stock)||0)),rt=Math.min(5,Math.max(0,Number(rating)||5));
  if(!n||!cat||!img||!desc||!Number.isFinite(pr)||pr<0)return res.status(400).json({message:"Name, price, category, image and description are required."});
  const ids=d.products.map(x=>Number(x.id)).filter(Number.isFinite),id=ids.length?Math.max(...ids)+1:1,p={id,name:n,price:pr,category:cat,image:img,description:desc,stock:st,rating:rt,createdAt:new Date().toISOString()};d.products.push(p);write(d);res.status(201).json({product:p});
});
app.put("/api/admin/products/:id",requireAdmin,(req,res)=>{
  const d=read(),id=Number(req.params.id),p=d.products.find(x=>Number(x.id)===id);if(!p)return res.status(404).json({message:"Product not found."});
  Object.assign(p,{name:String(req.body.name??p.name).trim(),price:Number(req.body.price??p.price),category:String(req.body.category??p.category).trim(),image:String(req.body.image??p.image).trim(),description:String(req.body.description??p.description).trim(),stock:Math.max(0,Math.floor(Number(req.body.stock??p.stock))),rating:Math.min(5,Math.max(0,Number(req.body.rating??p.rating)))});
  if(!p.name||!p.category||!p.image||!p.description||!Number.isFinite(p.price)||p.price<0)return res.status(400).json({message:"Invalid product details."});write(d);res.json({product:p});
});
app.delete("/api/admin/products/:id",requireAdmin,(req,res)=>{
  const d=read(),id=Number(req.params.id),before=d.products.length;d.products=d.products.filter(p=>Number(p.id)!==id);if(d.products.length===before)return res.status(404).json({message:"Product not found."});d.wishlists.forEach(w=>w.productIds=(w.productIds||[]).filter(x=>Number(x)!==id));write(d);res.json({ok:true});
});

app.get("/api/store-config",(_,res)=>res.json({instagram:"naynaknots",whatsapp:"919999999999",storeName:"Naynaknots",supportEmail:"hello@naynaknots.com"}));
app.get("/api/health",(_,res)=>res.json({ok:true,service:"naynaknots-api",time:new Date().toISOString()}));

if(process.env.NODE_ENV==="production"){
  const dist=path.join(dir,"../dist");
  if(fs.existsSync(dist)){
    app.use(express.static(dist));
    app.get("*",(req,res)=>{
      if(req.path.startsWith("/api/")||req.path.startsWith("/uploads/"))return res.status(404).end();
      res.sendFile(path.join(dist,"index.html"));
    });
  }
}
app.listen(PORT,HOST,()=>console.log(`Naynaknots API running on ${HOST}:${PORT}`));
