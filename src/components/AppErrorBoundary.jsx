import React from "react";
export default class AppErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  componentDidCatch(error,info){console.error("Naynaknots UI error",error,info)}
  render(){
    if(this.state.error)return <main className="page empty"><div>⚠</div><h1>Something went wrong.</h1><p>The page hit an unexpected error. Refresh and try again.</p><button className="btn primary" onClick={()=>location.reload()}>Refresh page</button></main>;
    return this.props.children;
  }
}