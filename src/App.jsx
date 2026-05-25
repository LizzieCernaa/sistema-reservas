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
  const YELLOW = "#e8b020";

  // ⚠️  CAMBIAR: número de WhatsApp del organizador.
  // Formato internacional sin "+" ni guiones ni espacios.
  // Ejemplo El Salvador: "50370001234"
  const WHATSAPP_NUMBER = "50377392464";
  // Cómo se muestra al usuario (con formato legible).
  const WHATSAPP_DISPLAY = "+503 7739-2464";

  const FONTS_HREF =
    "https://fonts.googleapis.com/css2" +
    "?family=Cinzel:wght@600;700" +
    "&family=Outfit:wght@300;400;500;600" +
    "&display=swap";

  const COMBOS = [
    {
      id: 1,
      name: "Individual",
      price: 20,
      hasMesa: false,
      icon: "🎫",
      items: ["1 entrada", "1 soda o cerveza", "1 plato de comida"],
    },
    {
      id: 2,
      name: "Para dos",
      price: 35,
      hasMesa: false,
      icon: "🥂",
      items: ["2 entradas", "2 tragos preparados José Cuervo", "1 nacho"],
    },
    {
      id: 3,
      name: "Cena Grupal",
      price: 80,
      hasMesa: true,
      icon: "🍽️ ",
      items: ["4 entradas", "4 platos de comida", "4 sodas", "Mesa + 4 sillas"],
    },
    {
      id: 4,
      name: "Para Compartir",
      price: 70,
      hasMesa: true,
      icon: "🍺",
      note: "+$2 cambia a cervezas",
      items: [
        "4 entradas",
        "4 sodas o cervezas",
        "2 nachos",
        "Mesa + 4 sillas",
      ],
    },
    {
      id: 5,
      name: "Bienvenida",
      price: 70,
      hasMesa: true,
      icon: "🎉",
      items: ["4 entradas", "8 cervezas", "Mesa + 4 sillas"],
    },
  ];

  // Paquete Mesa VIP: items fijos + opciones a elegir por el cliente.
  const VIP_FIXED = [
    "Mesa + 6 sillas",
    "1 balde de 6 cervezas (elegí el tipo)",
    "1 botella de licor (elegí la marca)",
    "2 platos de boquitas Diana",
    "1 plato de nachos",
    "1 soda de 2.5L (elegí el sabor)",
    "Vasos + hielo ilimitado + servicio de meseros",
  ];
  const CERVEZA_OPTIONS = [
    "Cerveza Nacional",
    "Cerveza Extranjera",
    "Pilsener",
    "Golden",
    "Heineken",
  ];
  const LICOR_OPTIONS = [
    "Aguardiente Trenzuda Tamarindo Picado 700ml",
    "Ron Botran 700ml",
    "Ron Flor de Caña 750ml",
    "Tequila José Cuervo Especial Oro 750ml",
    "Vodka Smirnoff Rojo 750ml",
    "Vodka Seco Petrov Frutos Rojos 700ml",
  ];
  const SODA_OPTIONS = ["Coca-Cola 2.5L", "Sprite 2.5L"];
  const VIP_DEFAULTS = {
    cerveza: CERVEZA_OPTIONS[0],
    licor: LICOR_OPTIONS[0],
    soda: SODA_OPTIONS[0],
  };
  
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
    const [vipSelections, setVipSelections] = useState(VIP_DEFAULTS);
    const [form, setForm] = useState({ name: "", phone: "" });
    const [res, setRes] = useState({ g: {}, v: {} });
    const [confirm, setConfirm] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONTS_HREF;
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
      return () => {
        if (unsub) unsub();
      };
    }, []);

    const getStatus = (type, n) => {
      const v = res[type]?.[n];
      if (!v) return "a";
      if (v === "D") return "d";
      return "r";
    };

    const countAvail = (type, total) =>
      Array.from({ length: total }, (_, i) => i + 1).filter(
        (n) => getStatus(type, n) === "a"
      ).length;

    const clickMesa = (type, n) => {
      if (getStatus(type, n) !== "a") return;
      const inSel = step === "selectMesa";
      const cur = inSel ? comboMesa : selMesa;
      const same = cur?.type === type && cur?.n === n;
      if (inSel) setComboMesa(same ? null : { type, n });
      else setSelMesa(same ? null : { type, n });
    };

    const proceed = () => {
      if (tab === "mesas" && selMesa) {
        setStep(selMesa.type === "v" ? "vipOptions" : "form");
        return;
      }
      if (tab === "combos" && selCombo) {
        // Si el combo incluye mesa y el cliente ya eligió una, no se la
        // volvemos a pedir: reusamos selMesa como comboMesa.
        if (selCombo.hasMesa && selMesa) {
          setComboMesa(selMesa);
          setStep(selMesa.type === "v" ? "vipOptions" : "form");
        } else if (selCombo.hasMesa) {
          setStep("selectMesa");
        } else {
          setStep("form");
        }
      }
    };

    const submit = async () => {
      if (!form.name.trim() || !form.phone.trim() || submitting) return;
      setSubmitting(true);
      setErrorMsg("");
      const mesa = selMesa || comboMesa;
      const isVip = mesa?.type === "v";
      const vip = isVip ? vipSelections : null;
      const id = "R-" + Math.random().toString(36).slice(2, 8).toUpperCase();
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
          vipSelections: vip,
        });
        setConfirm({ id, ...form, mesa, combo: selCombo, vipSelections: vip });
        setStep("done");
      } catch (e) {
        console.error(e);
        setErrorMsg(
          e?.message || "No se pudo guardar la reserva. Intenta de nuevo."
        );
      } finally {
        setSubmitting(false);
      }
    };

    const reset = () => {
      setStep("browse");
      setSelMesa(null);
      setSelCombo(null);
      setComboMesa(null);
      setVipSelections(VIP_DEFAULTS);
      setForm({ name: "", phone: "" });
      setConfirm(null);
      setErrorMsg("");
    };

    const inSel = step === "selectMesa";
    const activeMesa = inSel ? comboMesa : selMesa;
    const hasAction = selMesa || selCombo || comboMesa;

    const S = {
      root: {
        fontFamily: "'Outfit',sans-serif",
        background: BG,
        minHeight: "100vh",
        color: "#ccd6f0",
        maxWidth: 520,
        margin: "0 auto",
        paddingBottom: hasAction ? 88 : 24,
      },
      hdr: {
        background: CARD,
        borderBottom: `1px solid ${G}30`,
        padding: "20px 18px 16px",
        textAlign: "center",
      },
      h1: {
        fontFamily: "'Cinzel',serif",
        fontSize: 19,
        color: G,
        margin: 0,
        letterSpacing: 3,
      },
      sub: {
        fontSize: 11,
        color: "#667",
        marginTop: 3,
        letterSpacing: 2,
      },
      statsRow: {
        display: "flex",
        background: CARD,
        borderBottom: "1px solid #1a2d45",
      },
      statCell: {
        flex: 1,
        padding: "10px 0",
        textAlign: "center",
        borderRight: "1px solid #1a2d45",
      },
      sv: {
        color: G,
        fontWeight: 600,
        fontSize: 20,
        fontFamily: "'Cinzel',serif",
      },
      sl: { color: "#556", fontSize: 10, marginTop: 1 },
      tabs: {
        display: "flex",
        background: CARD,
        borderBottom: "1px solid #1a2d45",
        position: "sticky",
        top: 0,
        zIndex: 9,
      },
      tab: (a) => ({
        flex: 1,
        padding: "12px",
        border: "none",
        background: "transparent",
        color: a ? G : "#556",
        fontFamily: "'Outfit',sans-serif",
        fontSize: 13,
        fontWeight: a ? 600 : 400,
        cursor: "pointer",
        borderBottom: a ? `2px solid ${G}` : "2px solid transparent",
        transition: "color .15s",
      }),
      selBanner: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: `${G}10`,
        borderBottom: `1px solid ${G}30`,
        padding: "10px 16px",
      },
      legend: {
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        padding: "10px 16px",
        background: CARD,
        borderBottom: "1px solid #1a2d45",
        fontSize: 11,
        color: "#778",
      },
      sec: { padding: "16px 14px 4px" },
      secHd: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      },
      secT: {
        fontFamily: "'Cinzel',serif",
        fontSize: 11,
        color: G,
        letterSpacing: 2,
      },
      secC: { fontSize: 11, color: "#556" },
      grid10: {
        display: "grid",
        gridTemplateColumns: "repeat(10,1fr)",
        gap: 4,
        marginBottom: 14,
      },
      grid7: {
        display: "grid",
        gridTemplateColumns: "repeat(7,1fr)",
        gap: 4,
        marginBottom: 14,
      },
      mesa: (s, sel) => ({
        aspectRatio: "1",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 600,
        cursor: s === "a" ? "pointer" : "default",
        transition: "all .12s",
        border: sel
          ? `1.5px solid ${G}`
          : s === "a"
          ? "1px solid #1e3a5a"
          : s === "r"
          ? "1px solid #3a1010"
          : "1px solid #141414",
        background: sel
          ? `${G}20`
          : s === "a"
          ? "#0c1c30"
          : s === "r"
          ? "#1c0808"
          : "#0e0e0e",
        color: sel
          ? G
          : s === "a"
          ? "#4a8fcc"
          : s === "r"
          ? "#7a2020"
          : "#1e1e1e",
        outline: sel ? `1px solid ${G}40` : "none",
      }),
      comboCard: (sel) => ({
        background: sel ? `${G}0e` : CARD2,
        border: sel ? `1.5px solid ${G}` : "1px solid #1a2d45",
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        cursor: "pointer",
        transition: "all .15s",
      }),
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
      fSelect: {
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
      btn: (dis) => ({
        width: "100%",
        padding: "13px",
        background: dis ? "#131e2e" : G,
        color: dis ? "#2a3a4a" : "#0a0f18",
        border: "none",
        borderRadius: 9,
        fontSize: 14,
        fontWeight: 600,
        cursor: dis ? "default" : "pointer",
        fontFamily: "'Outfit',sans-serif",
        letterSpacing: 0.5,
        transition: "background .15s",
      }),
      bottomBar: {
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 520,
        background: CARD,
        borderTop: `1px solid ${G}30`,
        padding: "11px 14px",
        boxSizing: "border-box",
        zIndex: 20,
      },
      barInfo: { fontSize: 12, color: "#778", marginBottom: 8 },
      back: {
        background: "transparent",
        border: "none",
        color: "#778",
        cursor: "pointer",
        padding: "10px 16px 0",
        fontSize: 12,
        fontFamily: "'Outfit',sans-serif",
        display: "block",
      },
      sumCard: {
        background: CARD2,
        border: `1px solid ${G}20`,
        borderRadius: 11,
        padding: 13,
        marginBottom: 14,
      },
      sumRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid #1a2d45",
        fontSize: 13,
      },
      confCard: {
        background: CARD2,
        border: "1px solid #1a3a1a",
        borderRadius: 13,
        padding: 18,
        margin: "14px 14px 18px",
      },
      confId: {
        fontFamily: "'Cinzel',serif",
        fontSize: 22,
        color: G,
        textAlign: "center",
        letterSpacing: 4,
        margin: "0 0 16px",
        paddingBottom: 16,
        borderBottom: `1px solid ${G}20`,
      },
      waCard: {
        background: `${WA_GREEN}0d`,
        border: `1px solid ${WA_GREEN}55`,
        borderRadius: 13,
        padding: 16,
        margin: "0 14px 18px",
      },
      waBtn: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        width: "100%",
        padding: "13px",
        background: WA_GREEN,
        color: "#0a1f12",
        border: "none",
        borderRadius: 9,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "'Outfit',sans-serif",
        letterSpacing: 0.5,
        textDecoration: "none",
        boxSizing: "border-box",
      },
      errBox: {
        background: "#2a0e0e",
        border: "1px solid #6a1c1c",
        color: "#ffb3b3",
        padding: "10px 12px",
        borderRadius: 8,
        fontSize: 12,
        marginBottom: 12,
      },
    };

    const footer = (
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
    );

    if (!loaded)
      return (
        <div
          style={{
            ...S.root,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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

    if (step === "done" && confirm) {
      const qrData = encodeURIComponent(
        `${confirm.id}|${confirm.name}|${confirm.phone}`
      );
      const qr =
        "https://api.qrserver.com/v1/create-qr-code/" +
        `?size=150x150&data=${qrData}` +
        "&bgcolor=142035&color=E8A020&qzone=2";

      const rows = [
        ["Nombre", confirm.name],
        ["Teléfono", confirm.phone],
        confirm.mesa && [
          "Mesa",
          `${confirm.mesa.type === "v" ? "VIP " : ""}#${confirm.mesa.n}`,
        ],
        confirm.combo && [
          "Combo",
          `#${confirm.combo.id} ${confirm.combo.name} ` +
            `($${confirm.combo.price})`,
        ],
        confirm.vipSelections && ["Cerveza VIP", confirm.vipSelections.cerveza],
        confirm.vipSelections && ["Licor VIP", confirm.vipSelections.licor],
        confirm.vipSelections && ["Soda VIP", confirm.vipSelections.soda],
      ].filter(Boolean);

      const waMsg =
        `Hola! Adjunto mi comprobante de pago para la reserva ` +
        `${confirm.id} a nombre de ${confirm.name}.`;
      const waLink =
        `https://wa.me/${WHATSAPP_NUMBER}` +
        `?text=${encodeURIComponent(waMsg)}`;

      return (
        <div style={S.root}>
          <div style={{ ...S.hdr, paddingTop: 22 }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>✅</div>
            <div style={{ ...S.h1, color: "#3ecf74" }}>
              ¡Reserva Confirmada!
            </div>
            <div style={S.sub}>VIERNES 12 DE JUNIO</div>
          </div>
          <div style={S.confCard}>
            <div style={{ textAlign: "center", padding: "12px 0 18px" }}>
              <img
                src={qr}
                alt="QR"
                style={{ width: 140, height: 140, borderRadius: 8 }}
                onError={(e) => (e.target.style.display = "none")}
              />
            </div>
            <div style={S.confId}>{confirm.id}</div>
            {rows.map(([k, v]) => (
              <div key={k} style={S.sumRow}>
                <span style={{ color: "#778" }}>{k}</span>
                <span style={{ color: "#ccd6f0", fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
  
          <div style={S.waCard}>
            <div
              style={{
                fontSize: 13,
                color: "#ccd6f0",
                letterSpacing: 1,
                fontWeight: 600,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Tu reserva está{" "}
              <span
                style={{
                  color: YELLOW,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                }}
              >
                PENDIENTE
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#ccd6f0",
                lineHeight: 1.55,
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              Enviá tu <b>comprobante de pago</b> por WhatsApp al{" "}
              <b style={{ color: WA_GREEN }}>📱 {WHATSAPP_DISPLAY}</b>{" "}
              indicando tu código{" "}
              <b
                style={{
                  color: G,
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: 2,
                }}
              >
                {confirm.id}
              </b>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              style={S.waBtn}
            >
              💬  Abrir WhatsApp
            </a>
            <div
              style={{
                fontSize: 11,
                color: "#889",
                textAlign: "center",
                marginTop: 12,
                lineHeight: 1.5,
              }}
            >
              El admin verificará el pago y aprobará tu reserva.
              Tu mesa queda apartada mientras tanto.
            </div>
          </div>

          <div style={{ padding: "0 14px" }}>
            <div
              style={{
                fontSize: 12,
                color: "#667",
                textAlign: "center",
                marginBottom: 14,
              }}
            >
              Presenta este código al ingresar al evento
            </div>
            <button onClick={reset} style={S.btn(false)}>
              Nueva reserva
            </button>
          </div>
          {footer}
        </div>
      );
    }

    if (step === "vipOptions") {
      const mesa = selMesa || comboMesa;
      return (
        <div style={S.root}>
          <div style={S.hdr}>
            <div style={S.h1}>Personaliza tu Mesa VIP</div>
            <div style={S.sub}>VIERNES 12 DE JUNIO 2025</div>
          </div>
          <button
            style={S.back}
            onClick={() =>
              setStep(selCombo?.hasMesa ? "selectMesa" : "browse")
            }
          >
            ← Volver
          </button>
          <div style={{ padding: "8px 14px 20px" }}>
            <div style={S.sumCard}>
              <div
                style={{
                  fontSize: 10,
                  color: G,
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                PAQUETE MESA VIP {mesa ? `#${mesa.n}` : ""} — $60
              </div>
              <div style={{ fontSize: 12, color: "#889" }}>
                {VIP_FIXED.map((item, i) => (
                  <div key={i} style={{ padding: "2px 0" }}>
                    <span style={{ color: G, opacity: 0.5 }}>• </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 13 }}>
              <label style={S.fLabel}>BALDE DE 6 CERVEZAS — ELEGÍ EL TIPO</label>
              <select
                style={S.fSelect}
                value={vipSelections.cerveza}
                onChange={(e) =>
                  setVipSelections({ ...vipSelections, cerveza: e.target.value })
                }
              >
                {CERVEZA_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 13 }}>
              <label style={S.fLabel}>BOTELLA DE LICOR — ELEGÍ LA MARCA</label>
              <select
                style={S.fSelect}
                value={vipSelections.licor}
                onChange={(e) =>
                  setVipSelections({ ...vipSelections, licor: e.target.value })
                }
              >
                {LICOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={S.fLabel}>SODA 2.5L — ELEGÍ EL SABOR</label>
              <select
                style={S.fSelect}
                value={vipSelections.soda}
                onChange={(e) =>
                  setVipSelections({ ...vipSelections, soda: e.target.value })
                }
              >
                {SODA_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
  
            <button onClick={() => setStep("form")} style={S.btn(false)}>
              Continuar →
            </button>
          </div>
          {footer}
        </div>
      );
    }
  
    if (step === "form") {
      const mesa = selMesa || comboMesa;
      const isVip = mesa?.type === "v";
      const mesaPrice = isVip ? 60 : mesa?.type === "g" ? 5 : 0;
      const total = mesaPrice + (selCombo?.price || 0);
      const ok =
        form.name.trim().length > 0 &&
        form.phone.trim().length > 0 &&
        !submitting;
      return (
        <div style={S.root}>
          <div style={S.hdr}>
            <div style={S.h1}>Completa tu reserva</div>
            <div style={S.sub}>VIERNES 12 DE JUNIO 2025</div>
          </div>
          <button
            style={S.back}
            onClick={() => {
              setErrorMsg("");
              setStep(
                isVip
                  ? "vipOptions"
                  : selCombo?.hasMesa
                  ? "selectMesa"
                  : "browse"
              );
            }}
          >
            ← Volver
          </button>
          <div style={{ padding: "8px 14px 20px" }}>
            <div style={S.sumCard}>
              <div
                style={{
                  fontSize: 10,
                  color: G,
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                RESUMEN
              </div>
              {selCombo && (
                <div style={{ fontSize: 13, marginBottom: 3 }}>
                  Combo #{selCombo.id}:{" "}
                  <b style={{ color: G }}>{selCombo.name}</b> —{" "}
                  <b style={{ color: G }}>${selCombo.price}</b>
                </div>
              )}
              {mesa && (
                <div style={{ fontSize: 13 }}>
                  Mesa{" "}
                  <b style={{ color: G }}>
                    {mesa.type === "v" ? "VIP " : ""}#{mesa.n}
                  </b>
                </div>
              )}
              {isVip && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#889",
                    marginTop: 6,
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    🍺 Cerveza:{" "}
                    <b style={{ color: "#ccd6f0" }}>{vipSelections.cerveza}</b>
                  </div>
                  <div>
                    🥃 Licor:{" "}
                    <b style={{ color: "#ccd6f0" }}>{vipSelections.licor}</b>
                  </div>
                  <div>
                    🥤 Soda:{" "}
                    <b style={{ color: "#ccd6f0" }}>{vipSelections.soda}</b>
                  </div>
                </div>
              )}
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: `1px solid ${G}20`,
                  fontSize: 15,
                  color: G,
                  fontWeight: 700,
                  textAlign: "right",
                }}
              >
                TOTAL: ${total}
              </div>
              {!selCombo && !mesa && (
                <div style={{ fontSize: 12, color: "#667" }}>
                  Combo sin mesa incluida
                </div>
              )}
            </div>
            <div style={{ marginBottom: 13 }}>
              <label style={S.fLabel}>NOMBRE COMPLETO *</label>
              <input
                style={S.fInput}
                placeholder="Ej. María García"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
            </div>
            <div style={{ marginBottom: 13 }}>
              <label style={S.fLabel}>TELÉFONO / WHATSAPP *</label>
              <input
                style={S.fInput}
                placeholder="0000-0000"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                type="tel"
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={S.fLabel}>MÉTODO DE PAGO</label>
              <div
                style={{
                  background: CARD2,
                  border: "1px solid #1e3050",
                  borderRadius: 9,
                  padding: "13px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "#ccd6f0",
                    lineHeight: 1.5,
                  }}
                >
                  💵 Pago por{" "}
                  <b style={{ color: G }}>transferencia bancaria</b> o{" "}
                  <b style={{ color: G }}>efectivo</b> en el evento.
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#778",
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  Luego de confirmar, te mostraremos un código y el número
                  de WhatsApp para enviar el comprobante.
                </div>
              </div>
            </div>
            {errorMsg && <div style={S.errBox}>⚠️  {errorMsg}</div>}
            <button onClick={submit} style={S.btn(!ok)} disabled={!ok}>
              {submitting ? "Guardando..." : "Confirmar Reserva →"}
            </button>
          </div>
          {footer}
        </div>
      );
    }

    const renderGrid = (type, total, cols) => (
      <div style={cols === 7 ? S.grid7 : S.grid10}>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
          const s = getStatus(type, n);
          const sel = activeMesa?.type === type && activeMesa?.n === n;
          const title =
            s === "r"
              ? res[type][n]
              : s === "d"
              ? "No disponible"
              : "";
          return (
            <div
              key={n}
              style={S.mesa(s, sel)}
              onClick={() => clickMesa(type, n)}
              title={title}
            >
              {n}
            </div>
          );
        })}
      </div>
    );
  
    const gA = countAvail("g", 84);
    const vA = countAvail("v", 17);

    return (
      <div style={S.root}>
        <div style={S.hdr}>
          <div style={S.h1}>SISTEMA DE RESERVAS</div>
          <div style={S.sub}>
            VIERNES 12 DE JUNIO • SELECCIONA TU LUGAR
          </div>
          <a
            href="#admin"
            style={{
              color: "#556",
              fontSize: 10,
              textDecoration: "none",
              letterSpacing: 1.5,
              marginTop: 8,
              display: "inline-block",
            }}
          >
            🔒 Admin
          </a>
        </div>
        <div style={S.statsRow}>
          <div style={{ ...S.statCell, borderLeft: "none" }}>
            <div style={S.sv}>{gA}</div>
            <div style={S.sl}>Generales</div>
          </div>
          <div style={S.statCell}>
            <div style={S.sv}>{vA}</div>
            <div style={S.sl}>VIP disp.</div>
          </div>
          <div style={{ ...S.statCell, borderRight: "none" }}>
            <div style={S.sv}>{gA + vA}</div>
            <div style={S.sl}>Total libre</div>
          </div>
        </div>
        {inSel && (
          <div style={S.selBanner}>
            <div style={{ fontSize: 12, color: G }}>
              🪑 Elige mesa para Combo #{selCombo?.id} — {selCombo?.name}
            </div>
            <button
              onClick={() => {
                setStep("browse");
                setComboMesa(null);
              }}
              style={{
                background: "transparent",
                border: "1px solid #334",
                borderRadius: 5,
                color: "#778",
                cursor: "pointer",
                padding: "3px 9px",
                fontSize: 11,
              }}
            >
              Cancelar
            </button>
          </div>
        )}
        {!inSel && (
          <div style={S.tabs}>
            <button
              style={S.tab(tab === "mesas")}
              onClick={() => setTab("mesas")}
            >
              🪑  Mesas
            </button>
            <button
              style={S.tab(tab === "combos")}
              onClick={() => setTab("combos")}
            >
              🎫  Combos
            </button>
          </div>
        )}
        {(tab === "mesas" || inSel) && (
          <div style={S.legend}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: "#0c1c30",
                  border: "1px solid #1e3a5a",
                  display: "inline-block",
                }}
              ></span>
              Disponible
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: "#1c0808",
                  border: "1px solid #3a1010",
                  display: "inline-block",
                }}
              ></span>
              Reservada
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: "#0e0e0e",
                  border: "1px solid #141414",
                  display: "inline-block",
                }}
              ></span>
              No disp.
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: `${G}20`,
                  border: `1.5px solid ${G}`,
                  display: "inline-block",
                }}
              ></span>
              Seleccionada
            </span>
          </div>
        )}
        {(tab === "mesas" || inSel) && (
          <>
            <div style={S.sec}>
              <div style={S.secHd}>
                <span style={S.secT}>MESAS VIP</span>
                <span style={S.secC}>{vA} disponibles</span>
              </div>
              {renderGrid("v", 17, 7)}
            </div>
            <div style={S.sec}>
              <div style={S.secHd}>
                <span style={S.secT}>MESAS GENERALES</span>
                <span style={S.secC}>{gA} disponibles</span>
              </div>
              {renderGrid("g", 84, 10)}
            </div>
          </>
        )}
        {tab === "combos" && !inSel && (
          <div style={S.sec}>
            {COMBOS.map((c) => (
              <div
                key={c.id}
                style={S.comboCard(selCombo?.id === c.id)}
                onClick={() =>
                  setSelCombo((prev) => (prev?.id === c.id ? null : c))
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{c.icon}</span>
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: G,
                          letterSpacing: 1,
                        }}
                      >
                        COMBO #{c.id}
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#ccd6f0",
                        }}
                      >
                        {c.name}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "'Cinzel',serif",
                        fontSize: 19,
                        color: G,
                        fontWeight: 700,
                      }}
                    >
                      ${c.price}
                    </div>
                    {c.hasMesa && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "#3ecf74",
                          background: "#0a2a14",
                          padding: "2px 7px",
                          borderRadius: 20,
                          display: "inline-block",
                        }}
                      >
                        Incluye mesa
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#889" }}>
                  {c.items.map((item, i) => (
                    <div key={i} style={{ padding: "2px 0" }}>
                      <span style={{ color: G, opacity: 0.5 }}>• </span>
                      {item}
                    </div>
                  ))}
                  {c.note && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#667",
                        fontStyle: "italic",
                        marginTop: 5,
                      }}
                    >
                      {c.note}
                    </div>
                  )}
                </div>
                {selCombo?.id === c.id && (
                  <div
                    style={{
                      marginTop: 9,
                      padding: "5px 12px",
                      background: `${G}15`,
                      borderRadius: 7,
                      fontSize: 11,
                      color: G,
                      textAlign: "center",
                    }}
                  >
                    ✓ Seleccionado
                    {c.hasMesa
                      ? " — elige tu mesa en el siguiente paso"
                      : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {hasAction && (
          <div style={S.bottomBar}>
            <div style={S.barInfo}>
              {selMesa && !inSel && (
                <>
                  Mesa:{" "}
                  <b style={{ color: G }}>
                    {selMesa.type === "v" ? "VIP " : ""}#{selMesa.n}
                  </b>
                </>
              )}
              {selCombo && !inSel && (
                <>
                  Combo{" "}
                  <b style={{ color: G }}>
                    #{selCombo.id} {selCombo.name}
                  </b>
                  {comboMesa && (
                    <>
                      {" "}
                      · Mesa{" "}
                      <b style={{ color: "#3ecf74" }}>
                        {comboMesa.type === "v" ? "VIP " : ""}
                        #{comboMesa.n}
                      </b>
                    </>
                  )}
                </>
              )}
              {inSel && !comboMesa && (
                <span style={{ color: "#778" }}>
                  Toca una mesa disponible del mapa
                </span>
              )}
              {inSel && comboMesa && (
                <>
                  Mesa elegida:{" "}
                  <b style={{ color: G }}>
                    {comboMesa.type === "v" ? "VIP " : ""}#{comboMesa.n}
                  </b>
                </>
              )}
            </div>
            <button
              onClick={() => {
                if (inSel && comboMesa) {
                  setStep(comboMesa.type === "v" ? "vipOptions" : "form");
                  return;
                }
                if (!inSel) proceed();
              }}
              style={S.btn(inSel && !comboMesa)}
              disabled={inSel && !comboMesa}
            >
              {inSel
                ? "Confirmar mesa →"
                : selCombo?.hasMesa
                ? "Elegir mesa →"
                : "Reservar →"}
            </button>
          </div>
        )}
        {footer}
      </div>
    );
  }
  