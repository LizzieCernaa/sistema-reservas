import { useState, useEffect, useMemo } from "react";
import {
  subscribeToMesas,
  liberarMesa,
  borrarTodasLasMesas, 
  seedBaseMesasIfEmpty,
} from "../firebase/mesasService";
import {
  subscribeToReservas, 
  actualizarEstadoReserva,
  borrarReserva,
} from "../firebase/reservasService";

// ⚠️  Credenciales hardcodeadas — sólo para uso interno antes del evento.
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
const TOTAL_V = 17;

// Precios para cálculo de ingresos
const PRICE_MESA_G = 6;
const PRICE_MESA_V = 60;

// Suma el ingreso total de una reserva: mesa (si tiene) + combo (si tiene).
const reservaTotal = (r) => { 
  let total = 0;
  if (r.mesa?.type === "v") total += PRICE_MESA_V;
  else if (r.mesa?.type === "g") total += PRICE_MESA_G;
  if (r.combo) total += r.combo.price || 0;
  return total;
};

const STATUS_LABELS = {
  pending: { label: "PENDIENTE", color: YELLOW, bg: "#2a230a" },
  confirmed: { label: "APROBADO", color: GREEN, bg: "#0a2a14" },
  rejected: { label: "RECHAZADO", color: RED, bg: "#2a0e0e" },
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
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!authed) return;
    let mLoaded = false;
    let rLoaded = false;
    const markLoaded = () => {
      if (mLoaded && rLoaded) setLoaded(true);
    };
    const unsubM = subscribeToMesas((data) => {
      setMesas(data);
      mLoaded = true;
      markLoaded();
    });
    const unsubR = subscribeToReservas((data) => {
      setReservas(data);
      rLoaded = true;
      markLoaded();
    });
    return () => {
      unsubM();
      unsubR();
    };
  }, [authed]);

  const counts = useMemo(() => {
    const countByStatus = (type, total) => {
      let sold = 0;
      let blocked = 0; 
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
      setUser("");  
      setPass("");
      setLoginError("");
    } else {
      setLoginError("Usuario o contraseña incorrectos");
    }
  };

  const doLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
  };

  const setReservaBusy = (id, on) =>
    setBusy((b) => ({ ...b, [id]: on }));

  const approve = async (r) => {
    setReservaBusy(r.id, true);
    try {
      await actualizarEstadoReserva(r.id, "confirmed");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setReservaBusy(r.id, false);
    }
  };

  const reject = async (r) => {
    setReservaBusy(r.id, true);
    try {
      await actualizarEstadoReserva(r.id, "rejected");
    } catch (e) {   
      alert("Error: " + e.message);
    } finally {
      setReservaBusy(r.id, false);
    }
  };

  const handleResetMesas = async () => {
    const c1 = confirm(
      "¿Estás segura? Esto borrará TODAS las reservas de mesas."
    );
    if (!c1) return;
    const c2 = confirm(
      "Esta acción es IRREVERSIBLE. Las mesas reservadas " +
        "perderán su asignación. ¿Continuar definitivamente?"
    );    
    if (!c2) return;
    setResetting(true);
    try {
      const deleted = await borrarTodasLasMesas();
      await seedBaseMesasIfEmpty();
      alert(
        `✅ ${deleted} mesa(s) borradas. ` +
          `Sólo las marcadas como "No disponible" quedan bloqueadas.`
      );  
    } catch (e) {
      alert("Error al resetear: " + e.message);
    } finally {
      setResetting(false);
    }
  };

  const remove = async (r) => {
    const mesaLine = r.mesa
      ? `• La mesa ${r.mesa.type === "v" ? "VIP " : ""}` +
        `#${r.mesa.n} quedará LIBRE de nuevo.\n`
      : "";
    const msg =
      `¿Eliminar la reserva ${r.id} de ${r.name}?\n\n` +
      mesaLine +
      "\nEsta acción no se puede deshacer.";
    if (!confirm(msg)) return;
    setReservaBusy(r.id, true);
    try { 
      if (r.mesa) {
        try {
          await liberarMesa(r.mesa.type, r.mesa.n);
        } catch (e) {
          console.warn("liberarMesa:", e);
        }
      }
      await borrarReserva(r.id);
    } catch (e) {
      alert("Error al borrar: " + e.message);
    } finally {
      setReservaBusy(r.id, false);
    }
  };

  const S = {
    root: {
      fontFamily: "'Outfit',sans-serif",
      background: BG,
      minHeight: "100vh",
      color: "#ccd6f0",
      maxWidth: 980,
      margin: "0 auto",
    },
    hdr: {
      background: CARD,
      borderBottom: `1px solid ${G}30`,
      padding: "16px 20px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",   
      flexWrap: "wrap",
      gap: 10,
    },
    h1: {
      fontFamily: "'Cinzel',serif",
      fontSize: 18,
      color: G,
      margin: 0,
      letterSpacing: 3,
    },
    sub: {
      fontSize: 11,
      color: "#667",
      marginTop: 3, 
      letterSpacing: 1.5,
    },
    loginWrap: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 20px",   
      minHeight: "calc(100vh - 100px)",
    },
    loginCard: {
      background: CARD,
      border: `1px solid ${G}30`,
      borderRadius: 14,
      padding: "28px 22px",
      width: "100%",
      maxWidth: 360,
    },
    fLabel: {
      fontSize: 11,
      color: "#778",
      letterSpacing: 1,
      marginBottom: 5,
      display: "block",
    },    
    fInput: {
      width: "100%",
      padding: "11px 13px",
      background: CARD2,
      border: "1px solid #1e3050",
      borderRadius: 9,
      color: "#ccd6f0",
      fontSize: 14,
      fontFamily: "'Outfit',sans-serif",
      boxSizing: "border-box",
      outline: "none",
    },    
    primaryBtn: {
      width: "100%",
      padding: "12px",
      background: G,
      color: "#0a0f18",
      border: "none",
      borderRadius: 9, 
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "'Outfit',sans-serif",
      letterSpacing: 0.5,
    },    
    smallBtn: (color) => ({
      padding: "6px 12px",
      background: "transparent",
      color,
      border: `1px solid ${color}50`,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "'Outfit',sans-serif",
      letterSpacing: 0.5,
    }),
    ghostBtn: {
      padding: "8px 14px",
      background: "transparent", 
      color: "#889",
      border: "1px solid #2a3d5a",
      borderRadius: 7,
      fontSize: 12, 
      cursor: "pointer",
      fontFamily: "'Outfit',sans-serif",
    },

    countersGrid: {
      display: "grid", 
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 10,
      padding: "14px 16px",
    },    
    countCard: {
      background: CARD2,
      border: `1px solid ${G}20`,
      borderRadius: 11,
      padding: 14,
    },
    countTitle: {   
      fontSize: 10,
      color: G,
      letterSpacing: 1.5,
      marginBottom: 8,
    },
    countRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 4,
    },
    countBig: {
      fontFamily: "'Cinzel',serif",
      fontSize: 26,
      color: G,
      fontWeight: 700,
    },
    countSub: { fontSize: 11, color: "#667" },
    bar: {
      height: 5,
      background: "#0a1424",
      borderRadius: 3,
      overflow: "hidden",
      marginTop: 9,
      display: "flex",
    },    
    barSeg: (color, pct) => ({
      background: color,
      width: `${pct}%`,
      height: "100%",
    }),

    filterRow: {
      display: "flex",
      gap: 6,
      padding: "8px 16px 4px",
      flexWrap: "wrap",
    },
    filterPill: (active, color) => ({
      padding: "6px 12px",
      borderRadius: 999,
      fontSize: 11,
      letterSpacing: 1,
      fontWeight: 600,
      cursor: "pointer",
      border: active ? `1px solid ${color}` : "1px solid #2a3d5a",
      background: active ? `${color}1a` : "transparent",
      color: active ? color : "#778",
      fontFamily: "'Outfit',sans-serif",
    }),

    listWrap: { padding: "10px 16px 30px" },
    resCard: {
      background: CARD2,
      border: "1px solid #1a2d45",
      borderRadius: 11,
      padding: 14,
      marginBottom: 10,
    },
    resTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      gap: 8,
      flexWrap: "wrap",
    },
    resId: {
      fontFamily: "'Cinzel',serif",
      fontSize: 14,
      color: G,
      letterSpacing: 2,
    },
    statusPill: (s) => ({
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.2,
      padding: "3px 9px",
      borderRadius: 999,
      color: STATUS_LABELS[s].color,
      background: STATUS_LABELS[s].bg,
    }),
    resGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 10,
      marginBottom: 10,
    },
    resField: {},
    fk: {
      fontSize: 10,
      color: "#667",
      letterSpacing: 1,
      marginBottom: 2,
    },    
    fv: { fontSize: 13, color: "#ccd6f0", fontWeight: 500 },
    resActions: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      paddingTop: 10,
      borderTop: "1px solid #1a2d45",
    },

    empty: {
      padding: "60px 20px",
      textAlign: "center",
      color: "#556",
    },

    dangerZone: {
      margin: "4px 16px 8px",
      padding: "12px 14px",
      background: "#1a0a0a",  
      border: `1px solid ${RED}40`,
      borderRadius: 10,
      display: "flex", 
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    dangerLabel: {  
      fontSize: 10,
      color: RED,
      letterSpacing: 1.5,
      fontWeight: 700,
    },
    dangerHelp: {
      fontSize: 11,
      color: "#a07070",
      flex: 1,
      minWidth: 200,
    },
    resetBtn: {
      padding: "8px 14px",
      background: RED, 
      color: "#fff",
      border: "none",
      borderRadius: 7,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "'Outfit',sans-serif",
      letterSpacing: 0.5,
    },

    ingresoRow: {
      display: "flex", 
      justifyContent: "space-between",
      alignItems: "baseline",
      padding: "3px 0",
    },

    incomeBreak: {
      margin: "4px 16px 12px",
      padding: "14px 16px",
      background: CARD2,
      border: `1px solid ${G}30`,
      borderRadius: 11,
    },    
    incomeBreakTitle: {
      fontSize: 10,
      color: G,
      letterSpacing: 1.5,
      fontWeight: 700,
      marginBottom: 10,
    },    
    incomeBreakRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      padding: "5px 0",
      fontSize: 13,
      color: "#ccd6f0",
    },
    incomeBreakLabel: {
      color: "#889",
    },
    incomeBreakValue: {
      color: "#ccd6f0",
      fontWeight: 500, 
    },
    incomeBreakTotal: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${G}30`,
      fontFamily: "'Cinzel',serif",
      fontSize: 18,
      color: G,
      fontWeight: 700,
      textAlign: "center",
      letterSpacing: 1.5,
    },
  };

  if (!authed) {
    return (
      <div style={S.root}>
        <div style={S.hdr}>
          <div>
            <div style={S.h1}>LOGIN SISTEMA DE RESERVAS</div>
          </div>
          <a
            href="#"
            onClick={(e) => { 
              e.preventDefault();
              window.location.hash = "";
            }}
            style={{
              color: "#778",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            ← Volver al sitio
          </a>
        </div>
        <div style={S.loginWrap}>
          <div style={S.loginCard}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>🔒</div>
              <div
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 14,
                  color: G,
                  letterSpacing: 3,
                }}
              >
                LOGIN SISTEMA DE RESERVAS
              </div>
            </div>
            <div style={{ marginBottom: 13 }}>
              <label style={S.fLabel}>USUARIO</label>
              <input
                style={S.fInput}
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div style={{ marginBottom: 13 }}>
              <label style={S.fLabel}>CONTRASEÑA</label>
              <input
                type="password"
                style={S.fInput}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doLogin();
                }}
                autoComplete="current-password"
              />
            </div>
            {loginError && (  
              <div
                style={{
                  background: "#2a0e0e",
                  border: "1px solid #6a1c1c",
                  color: "#ffb3b3",
                  padding: "8px 11px",
                  borderRadius: 7,
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                ⚠️  {loginError}
              </div>
            )}
            <button style={S.primaryBtn} onClick={doLogin}>
              Ingresar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div
        style={{
          ...S.root,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            color: G,
            fontFamily: "'Cinzel',serif",
            letterSpacing: 3,
            fontSize: 14,
          }}
        >
          Cargando...
        </div>
      </div>
    );
  }

  const countPending = reservas.filter(
    (r) => (r.status || "pending") === "pending"
  ).length;
  const countConfirmed = reservas.filter(
    (r) => r.status === "confirmed"
  ).length;
  const countRejected = reservas.filter(
    (r) => r.status === "rejected"
  ).length;

  const filterDefs = [
    {
      key: "all",
      label: `TODAS (${reservas.length})`,
      color: G,
    },
    {
      key: "pending",
      label: `PENDIENTES (${countPending})`,
      color: YELLOW,
    },
    {
      key: "confirmed",
      label: `APROBADAS (${countConfirmed})`,
      color: GREEN,
    },    
    {
      key: "rejected",
      label: `RECHAZADAS (${countRejected})`,
      color: RED,
    },
  ];

  // Ingresos por estado
  const aprobadas = reservas.filter((r) => r.status === "confirmed");
  const pendientes = reservas.filter(
    (r) => (r.status || "pending") === "pending"
  );
  const aprobadoTotal = aprobadas.reduce(
    (sum, r) => sum + reservaTotal(r),
    0
  );
  const pendienteTotal = pendientes.reduce(
    (sum, r) => sum + reservaTotal(r),
    0
  );
  const totalGeneral = reservas.reduce(
    (sum, r) => sum + reservaTotal(r),
    0
  );

  // Desglose de ingresos APROBADOS por tipo
  const mesasGenAprobadas = aprobadas.filter(
    (r) => r.mesa?.type === "g"
  ).length;
  const mesasVipAprobadas = aprobadas.filter(
    (r) => r.mesa?.type === "v"
  ).length;
  const combosAprobados = aprobadas.filter((r) => r.combo);
  const combosCount = combosAprobados.length;
  const combosTotal = combosAprobados.reduce(
    (sum, r) => sum + (r.combo?.price || 0),
    0
  );
  const mesasGenIngreso = mesasGenAprobadas * PRICE_MESA_G;
  const mesasVipIngreso = mesasVipAprobadas * PRICE_MESA_V;

  return (
    <div style={S.root}>
      <div style={S.hdr}>
        <div>
          <div style={S.h1}>PANEL DE RESERVAS</div>
          <div style={S.sub}>
            VIERNES 12 DE JUNIO • {reservas.length} reservas totales
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "";
            }}
            style={{
              ...S.ghostBtn,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Sitio público
          </a>
          <button style={S.ghostBtn} onClick={doLogout}>
            Cerrar sesión
          </button> 
        </div>
      </div>

      <div style={S.countersGrid}>
        {[
          { key: "g", title: "MESAS GENERALES", c: counts.g },
          { key: "v", title: "MESAS VIP", c: counts.v },
        ].map(({ key, title, c }) => {
          const soldPct = (c.sold / c.total) * 100;
          const blockedPct = (c.blocked / c.total) * 100;
          return (
            <div key={key} style={S.countCard}>
              <div style={S.countTitle}>{title}</div>
              <div style={S.countRow}>
                <span style={S.countBig}>
                  {c.sold}
                  <span style={{ fontSize: 14, color: "#556" }}>
                    {" "}
                    / {c.total}
                  </span>
                </span>
                <span style={S.countSub}>
                  {c.free} libres · {c.blocked} bloqueadas
                </span>
              </div>
              <div style={S.bar}>
                <div
                  style={S.barSeg(G, soldPct)}
                  title={`Vendidas: ${c.sold}`}
                ></div>
                <div
                  style={S.barSeg("#3a1010", blockedPct)}
                  title={`Bloqueadas: ${c.blocked}`}
                ></div>
              </div>
            </div>
          ); 
        })}
        <div style={S.countCard}>
          <div style={S.countTitle}>INGRESO ESTIMADO</div>
          <div style={S.ingresoRow}>
            <span style={{ color: GREEN, fontSize: 12 }}>Aprobado</span>
            <span   
              style={{
                color: GREEN,
                fontFamily: "'Cinzel',serif",
                fontSize: 18, 
                fontWeight: 700,
              }}
            >
              ${aprobadoTotal}
            </span>
          </div>
          <div style={S.ingresoRow}>
            <span style={{ color: YELLOW, fontSize: 12 }}>Pendiente</span>
            <span
              style={{
                color: YELLOW,
                fontFamily: "'Cinzel',serif",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              ${pendienteTotal}
            </span>
          </div>
          <div
            style={{
              ...S.ingresoRow,
              borderTop: "1px solid #1a2d45",
              marginTop: 6,
              paddingTop: 6,
            }}
          >
            <span style={{ color: "#778", fontSize: 11 }}>
              Total general
            </span>
            <span
              style={{ color: "#ccd6f0", fontSize: 13, fontWeight: 500 }}
            >
              ${totalGeneral}
            </span>
          </div>
        </div>
      </div>

      <div style={S.incomeBreak}>
        <div style={S.incomeBreakTitle}>
          DESGLOSE DE INGRESOS APROBADOS
        </div>
        <div style={S.incomeBreakRow}>
          <span style={S.incomeBreakLabel}>
            Mesas Generales vendidas
          </span>
          <span style={S.incomeBreakValue}>
            {mesasGenAprobadas} × ${PRICE_MESA_G} = ${mesasGenIngreso}
          </span>
        </div>
        <div style={S.incomeBreakRow}>
          <span style={S.incomeBreakLabel}>Mesas VIP vendidas</span>
          <span style={S.incomeBreakValue}>
            {mesasVipAprobadas} × ${PRICE_MESA_V} = ${mesasVipIngreso}
          </span>   
        </div>
        <div style={S.incomeBreakRow}>
          <span style={S.incomeBreakLabel}>Combos vendidos</span>
          <span style={S.incomeBreakValue}>
            {combosCount} → ${combosTotal}
          </span>   
        </div>
        <div style={S.incomeBreakTotal}>
          TOTAL APROBADO: ${aprobadoTotal}
        </div>
      </div> 

      <div style={S.dangerZone}>
        <div>
          <div style={S.dangerLabel}>ZONA DE PELIGRO</div>
          <div style={S.dangerHelp}>
            Borra todas las reservas de mesas. Sólo se mantienen
            las marcadas como "No disponible".
          </div>
        </div>
        <button
          style={S.resetBtn}
          disabled={resetting}
          onClick={handleResetMesas}
        >
          {resetting ? "Reseteando..." : "🔄 Resetear todas las mesas"}
        </button>   
      </div>

      <div style={S.filterRow}>
        {filterDefs.map((f) => ( 
          <button
            key={f.key}
            style={S.filterPill(filter === f.key, f.color)}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={S.listWrap}>
        {filteredReservas.length === 0 && (
          <div style={S.empty}>
            <div
              style={{ fontSize: 30, marginBottom: 10, opacity: 0.4 }}
            >
              📋
            </div>
            <div>
              No hay reservas{" "}
              {filter !== "all"
                ? `con estado "${filter}"`
                : "todavía"}
              .
            </div>
          </div>
        )}

        {filteredReservas.map((r) => {
          const status = r.status || "pending";
          const isBusy = !!busy[r.id];
          const created = r.createdAt?.toDate
            ? r.createdAt.toDate()
            : null;
          const fechaTxt = created
            ? created.toLocaleString("es-SV", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          return (
            <div key={r.id} style={S.resCard}>
              <div style={S.resTop}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={S.resId}>{r.id}</span>
                  <span style={S.statusPill(status)}>
                    {STATUS_LABELS[status].label}
                  </span>
                </div>
                {created && (
                  <span style={{ fontSize: 11, color: "#556" }}>
                    {fechaTxt}
                  </span>
                )}
              </div>

              <div style={S.resGrid}>
                <div style={S.resField}>
                  <div style={S.fk}>NOMBRE</div>
                  <div style={S.fv}>{r.name}</div>
                </div> 
                <div style={S.resField}>
                  <div style={S.fk}>TELÉFONO</div>
                  <div style={S.fv}>{r.phone}</div>
                </div> 
                <div style={S.resField}>
                  <div style={S.fk}>MESA</div>
                  <div style={S.fv}>
                    {r.mesa ? (
                      `${r.mesa.type === "v" ? "VIP " : "Gen. "}` +
                      `#${r.mesa.n}`
                    ) : (
                      <span style={{ color: "#556" }}>Sin mesa</span>
                    )}
                  </div>
                </div>
                <div style={S.resField}>
                  <div style={S.fk}>COMBO</div>
                  <div style={S.fv}>
                    {r.combo ? (
                      `#${r.combo.id} ${r.combo.name} · ` +
                      `$${r.combo.price}`
                    ) : (
                      <span style={{ color: "#556" }}>Sin combo</span>
                    )}
                  </div>
                </div>
              </div>

              {r.vipSelections && (
                <div
                  style={{
                    marginBottom: 10,
                    padding: "8px 10px",
                    background: `${G}10`,
                    border: `1px solid ${G}30`,
                    borderRadius: 8,
                  }}
                >   
                  <div
                    style={{
                      fontSize: 10,
                      color: G,
                      letterSpacing: 1,
                      marginBottom: 4,
                    }}
                  > 
                    PAQUETE VIP — SELECCIONES
                  </div>
                  <div style={{ fontSize: 12, color: "#ccd6f0", lineHeight: 1.6 }}>
                    🍺 {r.vipSelections.cerveza} · 🥃 {r.vipSelections.licor} ·
                    🥤 {r.vipSelections.soda}
                  </div>
                </div>
              )}

              <div style={S.resActions}>
                {status !== "confirmed" && (
                  <button
                    style={S.smallBtn(GREEN)}
                    disabled={isBusy}
                    onClick={() => approve(r)}
                  >
                    ✓ Aprobar 
                  </button>
                )}
                {status !== "rejected" && (
                  <button
                    style={S.smallBtn(YELLOW)}
                    disabled={isBusy}
                    onClick={() => reject(r)}
                  >
                    ✕ Rechazar
                  </button>
                )}
                <button
                  style={S.smallBtn(RED)}
                  disabled={isBusy}
                  onClick={() => remove(r)}
                >
                  🗑 Borrar{r.mesa ? " (libera mesa)" : ""}
                </button>
                {isBusy && (  
                  <span
                    style={{
                      fontSize: 11,
                      color: "#556",
                      alignSelf: "center",
                    }} 
                  >
                    Procesando…
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div> 

      <div
        style={{
          color: "#556",
          fontSize: 10,
          textAlign: "center",
          padding: 16,
        }}
      >
        Desarrollado por Alicia Ovando • Mayo 2026
      </div>
    </div>
  );
}
