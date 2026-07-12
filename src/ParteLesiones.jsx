import React from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";

const H = 841.92;

const PUESTO_X = { PORTERO: 104, DEFENSA: 134, MEDIO: 162, DELANTERO: 191 };
const LICENCIA_X = { PROFESIONAL: 269, AFICIONADO: 308, JUVENIL: 340, CADETE: 367, INFANTIL: 395, ALEVIN: 423 };
const SUPERF_X = { "C.NATURAL": 106, "C.ARTIFICIAL": 141, TIERRA: 172, OTROS: 197 };

const puestoDe = (pos) => {
  const p = (pos || "").toLowerCase();
  if (p.includes("portero")) return "PORTERO";
  if (p.includes("defensa") || p.includes("lateral") || p.includes("central")) return "DEFENSA";
  if (p.includes("delantero") || p.includes("extremo")) return "DELANTERO";
  if (p.includes("medio") || p.includes("interior") || p.includes("pivote") || p.includes("punta")) return "MEDIO";
  return "";
};
const licenciaDe = (equipo) => {
  const e = (equipo || "").toLowerCase();
  if (e.includes("alev")) return "ALEVIN";
  if (e.includes("infantil")) return "INFANTIL";
  if (e.includes("cadete")) return "CADETE";
  if (e.includes("juvenil")) return "JUVENIL";
  if (e.includes("amateur")) return "AFICIONADO";
  return "";
};

const inputCls = "bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full";
const Field = ({ label, children }) => (
  <div>
    <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">{label}</label>
    {children}
  </div>
);
const Pills = ({ opts, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {opts.map(o => (
      <button key={o} type="button" onClick={() => onChange(value === o ? "" : o)}
        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${value === o ? "bg-red-700 border-red-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>{o}</button>
    ))}
  </div>
);

export default function ParteLesionesSection({ teams, db, isCoord, teamAccess }) {
  const equipos = isCoord ? teams : [teamAccess].filter(Boolean);
  const [equipo, setEquipo] = React.useState(equipos[0] || "");
  const [playerId, setPlayerId] = React.useState("");
  const [f, setF] = React.useState({});
  const [generando, setGenerando] = React.useState(false);
  const [error, setError] = React.useState("");

  const players = ((db || {})[equipo] || {}).players || [];

  const elegirJugador = (id) => {
    setPlayerId(id);
    const p = players.find(x => String(x.id) === String(id));
    if (!p) return;
    const partes = (p.name || "").trim().split(/\s+/);
    setF(prev => ({
      ...prev,
      nombre: partes[0] || "",
      apellidos: partes.slice(1).join(" "),
      dni: p.dni || "",
      telefono: p.telefono || "",
      fechaNac: p.fechaNac || p.fechaNacimiento || "",
      puesto: puestoDe(p.posicionPrincipal || p.posicion),
      licencia: licenciaDe(equipo),
      localidad: prev.localidad || "Castellón",
      provincia: prev.provincia || "Castellón",
      superficie: prev.superficie || "C.ARTIFICIAL",
    }));
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });

  const fmtFecha = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return d && m && y ? `${d}/${m}/${y}` : iso;
  };

  const generar = async () => {
    setError(""); setGenerando(true);
    try {
      const res = await fetch("/parte_lesiones.pdf");
      if (!res.ok) throw new Error("No se encontró /parte_lesiones.pdf en public/");
      const pdf = await PDFDocument.load(await res.arrayBuffer());
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const page = pdf.getPages()[0];
      const txt = (text, x, bottom, size = 8) => {
        if (!text) return;
        page.drawText(String(text), { x, y: H - bottom + 3, size, font });
      };

      txt(f.dni, 102, 296);
      txt(fmtFecha(f.fechaNac), 155, 314, 7);
      txt(f.apellidos, 246, 314);
      txt(f.nombre, 418, 314);
      txt(f.domicilio, 120, 330);
      txt(f.localidad, 425, 330);
      txt(f.provincia, 119, 345);
      txt(f.cp, 240, 345);
      txt(f.telefono, 312, 345);
      txt(f.email, 409, 345, 7);

      if (PUESTO_X[f.puesto]) txt("X", PUESTO_X[f.puesto], 390, 9);
      if (LICENCIA_X[f.licencia]) txt("X", LICENCIA_X[f.licencia], 390, 9);
      if (SUPERF_X[f.superficie]) txt("X", SUPERF_X[f.superficie], 448, 9);
      txt(f.minutosSemana, 396, 446, 9);

      txt(fmtFecha(f.fechaLesion), 137, 471, 7);
      if (f.donde === "Partido") txt("X", 305, 471, 9);
      if (f.donde === "Entrenamiento") txt("X", 368, 471, 9);
      if (f.donde === "Otros") txt(f.dondeOtros || "X", 437, 471);
      txt(f.minuto, 207, 487);
      txt(f.superficieLesion || (SUPERF_X[f.superficie] ? f.superficie : ""), 284, 487);
      if (f.colision === "SI") txt("X", 408, 486);
      if (f.colision === "NO") txt("X", 430, 486);

      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Parte_${(f.apellidos || "jugador").replace(/\s+/g, "_")}_${f.nombre || ""}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e.message);
    }
    setGenerando(false);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-xl font-bold text-white">🩹 Parte de lesiones — Mutualidad</h2>
      <p className="text-zinc-400 text-sm">Elige jugador, revisa los datos y descarga el parte oficial relleno. Todo se procesa en tu dispositivo; ningún dato sale de aquí.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Equipo">
          <select className={inputCls} value={equipo} onChange={e => { setEquipo(e.target.value); setPlayerId(""); }}>
            {equipos.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Jugador">
          <select className={inputCls} value={playerId} onChange={e => elegirJugador(e.target.value)}>
            <option value="">— Elegir —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}{p.dorsal ? ` (#${p.dorsal})` : ""}</option>)}
          </select>
        </Field>
      </div>

      {playerId && (
        <>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Datos del jugador</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nombre"><input className={inputCls} value={f.nombre || ""} onChange={set("nombre")} /></Field>
              <Field label="Apellidos"><input className={inputCls} value={f.apellidos || ""} onChange={set("apellidos")} /></Field>
              <Field label="DNI"><input className={inputCls} value={f.dni || ""} onChange={set("dni")} /></Field>
              <Field label="Fecha de nacimiento"><input type="date" className={inputCls} value={f.fechaNac || ""} onChange={set("fechaNac")} /></Field>
              <Field label="Domicilio"><input className={inputCls} value={f.domicilio || ""} onChange={set("domicilio")} /></Field>
              <Field label="Localidad"><input className={inputCls} value={f.localidad || ""} onChange={set("localidad")} /></Field>
              <Field label="Provincia"><input className={inputCls} value={f.provincia || ""} onChange={set("provincia")} /></Field>
              <Field label="Código postal"><input className={inputCls} value={f.cp || ""} onChange={set("cp")} /></Field>
              <Field label="Teléfono"><input className={inputCls} value={f.telefono || ""} onChange={set("telefono")} /></Field>
              <Field label="Email"><input className={inputCls} value={f.email || ""} onChange={set("email")} /></Field>
            </div>
            <Field label="Puesto"><Pills opts={Object.keys(PUESTO_X)} value={f.puesto || ""} onChange={v => setF({ ...f, puesto: v })} /></Field>
            <Field label="Licencia"><Pills opts={Object.keys(LICENCIA_X)} value={f.licencia || ""} onChange={v => setF({ ...f, licencia: v })} /></Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Superficie de entrenamiento"><Pills opts={Object.keys(SUPERF_X)} value={f.superficie || ""} onChange={v => setF({ ...f, superficie: v })} /></Field>
              <Field label="Entrenamiento semanal (minutos)"><input className={inputCls} value={f.minutosSemana || ""} onChange={set("minutosSemana")} placeholder="Ej: 180" /></Field>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">La lesión</p>
            <Field label="Fecha de la lesión"><input type="date" className={inputCls} value={f.fechaLesion || ""} onChange={set("fechaLesion")} /></Field>
            <Field label="¿Dónde se produjo?"><Pills opts={["Partido", "Entrenamiento", "Otros"]} value={f.donde || ""} onChange={v => setF({ ...f, donde: v })} /></Field>
            {f.donde === "Otros" && <Field label="Especificar"><input className={inputCls} value={f.dondeOtros || ""} onChange={set("dondeOtros")} /></Field>}
            {f.donde === "Partido" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="¿En qué minuto?"><input className={inputCls} value={f.minuto || ""} onChange={set("minuto")} /></Field>
                <Field label="Superficie de la lesión"><input className={inputCls} value={f.superficieLesion || ""} onChange={set("superficieLesion")} placeholder="C. artificial" /></Field>
              </div>
            )}
            <Field label="¿Hubo colisión?"><Pills opts={["SI", "NO"]} value={f.colision || ""} onChange={v => setF({ ...f, colision: v })} /></Field>
          </div>

          {error && <p className="text-red-400 text-sm">❌ {error}</p>}
          <button onClick={generar} disabled={generando}
            className="w-full py-3 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold transition-all disabled:opacity-50">
            {generando ? "Generando..." : "📄 Descargar parte relleno"}
          </button>
        </>
      )}
    </div>
  );
}
