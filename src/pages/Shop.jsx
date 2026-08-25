import { useMemo, useState } from "react";
import ProductCard from "../components/ProductCard";
import { categories } from "../data/products";

export default function Shop({ user, onAdd, products = [], wishlistIds = [], onToggleWishlist }) {
  const [cat,setCat]=useState("All");
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState("featured");
  const [stock,setStock]=useState("all");

  const list=useMemo(()=>{
    let result=products.filter(p=>{
      const text=`${p.name} ${p.category} ${p.description}`.toLowerCase();
      const matchesQuery=text.includes(query.trim().toLowerCase());
      const matchesCat=cat==="All"||p.category===cat;
      const matchesStock=stock==="all"||(stock==="available" ? Number(p.stock)>0 : Number(p.stock)<=0);
      return matchesQuery&&matchesCat&&matchesStock;
    });
    result=[...result];
    if(sort==="low")result.sort((a,b)=>Number(a.price)-Number(b.price));
    if(sort==="high")result.sort((a,b)=>Number(b.price)-Number(a.price));
    if(sort==="rating")result.sort((a,b)=>Number(b.rating)-Number(a.rating));
    if(sort==="name")result.sort((a,b)=>a.name.localeCompare(b.name));
    return result;
  },[products,query,cat,sort,stock]);

  return <main className="page shop-page">
    <div className="shop-heading">
      <div className="heading"><span className="eyebrow">THE COLLECTION</span><h1>Find your little forever piece.</h1><p>Browse handmade pieces by mood, category and price. Every item is made slowly and packed with care.</p></div>
      <div className="shop-result-count"><b>{list.length}</b><span>{list.length===1?"piece":"pieces"} found</span></div>
    </div>

    <div className="shop-toolbar">
      <div className="search-wrap"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search flowers, plushies, charms..." aria-label="Search products"/></div>
      <select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort products">
        <option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="rating">Top rated</option><option value="name">Name A–Z</option>
      </select>
    </div>

    <div className="shop-filters">
      <div className="filter-scroll">{["All",...categories.filter(c=>c!=="All")].map(c=><button className={cat===c?"active":""} onClick={()=>setCat(c)} key={c}>{c}</button>)}</div>
      <div className="stock-filters"><button className={stock==="all"?"active":""} onClick={()=>setStock("all")}>All stock</button><button className={stock==="available"?"active":""} onClick={()=>setStock("available")}>Available</button><button className={stock==="out"?"active":""} onClick={()=>setStock("out")}>Sold out</button></div>
    </div>

    {list.length?<div className="grid">{list.map(p=><ProductCard key={p.id} product={p} onAdd={onAdd} user={user} wishlistIds={wishlistIds} onToggleWishlist={onToggleWishlist}/>)}</div>:
      <div className="shop-empty"><div>⌕</div><h2>No knots found.</h2><p>Try a different search or clear your filters.</p><button className="btn ghost" onClick={()=>{setQuery("");setCat("All");setStock("all");setSort("featured")}}>Clear filters</button></div>}
  </main>;
}