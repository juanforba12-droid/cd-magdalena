import { useState } from "react";
import * as React from "react";

export default function AmicsApp() {
  return (
    <div style={{minHeight:"100vh",background:"#052e16",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:48}}>🏀</div>
      <h1 style={{color:"#fff",fontSize:28,fontWeight:900}}>Amics Castelló BC</h1>
      <p style={{color:"#86efac",fontSize:14}}>App de baloncesto cargada correctamente</p>
    </div>
  );
}
