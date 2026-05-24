#!/usr/bin/env bash
# Sistema de Reservas — bootstrap automático para StackBlitz
# Uso:  bash setup.sh
set -e

echo "==> Limpiando archivos default de Vite..."
rm -f src/App.css src/App.jsx src/index.css src/main.jsx
rm -rf src/assets
rm -f public/vite.svg
rm -f eslint.config.js

echo "==> Creando estructura de carpetas..."
mkdir -p src/components src/firebase

# ─────────────────────────────────────────────
echo "==> Escribiendo package.json"
cat > package.json << 'EOF'
{
  "name": "sistema-reservas-evento",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "^10.14.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.10"
  }
}
EOF

# ─────────────────────────────────────────────
echo "==> Escribiendo vite.config.js"
cat > vite.config.js << 'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true },
});
EOF

# ─────────────────────────────────────────────
echo "==> Escribiendo index.html"
cat > index.html << 'EOF'
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#09111f" />
    <title>Sistema de Reservas — Miércoles 20 de Mayo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <style>
      html, body { margin: 0; padding: 0; background: #09111f; }
      body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
      * { -webkit-tap-highlight-color: transparent; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

# ─────────────────────────────────────────────
echo "==> Escribiendo src/main.jsx"
cat > src/main.jsx << 'EOF'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

# ─────────────────────────────────────────────
echo "==> Escribiendo src/firebase/config.js"
cat > src/firebase/config.js << 'EOF'
// Reemplaza los valores vacíos con los de tu proyecto Firebase.
// Consola → ⚙️ Configuración del proyecto → tus apps → SDK setup
// (copiar desde el objeto firebaseConfig)

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDSspuaz6Iil6NlrgpgUvyQuOB87e_iPw8",
  authDomain: "reservas-evento.firebaseapp.com",
  projectId: "reservas-evento",
  storageBucket: "reservas-evento.firebasestorage.app",
  messagingSenderId: "458445965286",
  appId: "1:458445965286:web:ca91aa5e7228368f6ff827",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
EOF

# ─────────────────────────────────────────────
echo "==> Escribiendo src/firebase/mesasService.js"
cat > src/firebase/mesasService.js << 'EOF'
import { db } from "./config";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

const MESAS_COL = "mesas";
const mesaDocId = (type, n) => `${type}-${n}`;

// Estado inicial sembrado en Firestore la primera vez que arranca la app.
// Mesas no existen como documento = disponibles. "D" = no disponible.
// Cualquier otro string = nombre de quien la reservó.
export const BASE_G = {
  7: "D", 8: "D", 9: "D", 10: "D", 11: "D",
  18: "D", 19: "D", 20: "D", 21: "D",
  32: "D", 33: "D", 34: "D", 35: "D",
  44: "D", 45: "D", 46: "D",
  12: "Jasmin Bermúdez",
  16: "Jessica Torres", 17: "Jessica Torres",
  22: "Jessica Torres", 23: "Jessica Torres",
  29: "Paola Carpio",
  30: "Jessica Torres", 31: "Jessica Torres",
  36: "Jessica Torres", 37: "Jessica Torres",
  38: "Paola Carpio",
  43: "Nahúm Quintanilla",
  47: "Dajhanna García",
  48: "Jennifer Acosta",
  49: "Niña Juanita",
  50: "Berenice Tepas",
  51: "José Flores",
  52: "Adriana Aquino", 53: "Adriana Aquino",
  57: "Elmer Portillo",
};

export const BASE_V = {
  1: "Inmer López",
  3: "Andrea Flores",
  4: "Adriana Saracay",
};

export async function seedBaseMesasIfEmpty() {
  const snap = await getDocs(collection(db, MESAS_COL));
  if (!snap.empty) return false;
  const batch = writeBatch(db);
  for (const [n, value] of Object.entries(BASE_G)) {
    batch.set(doc(db, MESAS_COL, mesaDocId("g", n)), {
      type: "g", number: +n, value, seeded: true,
    });
  }
  for (const [n, value] of Object.entries(BASE_V)) {
    batch.set(doc(db, MESAS_COL, mesaDocId("v", n)), {
      type: "v", number: +n, value, seeded: true,
    });
  }
  await batch.commit();
  return true;
}

export function subscribeToMesas(callback) {
  return onSnapshot(collection(db, MESAS_COL), (snap) => {
    const g = {}, v = {};
    snap.forEach((d) => {
      const data = d.data();
      if (data.type === "g") g[data.number] = data.value;
      else if (data.type === "v") v[data.number] = data.value;
    });
    callback({ g, v });
  });
}

// Transacción: si la mesa ya tiene documento, falla.
// Esto evita doble reserva si dos usuarios la tocan a la vez.
export async function reservarMesa(type, n, name, reservaId) {
  const ref = doc(db, MESAS_COL, mesaDocId(type, n));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      throw new Error("Esta mesa ya fue reservada por alguien más. Elige otra.");
    }
    tx.set(ref, {
      type,
      number: n,
      value: name,
      reservaId: reservaId || null,
      createdAt: Date.now(),
    });
  });
}

// Sólo para el panel de admin.
export async function liberarMesa(type, n) {
  await deleteDoc(doc(db, MESAS_COL, mesaDocId(type, n)));
}
EOF

# ─────────────────────────────────────────────
echo "==> Escribiendo src/firebase/reservasService.js"
cat > src/firebase/reservasService.js << 'EOF'
import { db } from "./config";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

const RESERVAS_COL = "reservas";

export async function guardarReserva({ id, name, phone, mesa, combo }) {
  const data = {
    id,
    name,
    phone,
    mesa: mesa ? { type: mesa.type, n: mesa.n } : null,
    combo: combo
      ? { id: combo.id, name: combo.name, price: combo.price }
      : null,
    createdAt: serverTimestamp(),
    status: "pending",
  };
  await setDoc(doc(db, RESERVAS_COL, id), data);
  return { id };
}

export async function listarReservas() {
  const q = query(collection(db, RESERVAS_COL), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export function subscribeToReservas(callback) {
  const q = query(collection(db, RESERVAS_COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data()));
  });
}

export async function actualizarEstadoReserva(id, status) {
  await updateDoc(doc(db, RESERVAS_COL, id), { status });
}

export async function borrarReserva(id) {
  await deleteDoc(doc(db, RESERVAS_COL, id));
}
EOF

# ─────────────────────────────────────────────
echo "==> Escribiendo src/App.jsx"
cat > src/App.jsx << 'EOF'
import { useState, useEffect } from "react";
import {
  subscribeToMesas,
  seedBaseMesasIfEmpty,
  reservarMesa,
} from "./firebase/mesasService";
import { guardarReserva } from "./firebase/reservasService";
import AdminPanel from "./components/AdminPanel";

function useHashRoute() {
  const [hash, setHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash : ""
  );
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

const G = "#E8A020";
const BG = "#09111f";
const CARD = "#0f1a2e";
const CARD2 = "#142035";
const WA_GREEN = "#25D366";

// ⚠️ CAMBIAR: número de WhatsApp del organizador.
// Formato internacional sin "+" ni guiones ni espacios.
// Ejemplo El Salvador: "50370001234"
const WHATSAPP_NUMBER = "50374951368";
// Cómo se muestra al usuario (con formato legible).
const WHATSAPP_DISPLAY = "+503 7495-1368";

const COMBOS = [
  { id:1, name:"Individual", price:20, hasMesa:false, icon:"🎫",
    items:["1 entrada","1 soda o cerveza","1 plato de comida"] },
  { id:2, name:"Para dos", price:35, hasMesa:false, icon:"🥂",
    items:["2 entradas","2 tragos preparados José Cuervo","1 nacho"] },
  { id:3, name:"Cena Grupal", price:80, hasMesa:true, icon:"🍽️",
    items:["4 entradas","4 platos de comida","4 sodas","Mesa + 4 sillas"] },
  { id:4, name:"Para Compartir", price:70, hasMesa:true, icon:"🍺",
    note:"+$2 cambia a cervezas",
    items:["4 entradas","4 sodas o cervezas","2 nachos","Mesa + 4 sillas"] },
  { id:5, name:"Bienvenida", price:70, hasMesa:true, icon:"🎉",
    items:["4 entradas","8 cervezas","Mesa + 4 sillas"] },
];

export default function App() {
  const hash = useHashRoute();
  if (hash === "#admin") return <AdminPanel />;
  return <Reservas />;
}

function Reservas() {
  const [tab, setTab] = useState("mesas");
  const [step, setStep] = useState("browse");
  const [selMesa, setSelMesa] = useState(null);
  const [selCombo, setSelCombo] = useState(null);
  const [comboMesa, setComboMesa] = useState(null);
  const [form, setForm] = useState({ name:"", phone:"" });
  const [res, setRes] = useState({ g:{}, v:{} });
  const [confirm, setConfirm] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Outfit:wght@300;400;500;600&display=swap";
    document.head.appendChild(link);

    let unsub = null;
    (async () => {
      try {
        await seedBaseMesasIfEmpty();
      } catch (e) {
        console.error("Error sembrando mesas iniciales:", e);
      }
      unsub = subscribeToMesas((data) => {
        setRes(data);
        setLoaded(true);
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  const getStatus = (type, n) => {
    const v = res[type]?.[n];
    if (!v) return "a";
    if (v === "D") return "d";
    return "r";
  };

  const countAvail = (type, total) =>
    Array.from({length:total},(_,i)=>i+1).filter(n=>getStatus(type,n)==="a").length;

  const clickMesa = (type, n) => {
    if (getStatus(type,n) !== "a") return;
    const inSel = step === "selectMesa";
    const cur = inSel ? comboMesa : selMesa;
    const same = cur?.type===type && cur?.n===n;
    if (inSel) setComboMesa(same ? null : {type,n});
    else setSelMesa(same ? null : {type,n});
  };

  const proceed = () => {
    if (tab==="mesas" && selMesa) { setStep("form"); return; }
    if (tab==="combos" && selCombo) {
      setStep(selCombo.hasMesa ? "selectMesa" : "form");
    }
  };

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim() || submitting) return;
    setSubmitting(true);
    setErrorMsg("");
    const mesa = selMesa || comboMesa;
    const id = "R-" + Math.random().toString(36).slice(2,8).toUpperCase();
    try {
      if (mesa) {
        await reservarMesa(mesa.type, mesa.n, form.name.trim(), id);
      }
      await guardarReserva({
        id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        mesa,
        combo: selCombo,
      });
      setConfirm({ id, ...form, mesa, combo:selCombo });
      setStep("done");
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "No se pudo guardar la reserva. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep("browse"); setSelMesa(null); setSelCombo(null);
    setComboMesa(null); setForm({name:"",phone:""});
    setConfirm(null); setErrorMsg("");
  };

  const inSel = step === "selectMesa";
  const activeMesa = inSel ? comboMesa : selMesa;
  const hasAction = selMesa || selCombo || comboMesa;

  const S = {
    root: { fontFamily:"'Outfit',sans-serif", background:BG, minHeight:"100vh", color:"#ccd6f0", maxWidth:520, margin:"0 auto", paddingBottom: hasAction ? 88 : 24 },
    hdr: { background:CARD, borderBottom:`1px solid ${G}30`, padding:"20px 18px 16px", textAlign:"center" },
    h1: { fontFamily:"'Cinzel',serif", fontSize:19, color:G, margin:0, letterSpacing:3 },
    sub: { fontSize:11, color:"#667", marginTop:3, letterSpacing:2 },
    statsRow: { display:"flex", background:CARD, borderBottom:"1px solid #1a2d45" },
    statCell: { flex:1, padding:"10px 0", textAlign:"center", borderRight:"1px solid #1a2d45" },
    sv: { color:G, fontWeight:600, fontSize:20, fontFamily:"'Cinzel',serif" },
    sl: { color:"#556", fontSize:10, marginTop:1 },
    tabs: { display:"flex", background:CARD, borderBottom:"1px solid #1a2d45", position:"sticky", top:0, zIndex:9 },
    tab: (a) => ({ flex:1, padding:"12px", border:"none", background:"transparent", color:a?G:"#556", fontFamily:"'Outfit',sans-serif", fontSize:13, fontWeight:a?600:400, cursor:"pointer", borderBottom:a?`2px solid ${G}`:"2px solid transparent", transition:"color .15s" }),
    selBanner: { display:"flex", justifyContent:"space-between", alignItems:"center", background:`${G}10`, borderBottom:`1px solid ${G}30`, padding:"10px 16px" },
    legend: { display:"flex", flexWrap:"wrap", gap:10, padding:"10px 16px", background:CARD, borderBottom:"1px solid #1a2d45", fontSize:11, color:"#778" },
    sec: { padding:"16px 14px 4px" },
    secHd: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
    secT: { fontFamily:"'Cinzel',serif", fontSize:11, color:G, letterSpacing:2 },
    secC: { fontSize:11, color:"#556" },
    grid10: { display:"grid", gridTemplateColumns:"repeat(10,1fr)", gap:4, marginBottom:14 },
    grid7:  { display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:14 },
    mesa: (s,sel) => ({
      aspectRatio:"1", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:10, fontWeight:600, cursor:s==="a"?"pointer":"default", transition:"all .12s",
      border: sel?`1.5px solid ${G}`: s==="a"?"1px solid #1e3a5a": s==="r"?"1px solid #3a1010":"1px solid #141414",
      background: sel?`${G}20`: s==="a"?"#0c1c30": s==="r"?"#1c0808":"#0e0e0e",
      color: sel?G: s==="a"?"#4a8fcc": s==="r"?"#7a2020":"#1e1e1e",
      outline: sel?`1px solid ${G}40`:"none",
    }),
    comboCard: (sel) => ({
      background:sel?`${G}0e`:CARD2, border:sel?`1.5px solid ${G}`:"1px solid #1a2d45",
      borderRadius:12, padding:14, marginBottom:10, cursor:"pointer", transition:"all .15s"
    }),
    fLabel: { fontSize:11, color:"#778", letterSpacing:1, marginBottom:5, display:"block" },
    fInput: { width:"100%", padding:"11px 13px", background:CARD2, border:"1px solid #1e3050", borderRadius:9, color:"#ccd6f0", fontSize:14, fontFamily:"'Outfit',sans-serif", boxSizing:"border-box", outline:"none" },
    btn: (dis) => ({ width:"100%", padding:"13px", background:dis?"#131e2e":G, color:dis?"#2a3a4a":"#0a0f18", border:"none", borderRadius:9, fontSize:14, fontWeight:600, cursor:dis?"default":"pointer", fontFamily:"'Outfit',sans-serif", letterSpacing:.5, transition:"background .15s" }),
    bottomBar: { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:520, background:CARD, borderTop:`1px solid ${G}30`, padding:"11px 14px", boxSizing:"border-box", zIndex:20 },
    barInfo: { fontSize:12, color:"#778", marginBottom:8 },
    back: { background:"transparent", border:"none", color:"#778", cursor:"pointer", padding:"10px 16px 0", fontSize:12, fontFamily:"'Outfit',sans-serif", display:"block" },
    sumCard: { background:CARD2, border:`1px solid ${G}20`, borderRadius:11, padding:13, marginBottom:14 },
    sumRow: { display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #1a2d45", fontSize:13 },
    confCard: { background:CARD2, border:"1px solid #1a3a1a", borderRadius:13, padding:18, margin:"14px 14px 18px" },
    confId: { fontFamily:"'Cinzel',serif", fontSize:22, color:G, textAlign:"center", letterSpacing:4, margin:"0 0 16px", paddingBottom:16, borderBottom:`1px solid ${G}20` },
    waCard: { background:`${WA_GREEN}0d`, border:`1px solid ${WA_GREEN}55`, borderRadius:13, padding:16, margin:"0 14px 18px" },
    waBtn: { display:"flex", alignItems:"center", justifyContent:"center", gap:6, width:"100%", padding:"13px", background:WA_GREEN, color:"#0a1f12", border:"none", borderRadius:9, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Outfit',sans-serif", letterSpacing:.5, textDecoration:"none", boxSizing:"border-box" },
    errBox: { background:"#2a0e0e", border:"1px solid #6a1c1c", color:"#ffb3b3", padding:"10px 12px", borderRadius:8, fontSize:12, marginBottom:12 },
  };

  if (!loaded) return (
    <div style={{...S.root,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:G,fontFamily:"'Cinzel',serif",letterSpacing:3,fontSize:14}}>Cargando...</div>
    </div>
  );

  if (step==="done" && confirm) {
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${confirm.id}|${confirm.name}|${confirm.phone}`)}&bgcolor=142035&color=E8A020&qzone=2`;
    const rows = [
      ["Nombre", confirm.name],
      ["Teléfono", confirm.phone],
      confirm.mesa && ["Mesa", `${confirm.mesa.type==="v"?"VIP ":""}#${confirm.mesa.n}`],
      confirm.combo && ["Combo", `#${confirm.combo.id} ${confirm.combo.name} ($${confirm.combo.price})`],
    ].filter(Boolean);

    const waMsg = `Hola! Adjunto mi comprobante de pago para la reserva ${confirm.id} a nombre de ${confirm.name}.`;
    const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;

    return (
      <div style={S.root}>
        <div style={{...S.hdr,paddingTop:22}}>
          <div style={{fontSize:36,marginBottom:6}}>✅</div>
          <div style={{...S.h1,color:"#3ecf74"}}>¡Reserva Confirmada!</div>
          <div style={S.sub}>MIÉRCOLES 20 DE MAYO</div>
        </div>
        <div style={S.confCard}>
          <div style={{textAlign:"center",padding:"12px 0 18px"}}>
            <img src={qr} alt="QR" style={{width:140,height:140,borderRadius:8}} onError={e=>e.target.style.display="none"} />
          </div>
          <div style={S.confId}>{confirm.id}</div>
          {rows.map(([k,v])=>(
            <div key={k} style={S.sumRow}>
              <span style={{color:"#778"}}>{k}</span>
              <span style={{color:"#ccd6f0",fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={S.waCard}>
          <div style={{fontSize:11,color:WA_GREEN,letterSpacing:1.5,fontWeight:700,marginBottom:10,textAlign:"center"}}>
            ⚠️ ÚLTIMO PASO PARA COMPLETAR
          </div>
          <div style={{fontSize:13,color:"#ccd6f0",lineHeight:1.55,marginBottom:14,textAlign:"center"}}>
            Para completar tu reserva, envía tu <b>comprobante de pago</b> por WhatsApp al{" "}
            <b style={{color:WA_GREEN}}>📱 {WHATSAPP_DISPLAY}</b>{" "}
            indicando tu código{" "}
            <b style={{color:G,fontFamily:"'Cinzel',serif",letterSpacing:2}}>{confirm.id}</b>
          </div>
          <a href={waLink} target="_blank" rel="noreferrer" style={S.waBtn}>
            💬  Abrir WhatsApp
          </a>
          <div style={{fontSize:10,color:"#778",textAlign:"center",marginTop:10,lineHeight:1.4}}>
            Tu mesa queda reservada al instante. La reserva se aprueba al recibir el comprobante.
          </div>
        </div>

        <div style={{padding:"0 14px"}}>
          <div style={{fontSize:12,color:"#667",textAlign:"center",marginBottom:14}}>Presenta este código al ingresar al evento</div>
          <button onClick={reset} style={S.btn(false)}>Nueva reserva</button>
        </div>
      </div>
    );
  }

  if (step==="form") {
    const mesa = selMesa || comboMesa;
    const ok = form.name.trim().length > 0 && form.phone.trim().length > 0 && !submitting;
    return (
      <div style={S.root}>
        <div style={S.hdr}>
          <div style={S.h1}>Completa tu reserva</div>
          <div style={S.sub}>MIÉRCOLES 20 DE MAYO 2025</div>
        </div>
        <button style={S.back} onClick={()=>{ setErrorMsg(""); setStep(selCombo?.hasMesa?"selectMesa":"browse"); }}>← Volver</button>
        <div style={{padding:"8px 14px 20px"}}>
          <div style={S.sumCard}>
            <div style={{fontSize:10,color:G,letterSpacing:1,marginBottom:8}}>RESUMEN</div>
            {selCombo && <div style={{fontSize:13,marginBottom:3}}>Combo #{selCombo.id}: <b style={{color:G}}>{selCombo.name}</b> — <b style={{color:G}}>${selCombo.price}</b></div>}
            {mesa && <div style={{fontSize:13}}>Mesa <b style={{color:G}}>{mesa.type==="v"?"VIP ":""}#{mesa.n}</b></div>}
            {!selCombo && !mesa && <div style={{fontSize:12,color:"#667"}}>Combo sin mesa incluida</div>}
          </div>
          <div style={{marginBottom:13}}>
            <label style={S.fLabel}>NOMBRE COMPLETO *</label>
            <input style={S.fInput} placeholder="Ej. María García" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
          </div>
          <div style={{marginBottom:13}}>
            <label style={S.fLabel}>TELÉFONO / WHATSAPP *</label>
            <input style={S.fInput} placeholder="0000-0000" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} type="tel" />
          </div>
          <div style={{marginBottom:18}}>
            <label style={S.fLabel}>MÉTODO DE PAGO</label>
            <div style={{background:CARD2,border:"1px solid #1e3050",borderRadius:9,padding:"13px 14px"}}>
              <div style={{fontSize:13,color:"#ccd6f0",lineHeight:1.5}}>
                💵 Pago por <b style={{color:G}}>transferencia bancaria</b> o <b style={{color:G}}>efectivo</b> en el evento.
              </div>
              <div style={{fontSize:11,color:"#778",marginTop:6,lineHeight:1.5}}>
                Luego de confirmar, te mostraremos un código y el número de WhatsApp para enviar el comprobante.
              </div>
            </div>
          </div>
          {errorMsg && <div style={S.errBox}>⚠️ {errorMsg}</div>}
          <button onClick={submit} style={S.btn(!ok)} disabled={!ok}>
            {submitting ? "Guardando..." : "Confirmar Reserva →"}
          </button>
        </div>
      </div>
    );
  }

  const renderGrid = (type, total, cols) => (
    <div style={cols===7?S.grid7:S.grid10}>
      {Array.from({length:total},(_,i)=>i+1).map(n=>{
        const s = getStatus(type,n);
        const sel = activeMesa?.type===type && activeMesa?.n===n;
        return <div key={n} style={S.mesa(s,sel)} onClick={()=>clickMesa(type,n)} title={s==="r"?res[type][n]:s==="d"?"No disponible":""} >{n}</div>;
      })}
    </div>
  );

  const gA = countAvail("g",84), vA = countAvail("v",13);

  return (
    <div style={S.root}>
      <div style={S.hdr}>
        <div style={S.h1}>SISTEMA DE RESERVAS</div>
        <div style={S.sub}>MIÉRCOLES 20 DE MAYO • SELECCIONA TU LUGAR</div>
      </div>
      <div style={S.statsRow}>
        <div style={{...S.statCell,borderLeft:"none"}}><div style={S.sv}>{gA}</div><div style={S.sl}>Generales</div></div>
        <div style={S.statCell}><div style={S.sv}>{vA}</div><div style={S.sl}>VIP disp.</div></div>
        <div style={{...S.statCell,borderRight:"none"}}><div style={S.sv}>{gA+vA}</div><div style={S.sl}>Total libre</div></div>
      </div>
      {inSel && (
        <div style={S.selBanner}>
          <div style={{fontSize:12,color:G}}>🪑 Elige mesa para Combo #{selCombo?.id} — {selCombo?.name}</div>
          <button onClick={()=>{setStep("browse");setComboMesa(null);}} style={{background:"transparent",border:"1px solid #334",borderRadius:5,color:"#778",cursor:"pointer",padding:"3px 9px",fontSize:11}}>Cancelar</button>
        </div>
      )}
      {!inSel && (
        <div style={S.tabs}>
          <button style={S.tab(tab==="mesas")} onClick={()=>setTab("mesas")}>🪑  Mesas</button>
          <button style={S.tab(tab==="combos")} onClick={()=>setTab("combos")}>🎫  Combos</button>
        </div>
      )}
      {(tab==="mesas"||inSel) && (
        <div style={S.legend}>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:13,height:13,borderRadius:3,background:"#0c1c30",border:"1px solid #1e3a5a",display:"inline-block"}}></span>Disponible</span>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:13,height:13,borderRadius:3,background:"#1c0808",border:"1px solid #3a1010",display:"inline-block"}}></span>Reservada</span>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:13,height:13,borderRadius:3,background:"#0e0e0e",border:"1px solid #141414",display:"inline-block"}}></span>No disp.</span>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:13,height:13,borderRadius:3,background:`${G}20`,border:`1.5px solid ${G}`,display:"inline-block"}}></span>Seleccionada</span>
        </div>
      )}
      {(tab==="mesas"||inSel) && (
        <>
          <div style={S.sec}>
            <div style={S.secHd}><span style={S.secT}>MESAS VIP</span><span style={S.secC}>{vA} disponibles</span></div>
            {renderGrid("v",13,7)}
          </div>
          <div style={S.sec}>
            <div style={S.secHd}><span style={S.secT}>MESAS GENERALES</span><span style={S.secC}>{gA} disponibles</span></div>
            {renderGrid("g",84,10)}
          </div>
        </>
      )}
      {tab==="combos" && !inSel && (
        <div style={S.sec}>
          {COMBOS.map(c=>(
            <div key={c.id} style={S.comboCard(selCombo?.id===c.id)} onClick={()=>setSelCombo(prev=>prev?.id===c.id?null:c)}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:24}}>{c.icon}</span>
                  <div>
                    <div style={{fontSize:10,color:G,letterSpacing:1}}>COMBO #{c.id}</div>
                    <div style={{fontSize:15,fontWeight:600,color:"#ccd6f0"}}>{c.name}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:19,color:G,fontWeight:700}}>${c.price}</div>
                  {c.hasMesa && <span style={{fontSize:10,color:"#3ecf74",background:"#0a2a14",padding:"2px 7px",borderRadius:20,display:"inline-block"}}>Incluye mesa</span>}
                </div>
              </div>
              <div style={{fontSize:12,color:"#889"}}>
                {c.items.map((item,i)=><div key={i} style={{padding:"2px 0"}}><span style={{color:G,opacity:.5}}>• </span>{item}</div>)}
                {c.note && <div style={{fontSize:11,color:"#667",fontStyle:"italic",marginTop:5}}>{c.note}</div>}
              </div>
              {selCombo?.id===c.id && (
                <div style={{marginTop:9,padding:"5px 12px",background:`${G}15`,borderRadius:7,fontSize:11,color:G,textAlign:"center"}}>
                  ✓ Seleccionado{c.hasMesa?" — elige tu mesa en el siguiente paso":""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {hasAction && (
        <div style={S.bottomBar}>
          <div style={S.barInfo}>
            {selMesa && !inSel && <>Mesa: <b style={{color:G}}>{selMesa.type==="v"?"VIP ":""}#{selMesa.n}</b></>}
            {selCombo && !inSel && <>Combo <b style={{color:G}}>#{selCombo.id} {selCombo.name}</b>{comboMesa&&<> · Mesa <b style={{color:"#3ecf74"}}>{comboMesa.type==="v"?"VIP ":""}#{comboMesa.n}</b></>}</>}
            {inSel && !comboMesa && <span style={{color:"#778"}}>Toca una mesa disponible del mapa</span>}
            {inSel && comboMesa && <>Mesa elegida: <b style={{color:G}}>{comboMesa.type==="v"?"VIP ":""}#{comboMesa.n}</b></>}
          </div>
          <button
            onClick={()=>{ if(inSel&&comboMesa){setStep("form");return;} if(!inSel)proceed(); }}
            style={S.btn(inSel&&!comboMesa)}
            disabled={inSel&&!comboMesa}
          >
            {inSel ? "Confirmar mesa →" : (selCombo?.hasMesa ? "Elegir mesa →" : "Reservar →")}
          </button>
        </div>
      )}
    </div>
  );
}
EOF

# ─────────────────────────────────────────────
echo "==> Escribiendo src/components/AdminPanel.jsx"
cat > src/components/AdminPanel.jsx << 'EOF'
import { useState, useEffect, useMemo } from "react";
import { subscribeToMesas, liberarMesa } from "../firebase/mesasService";
import {
  subscribeToReservas,
  actualizarEstadoReserva,
  borrarReserva,
} from "../firebase/reservasService";

// ⚠️ Credenciales hardcodeadas — sólo para uso interno antes del evento.
// Para producción real, migrar a Firebase Auth.
const ADMIN_USER = "admin";
const ADMIN_PASS = "evento2025";
const SESSION_KEY = "rsv_admin_session";

const G = "#E8A020";
const BG = "#09111f";
const CARD = "#0f1a2e";
const CARD2 = "#142035";
const GREEN = "#3ecf74";
const RED = "#e8584b";
const YELLOW = "#e8b020";

const TOTAL_G = 84;
const TOTAL_V = 13;

const STATUS_LABELS = {
  pending:   { label: "PENDIENTE", color: YELLOW, bg: "#2a230a" },
  confirmed: { label: "APROBADA",  color: GREEN,  bg: "#0a2a14" },
  rejected:  { label: "RECHAZADA", color: RED,    bg: "#2a0e0e" },
};

export default function AdminPanel() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "ok"
  );
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState("");

  const [mesas, setMesas] = useState({ g: {}, v: {} });
  const [reservas, setReservas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState({});

  useEffect(() => {
    if (!authed) return;
    let mLoaded = false, rLoaded = false;
    const markLoaded = () => { if (mLoaded && rLoaded) setLoaded(true); };
    const unsubM = subscribeToMesas((data) => { setMesas(data); mLoaded = true; markLoaded(); });
    const unsubR = subscribeToReservas((data) => { setReservas(data); rLoaded = true; markLoaded(); });
    return () => { unsubM(); unsubR(); };
  }, [authed]);

  const counts = useMemo(() => {
    const countByStatus = (type, total) => {
      let sold = 0, blocked = 0;
      for (let n = 1; n <= total; n++) {
        const v = mesas[type]?.[n];
        if (v === "D") blocked++;
        else if (v) sold++;
      }
      return { sold, blocked, free: total - sold - blocked, total };
    };
    return {
      g: countByStatus("g", TOTAL_G),
      v: countByStatus("v", TOTAL_V),
    };
  }, [mesas]);

  const filteredReservas = useMemo(() => {
    if (filter === "all") return reservas;
    return reservas.filter((r) => (r.status || "pending") === filter);
  }, [reservas, filter]);

  const doLogin = () => {
    if (user.trim() === ADMIN_USER && pass === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, "ok");
      setAuthed(true);
      setUser(""); setPass(""); setLoginError("");
    } else {
      setLoginError("Usuario o contraseña incorrectos");
    }
  };

  const doLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
  };

  const setReservaBusy = (id, on) => setBusy((b) => ({ ...b, [id]: on }));

  const approve = async (r) => {
    setReservaBusy(r.id, true);
    try { await actualizarEstadoReserva(r.id, "confirmed"); }
    catch (e) { alert("Error: " + e.message); }
    finally { setReservaBusy(r.id, false); }
  };

  const reject = async (r) => {
    setReservaBusy(r.id, true);
    try { await actualizarEstadoReserva(r.id, "rejected"); }
    catch (e) { alert("Error: " + e.message); }
    finally { setReservaBusy(r.id, false); }
  };

  const remove = async (r) => {
    const msg = `¿Eliminar la reserva ${r.id} de ${r.name}?\n\n` +
      (r.mesa ? `• La mesa ${r.mesa.type === "v" ? "VIP " : ""}#${r.mesa.n} quedará LIBRE de nuevo.\n` : "") +
      "\nEsta acción no se puede deshacer.";
    if (!confirm(msg)) return;
    setReservaBusy(r.id, true);
    try {
      if (r.mesa) {
        try { await liberarMesa(r.mesa.type, r.mesa.n); } catch (e) { console.warn("liberarMesa:", e); }
      }
      await borrarReserva(r.id);
    } catch (e) {
      alert("Error al borrar: " + e.message);
    } finally {
      setReservaBusy(r.id, false);
    }
  };

  const S = {
    root: { fontFamily: "'Outfit',sans-serif", background: BG, minHeight: "100vh", color: "#ccd6f0", maxWidth: 980, margin: "0 auto" },
    hdr: { background: CARD, borderBottom: `1px solid ${G}30`, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 },
    h1: { fontFamily: "'Cinzel',serif", fontSize: 18, color: G, margin: 0, letterSpacing: 3 },
    sub: { fontSize: 11, color: "#667", marginTop: 3, letterSpacing: 1.5 },

    loginWrap: { display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px", minHeight: "calc(100vh - 100px)" },
    loginCard: { background: CARD, border: `1px solid ${G}30`, borderRadius: 14, padding: "28px 22px", width: "100%", maxWidth: 360 },
    fLabel: { fontSize: 11, color: "#778", letterSpacing: 1, marginBottom: 5, display: "block" },
    fInput: { width: "100%", padding: "11px 13px", background: CARD2, border: "1px solid #1e3050", borderRadius: 9, color: "#ccd6f0", fontSize: 14, fontFamily: "'Outfit',sans-serif", boxSizing: "border-box", outline: "none" },
    primaryBtn: { width: "100%", padding: "12px", background: G, color: "#0a0f18", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif", letterSpacing: .5 },
    smallBtn: (color) => ({ padding: "6px 12px", background: "transparent", color, border: `1px solid ${color}50`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif", letterSpacing: .5 }),
    ghostBtn: { padding: "8px 14px", background: "transparent", color: "#889", border: "1px solid #2a3d5a", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif" },

    countersGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, padding: "14px 16px" },
    countCard: { background: CARD2, border: `1px solid ${G}20`, borderRadius: 11, padding: 14 },
    countTitle: { fontSize: 10, color: G, letterSpacing: 1.5, marginBottom: 8 },
    countRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
    countBig: { fontFamily: "'Cinzel',serif", fontSize: 26, color: G, fontWeight: 700 },
    countSub: { fontSize: 11, color: "#667" },
    bar: { height: 5, background: "#0a1424", borderRadius: 3, overflow: "hidden", marginTop: 9, display: "flex" },
    barSeg: (color, pct) => ({ background: color, width: `${pct}%`, height: "100%" }),

    filterRow: { display: "flex", gap: 6, padding: "8px 16px 4px", flexWrap: "wrap" },
    filterPill: (active, color) => ({ padding: "6px 12px", borderRadius: 999, fontSize: 11, letterSpacing: 1, fontWeight: 600, cursor: "pointer", border: active ? `1px solid ${color}` : "1px solid #2a3d5a", background: active ? `${color}1a` : "transparent", color: active ? color : "#778", fontFamily: "'Outfit',sans-serif" }),

    listWrap: { padding: "10px 16px 30px" },
    resCard: { background: CARD2, border: "1px solid #1a2d45", borderRadius: 11, padding: 14, marginBottom: 10 },
    resTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" },
    resId: { fontFamily: "'Cinzel',serif", fontSize: 14, color: G, letterSpacing: 2 },
    statusPill: (s) => ({ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, padding: "3px 9px", borderRadius: 999, color: STATUS_LABELS[s].color, background: STATUS_LABELS[s].bg }),
    resGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 10 },
    resField: {},
    fk: { fontSize: 10, color: "#667", letterSpacing: 1, marginBottom: 2 },
    fv: { fontSize: 13, color: "#ccd6f0", fontWeight: 500 },
    resActions: { display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid #1a2d45" },

    empty: { padding: "60px 20px", textAlign: "center", color: "#556" },
  };

  if (!authed) {
    return (
      <div style={S.root}>
        <div style={S.hdr}>
          <div>
            <div style={S.h1}>PANEL DE ADMINISTRACIÓN</div>
            <div style={S.sub}>SISTEMA DE RESERVAS</div>
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ""; }} style={{ color: "#778", fontSize: 12, textDecoration: "none" }}>← Volver al sitio</a>
        </div>
        <div style={S.loginWrap}>
          <div style={S.loginCard}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>🔒</div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: G, letterSpacing: 3 }}>ACCESO RESTRINGIDO</div>
            </div>
            <div style={{ marginBottom: 13 }}>
              <label style={S.fLabel}>USUARIO</label>
              <input style={S.fInput} value={user} onChange={(e) => setUser(e.target.value)} autoFocus autoComplete="username" />
            </div>
            <div style={{ marginBottom: 13 }}>
              <label style={S.fLabel}>CONTRASEÑA</label>
              <input type="password" style={S.fInput} value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} autoComplete="current-password" />
            </div>
            {loginError && <div style={{ background: "#2a0e0e", border: "1px solid #6a1c1c", color: "#ffb3b3", padding: "8px 11px", borderRadius: 7, fontSize: 12, marginBottom: 12 }}>⚠️ {loginError}</div>}
            <button style={S.primaryBtn} onClick={doLogin}>Ingresar</button>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div style={{ ...S.root, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ color: G, fontFamily: "'Cinzel',serif", letterSpacing: 3, fontSize: 14 }}>Cargando...</div>
      </div>
    );
  }

  const filterDefs = [
    { key: "all",       label: `TODAS (${reservas.length})`, color: G },
    { key: "pending",   label: `PENDIENTES (${reservas.filter(r => (r.status || "pending") === "pending").length})`, color: YELLOW },
    { key: "confirmed", label: `APROBADAS (${reservas.filter(r => r.status === "confirmed").length})`, color: GREEN },
    { key: "rejected",  label: `RECHAZADAS (${reservas.filter(r => r.status === "rejected").length})`, color: RED },
  ];

  return (
    <div style={S.root}>
      <div style={S.hdr}>
        <div>
          <div style={S.h1}>PANEL DE RESERVAS</div>
          <div style={S.sub}>MIÉRCOLES 20 DE MAYO • {reservas.length} reservas totales</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ""; }} style={{ ...S.ghostBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Sitio público</a>
          <button style={S.ghostBtn} onClick={doLogout}>Cerrar sesión</button>
        </div>
      </div>

      <div style={S.countersGrid}>
        {[
          { key: "g", title: "MESAS GENERALES", c: counts.g },
          { key: "v", title: "MESAS VIP",       c: counts.v },
        ].map(({ key, title, c }) => {
          const soldPct    = (c.sold / c.total) * 100;
          const blockedPct = (c.blocked / c.total) * 100;
          return (
            <div key={key} style={S.countCard}>
              <div style={S.countTitle}>{title}</div>
              <div style={S.countRow}>
                <span style={S.countBig}>{c.sold}<span style={{ fontSize: 14, color: "#556" }}> / {c.total}</span></span>
                <span style={S.countSub}>{c.free} libres · {c.blocked} bloqueadas</span>
              </div>
              <div style={S.bar}>
                <div style={S.barSeg(G, soldPct)} title={`Vendidas: ${c.sold}`}></div>
                <div style={S.barSeg("#3a1010", blockedPct)} title={`Bloqueadas: ${c.blocked}`}></div>
              </div>
            </div>
          );
        })}
        <div style={S.countCard}>
          <div style={S.countTitle}>INGRESO ESTIMADO</div>
          <div style={S.countRow}>
            <span style={S.countBig}>${reservas.filter(r => r.status === "confirmed").reduce((sum, r) => sum + (r.combo?.price || 0), 0)}</span>
            <span style={S.countSub}>aprobadas · ${reservas.reduce((sum, r) => sum + (r.combo?.price || 0), 0)} totales</span>
          </div>
          <div style={{ ...S.bar, background: "#0a2a14" }}>
            <div style={S.barSeg(GREEN, reservas.length ? (reservas.filter(r => r.status === "confirmed").length / reservas.length) * 100 : 0)}></div>
          </div>
        </div>
      </div>

      <div style={S.filterRow}>
        {filterDefs.map((f) => (
          <button key={f.key} style={S.filterPill(filter === f.key, f.color)} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={S.listWrap}>
        {filteredReservas.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: 30, marginBottom: 10, opacity: .4 }}>📋</div>
            <div>No hay reservas {filter !== "all" ? `con estado "${filter}"` : "todavía"}.</div>
          </div>
        )}

        {filteredReservas.map((r) => {
          const status = r.status || "pending";
          const isBusy = !!busy[r.id];
          const created = r.createdAt?.toDate ? r.createdAt.toDate() : null;
          return (
            <div key={r.id} style={S.resCard}>
              <div style={S.resTop}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={S.resId}>{r.id}</span>
                  <span style={S.statusPill(status)}>{STATUS_LABELS[status].label}</span>
                </div>
                {created && (
                  <span style={{ fontSize: 11, color: "#556" }}>
                    {created.toLocaleString("es-SV", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>

              <div style={S.resGrid}>
                <div style={S.resField}><div style={S.fk}>NOMBRE</div><div style={S.fv}>{r.name}</div></div>
                <div style={S.resField}><div style={S.fk}>TELÉFONO</div><div style={S.fv}>{r.phone}</div></div>
                <div style={S.resField}>
                  <div style={S.fk}>MESA</div>
                  <div style={S.fv}>{r.mesa ? `${r.mesa.type === "v" ? "VIP " : "Gen. "}#${r.mesa.n}` : <span style={{ color: "#556" }}>—</span>}</div>
                </div>
                <div style={S.resField}>
                  <div style={S.fk}>COMBO</div>
                  <div style={S.fv}>{r.combo ? `#${r.combo.id} ${r.combo.name} · $${r.combo.price}` : <span style={{ color: "#556" }}>—</span>}</div>
                </div>
              </div>

              <div style={S.resActions}>
                {status !== "confirmed" && (
                  <button style={S.smallBtn(GREEN)} disabled={isBusy} onClick={() => approve(r)}>✓ Aprobar</button>
                )}
                {status !== "rejected" && (
                  <button style={S.smallBtn(YELLOW)} disabled={isBusy} onClick={() => reject(r)}>✕ Rechazar</button>
                )}
                <button style={S.smallBtn(RED)} disabled={isBusy} onClick={() => remove(r)}>🗑 Borrar{r.mesa ? " (libera mesa)" : ""}</button>
                {isBusy && <span style={{ fontSize: 11, color: "#556", alignSelf: "center" }}>Procesando…</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
EOF

# ─────────────────────────────────────────────
echo ""
echo "==> Instalando dependencias (puede tardar 30-60 segundos)..."
npm install

echo ""
echo "════════════════════════════════════════════"
echo "✅  TODO LISTO"
echo "════════════════════════════════════════════"
echo ""
echo "  🌐 Sitio público: ver el preview de StackBlitz"
echo "  🔒 Admin panel:   agregá  #admin  al final de la URL"
echo "       Usuario:    admin"
echo "       Contraseña: evento2025"
echo ""
echo "  📱 WhatsApp configurado: +503 7495-1368"
echo "  🔥 Firebase project:     reservas-evento"
echo ""
