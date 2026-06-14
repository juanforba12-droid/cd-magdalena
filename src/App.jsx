import { loadData, saveData, loadSeasons, saveSeasons, subscribeToData, loadFichas, saveFicha, deleteFicha } from "./firebase";
import { useState, useEffect, useRef } from "react";
import * as React from "react";
import GIF from "gif.js";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

// ── Initial state ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e) { console.error("Render error:", e); }
  render() { return this.state.hasError ? <div style={{color:'white',padding:20}}>Error al renderizar. Recarga la página.</div> : this.props.children; }
}

const TEAMS = ["Escoleta", "Prebenjamín", "Benjamín C", "Benjamín B", "Benjamín A", "Alevín B", "Alevín A", "Transición", "Infantil B", "Infantil A", "Cadete", "Juvenil"];
const COORDINATORS = ["Lalo", "Patri", "Jose", "Juan", "Xuso", "Fer", "Oscar"];

const POSITIONS = [
  "Portero","Lateral Derecho","Central","Lateral Izquierdo",
  "Carrilero Derecho","Carrilero Izquierdo","Mediocentro",
  "Mediocentro Defensivo","Mediocentro Ofensivo","Interior Derecho",
  "Interior Izquierdo","Extremo Derecho","Extremo Izquierdo",
  "Delantero","Falso Nueve"
];

function initState() {
  const teams = {};
  TEAMS.forEach(t => {
    teams[t] = { players: [], trainings: [], matches: [], attendance: [], tasks: [], coaches: [] };
  });
  return teams;
}

// ── Tiny UI components ───────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant = "primary", small, className = "", disabled = false }) => {
  const base = "font-bold rounded transition-all duration-150 border-0 ";
  const sizes = small ? "px-3 py-1 text-xs" : "px-5 py-2 text-sm";
  const variants = {
    primary: "bg-red-600 hover:bg-red-500 text-white",
    secondary: "bg-zinc-700 hover:bg-zinc-600 text-zinc-100",
    danger: "bg-zinc-800 hover:bg-red-800 text-red-400 border border-red-900",
    ghost: "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white",
  };
  const disabledClass = disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "cursor-pointer";
  return (
    <button
      className={`${base}${sizes} ${variants[variant]} ${disabledClass} ${className}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs text-zinc-400 uppercase tracking-wider">{label}</label>}
    <input
      {...props}
      className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full"
    />
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs text-zinc-400 uppercase tracking-wider">{label}</label>}
    <textarea
      {...props}
      className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full resize-none"
      rows={4}
    />
  </div>
);

const Card = ({ children, className = "", onClick }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 ${className}`}>{children}</div>
);

const Badge = ({ children, color = "zinc" }) => {
  const colors = {
    zinc: "bg-zinc-800 text-zinc-300",
    red: "bg-red-900/60 text-red-300",
    green: "bg-green-900/60 text-green-300",
    yellow: "bg-yellow-900/60 text-yellow-300",
    blue: "bg-blue-900/60 text-blue-300",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color]}`}>{children}</span>;
};

// ── Attendance mini-bar chart ─────────────────────────────────────────────────
function AttendanceChart({ present, late, absent }) {
  const total = present + late + absent || 1;
  const bars = [
    { label: "Asistió", val: present, color: "bg-green-500" },
    { label: "Tarde", val: late, color: "bg-yellow-500" },
    { label: "No asistió", val: absent, color: "bg-red-600" },
  ];
  return (
    <div className="space-y-2 mt-2">
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 w-20">{b.label}</span>
          <div className="flex-1 bg-zinc-800 rounded-full h-3">
            <div
              className={`${b.color} h-3 rounded-full transition-all duration-500`}
              style={{ width: `${(b.val / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-zinc-300 w-5 text-right">{b.val}</span>
        </div>
      ))}
    </div>
  );
}

// SECTION: Plantilla
// ══════════════════════════════════════════════════════════════════════════════
function PlantillaSection({ team, data, onSave, isCoord, seasons, db }) {
  const [tab, setTab] = useState("oficial"); // "oficial" | "probando" | "convocatoria"
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [dorsal, setDorsal] = useState("");
  const [positions, setPositions] = useState([]);
  const [posicionPrincipal, setPosicionPrincipal] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dni, setDni] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [statsPlayer, setStatsPlayer] = useState(null);
  const [attPlayer, setAttPlayer] = useState(null);
  const [search, setSearch] = useState("");
  const [fichaUploading, setFichaUploading] = useState({});
  const [fichaVisor, setFichaVisor] = useState(null);
  const [fichas, setFichas] = useState(null);

  // ── Historial de partidos ─────────────────────────────────────────────────
  const getPlayerMatchHistory = (playerId) => {
    return (data.matches || [])
      .filter(m => m.convocatoria?.find(c => c.playerId === playerId && c.nota !== "" && c.nota !== undefined && c.nota !== null))
      .map(m => {
        const c = m.convocatoria.find(c => c.playerId === playerId);
        return { rival: m.rival, fecha: m.fecha, nota: parseFloat(c.nota), minutos: c.minutos, goles: c.goles, asistencias: c.asistencias, status: c.status };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  };

  // ── Historial de asistencia a entrenamientos ──────────────────────────────
  const getPlayerAttHistory = (playerId) => {
    const records = (data.attendance || []).filter(a => a.playerId === playerId);
    const present = records.filter(r => r.status === "present").length;
    const late = records.filter(r => r.status === "late").length;
    const absent = records.filter(r => r.status === "absent").length;
    const total = present + late + absent;
    // Detailed list: join with training sessions
    const detail = records.map(r => {
      const training = (data.trainings || []).find(t => `t_${t.id}` === r.sessionId);
      return { fecha: r.fecha || training?.fecha || "—", status: r.status, sessionId: r.sessionId };
    }).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
    return { present, late, absent, total, detail };
  };

  useEffect(() => { if (!isCoord) return; loadFichas(team).then(setFichas); }, [team]);

  const statusLabel = { titular: "Titular", suplente: "Suplente", no_conv: "No conv." };
  const statusColor = { titular: "green", suplente: "blue", no_conv: "zinc" };

  const PLAYER_STATUSES = [
    { val: "disponible", label: "Disponible", color: "bg-green-900/40 border-green-700 text-green-300" },
    { val: "lesionado",  label: "Lesionado",  color: "bg-red-900/40 border-red-700 text-red-300" },
    { val: "sancionado", label: "Sancionado", color: "bg-yellow-900/40 border-yellow-700 text-yellow-300" },
    { val: "duda",       label: "Duda",       color: "bg-orange-900/40 border-orange-700 text-orange-300" },
  ];

  const posColorMap = {
    Portero:      { bg: "bg-yellow-900/30", text: "text-yellow-300", border: "border-yellow-700/50", dot: "bg-yellow-400" },
    Defensa:      { bg: "bg-blue-900/30",   text: "text-blue-300",   border: "border-blue-700/50",   dot: "bg-blue-400" },
    Mediocentro:  { bg: "bg-green-900/30",  text: "text-green-300",  border: "border-green-700/50",  dot: "bg-green-400" },
    Delantero:    { bg: "bg-red-900/30",    text: "text-red-300",    border: "border-red-700/50",    dot: "bg-red-400" },
    "Sin posición": { bg: "bg-zinc-800/50", text: "text-zinc-400",   border: "border-zinc-700/50",   dot: "bg-zinc-500" },
  };

  const getPosGroup = (p) => {
    const pp = p.posicionPrincipal || (p.positions||[])[0] || "";
    if (pp === "Portero") return "Portero";
    if (["Lateral Derecho","Central","Lateral Izquierdo","Carrilero Derecho","Carrilero Izquierdo","Defensa"].includes(pp)) return "Defensa";
    if (["Mediocentro","Mediocentro Defensivo","Mediocentro Ofensivo","Interior Derecho","Interior Izquierdo"].includes(pp)) return "Mediocentro";
    if (["Extremo Derecho","Extremo Izquierdo","Delantero","Falso Nueve"].includes(pp)) return "Delantero";
    if (["Portero","Defensa","Mediocentro","Delantero"].includes(pp)) return pp;
    return "Sin posición";
  };

  const setPlayerStatus = (playerId, status) => {
    const players = (data.players || []).map(p => p.id !== playerId ? p : { ...p, status });
    onSave({ ...data, players });
  };

  const open = (p = null) => {
    setEditing(p);
    setName(p ? p.name : "");
    setDorsal(p ? p.dorsal : "");
    setPositions(p ? (p.positions || []) : []);
    setPosicionPrincipal(p ? (p.posicionPrincipal || (p.positions||[])[0] || "") : "");
    setTelefono(p ? (p.telefono || "") : "");
    setDni(p ? (p.dni || "") : "");
    setFechaNacimiento(p ? (p.fechaNacimiento || "") : "");
    setShowForm(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const players = [...(data.players || [])];
    const playerData = { name, dorsal, positions, posicionPrincipal, ...(isCoord ? { telefono, dni, fechaNacimiento } : {}) };
    if (editing) {
      const idx = players.findIndex(p => p.id === editing.id);
      players[idx] = { ...editing, ...playerData };
    } else {
      players.push({ id: Date.now(), ...playerData });
    }
    onSave({ ...data, players });
    setShowForm(false);
  };

  const del = (id) => {
    if (!window.confirm("¿Eliminar jugador?\nSe eliminarán también sus datos, informes y ficha PDF si tiene.")) return;
    if (fichas?.[id]) deleteFicha(team, id).catch(() => {});
    setFichas(prev => { const n = { ...(prev||{}) }; delete n[id]; return n; });
    onSave({ ...data, players: data.players.filter(p => p.id !== id) });
  };

  const handleFichaUpload = async (player, file) => {
    if (!file || file.type !== "application/pdf") {
      alert("Solo se admiten archivos PDF.");
      return;
    }
    if (file.size > 700 * 1024) {
      alert("El PDF no puede superar 700 KB.\nUsa ilovepdf.com para reducir el tamaño.");
      return;
    }
    setFichaUploading(prev => ({ ...prev, [player.id]: true }));
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      const result = await saveFicha(team, player.id, base64, file.name);
      setFichaUploading(prev => ({ ...prev, [player.id]: false }));
      if (result.ok) {
        setFichas(prev => ({ ...(prev||{}), [String(player.id)]: { base64, nombre: file.name } }));
      } else {
        alert("Error al guardar la ficha: " + result.error);
      }
    };
    reader.onerror = () => {
      setFichaUploading(prev => ({ ...prev, [player.id]: false }));
      alert("Error al leer el archivo.");
    };
    reader.readAsDataURL(file);
  };

  const handleFichaDelete = async (player) => {
    if (!window.confirm(`¿Eliminar la ficha PDF de ${player.name}?`)) return;
    setFichaUploading(prev => ({ ...prev, [player.id]: true }));
    await deleteFicha(team, player.id);
    setFichaUploading(prev => ({ ...prev, [player.id]: false }));
    setFichas(prev => { const n = { ...(prev||{}) }; delete n[String(player.id)]; return n; });
  };

  const togglePos = (pos) => {
    setPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };

  const POSICIONES_ORDEN = ["Portero","Defensa","Mediocentro","Delantero","Sin posición"];
  const posLabel = { Portero: "Porteros", Defensa: "Defensas", Mediocentro: "Centrocampistas", Delantero: "Delanteros", "Sin posición": "Sin posición" };

  const filtered = (data.players || []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedPlayers = POSICIONES_ORDEN.map(pos => ({
    pos,
    players: filtered
      .filter(p => getPosGroup(p) === pos)
      .sort((a,b) => (parseInt(a.dorsal)||999) - (parseInt(b.dorsal)||999))
  })).filter(g => g.players.length > 0);

  return (
    <div className="space-y-4">
      {/* Header + Tabs */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Plantilla — {team}</h2>
        {tab === "oficial"
          ? <Btn onClick={() => open()}>+ Añadir jugador</Btn>
          : <Btn onClick={() => { setTab("oficial"); setTimeout(() => { window.dispatchEvent(new CustomEvent("openProbandoForm")); }, 50); }}>+ Añadir jugador en prueba</Btn>
        }
      </div>
      {/* Pestañas */}
      <div className="flex gap-0 border-b border-zinc-800">
        <button
          onClick={() => { setTab("oficial"); setShowForm(false); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${tab === "oficial" ? "border-red-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >👥 Plantilla oficial</button>
        <button
          onClick={() => { setTab("probando"); setShowForm(false); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${tab === "probando" ? "border-blue-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >🔍 Probando {(data.probando||[]).length > 0 && <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded-full">{(data.probando||[]).length}</span>}</button>
        <button
          onClick={() => { setTab("convocatoria"); setShowForm(false); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${tab === "convocatoria" ? "border-orange-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >📋 Convocatoria</button>
      </div>
      {tab === "probando" && <ProbandoContent team={team} data={data} onSave={onSave} isCoord={isCoord} />}
      {tab === "convocatoria" && <ConvocatoriaContent team={team} data={data} onSave={onSave} isCoord={isCoord} db={db || {}} />}
      {tab === "oficial" && <>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-red-900/50">
          <h3 className="text-sm font-bold text-zinc-300 mb-4">{editing ? "Editar jugador" : "Nuevo jugador"}</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Input label="Nombre" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Dorsal" type="number" value={dorsal} onChange={e => setDorsal(e.target.value)} />
          </div>
          {isCoord && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Input label="Teléfono" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />
              <Input label="DNI" value={dni} onChange={e => setDni(e.target.value)} />
              <Input label="Fecha de nacimiento" type="date" value={fechaNacimiento} onChange={e => setFechaNacimiento(e.target.value)} />
            </div>
          )}
          <div className="mb-4">
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Posición principal</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {["Portero","Defensa","Mediocentro","Delantero"].map(pos => {
                const c = posColorMap[pos];
                return (
                  <button key={pos} onClick={() => { setPosicionPrincipal(pos); setPositions(prev => prev.includes(pos) ? prev : [pos, ...prev.filter(p=>p!==pos)]); }}
                    className={`text-xs px-3 py-1.5 rounded border transition-all font-medium ${posicionPrincipal===pos ? `${c.bg} ${c.border} ${c.text}` : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                  >{pos}</button>
                );
              })}
            </div>
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Posiciones alternativas</label>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map(pos => (
                <button key={pos} onClick={() => togglePos(pos)}
                  className={`text-xs px-2 py-1 rounded border transition-all ${positions.includes(pos) ? "bg-zinc-600 border-zinc-400 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                >{pos}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Btn onClick={save}>Guardar</Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      {/* Search */}
      <Input placeholder="🔍 Buscar jugador por nombre..." value={search} onChange={e => setSearch(e.target.value)} />

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm">{search ? `No hay jugadores con "${search}"` : "No hay jugadores en la plantilla."}</p>
      ) : (
        <div className="space-y-6">
          {groupedPlayers.map(({ pos, players }) => {
            const c = posColorMap[pos] || posColorMap["Sin posición"];
            return (
              <div key={pos}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`}></div>
                  <span className={`text-xs font-bold uppercase tracking-widest ${c.text}`}>
                    {posLabel[pos] || pos} ({players.length})
                  </span>
                </div>
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800">
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider w-12">Nº</th>
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Nombre</th>
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider hidden sm:table-cell">Posición</th>
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider hidden md:table-cell">Posiciones alt.</th>
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Estado</th>
                        {isCoord && <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">DNI</th>}
                        {isCoord && <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Ficha</th>}
                        <th className="text-right px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p, idx) => {
                        const altPos = (p.positions || []).filter(pp => pp !== p.posicionPrincipal);
                        const attData = getPlayerAttHistory(p.id);
                        return (
                          <tr key={p.id}
                            className={`border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/40 ${idx % 2 === 0 ? "bg-zinc-900/30" : "bg-zinc-900/60"}`}
                          >
                            <td className="px-3 py-3">
                              <span className={`font-black text-base ${c.text}`}>{p.dorsal ? `#${p.dorsal}` : "—"}</span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-white font-semibold">{p.name}</span>
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell">
                              {p.posicionPrincipal ? (
                                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${c.bg} ${c.border} ${c.text}`}>{p.posicionPrincipal}</span>
                              ) : <span className="text-zinc-600 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {altPos.length > 0
                                  ? altPos.slice(0,3).map(pp => (
                                      <span key={pp} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">{pp}</span>
                                    ))
                                  : <span className="text-zinc-600 text-xs">—</span>
                                }
                                {altPos.length > 3 && <span className="text-xs text-zinc-500">+{altPos.length-3}</span>}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1">
                                {PLAYER_STATUSES.map(s => (
                                  <button key={s.val}
                                    onClick={() => setPlayerStatus(p.id, s.val)}
                                    className={`text-xs px-2 py-0.5 rounded border transition-all ${
                                      (p.status || "disponible") === s.val
                                        ? s.color
                                        : "bg-transparent border-zinc-700/50 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400"
                                    }`}
                                  >{s.label}</button>
                                ))}
                              </div>
                            </td>
                            {isCoord && (
                              <td className="px-3 py-3">
                                <span className="text-zinc-300 text-sm font-mono">{p.dni || <span className="text-zinc-600">—</span>}</span>
                              </td>
                            )}
                            {isCoord && (
                              <td className="px-3 py-3">
                                {fichaUploading[p.id] ? (
                                  <span className="text-xs text-zinc-400 animate-pulse">⏳ Guardando...</span>
                                ) : fichas === null ? (
                                  <span className="text-xs text-zinc-600">...</span>
                                ) : fichas[String(p.id)] ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        const b64 = fichas[String(p.id)].base64;
                                        const byteStr = atob(b64.split(",")[1]);
                                        const arr = new Uint8Array(byteStr.length);
                                        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
                                        const blob = new Blob([arr], { type: "application/pdf" });
                                        const blobUrl = URL.createObjectURL(blob);
                                        setFichaVisor({ blobUrl, blob, nombre: fichas[String(p.id)].nombre || "ficha.pdf" });
                                      }}
                                      title={fichas[String(p.id)].nombre || "Ver ficha PDF"}
                                      className="text-xs px-2 py-1 rounded bg-blue-900/40 border border-blue-700/50 text-blue-300 hover:bg-blue-900/70 transition-all font-medium"
                                    >
                                      📄 Ver
                                    </button>
                                    <label
                                      title="Reemplazar PDF"
                                      className="text-xs px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all cursor-pointer"
                                    >
                                      🔄
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        className="hidden"
                                        onChange={e => { if (e.target.files[0]) handleFichaUpload(p, e.target.files[0]); e.target.value = ""; }}
                                      />
                                    </label>
                                    <button
                                      onClick={() => handleFichaDelete(p)}
                                      title="Eliminar ficha"
                                      className="text-xs px-1.5 py-1 rounded bg-zinc-800 border border-red-900/50 text-red-500 hover:bg-red-900/30 hover:border-red-700 transition-all"
                                    >✕</button>
                                  </div>
                                ) : (
                                  <label
                                    title="Subir ficha PDF"
                                    className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all cursor-pointer flex items-center gap-1 w-fit"
                                  >
                                    ⬆️ Subir
                                    <input
                                      type="file"
                                      accept="application/pdf"
                                      className="hidden"
                                      onChange={e => { if (e.target.files[0]) handleFichaUpload(p, e.target.files[0]); e.target.value = ""; }}
                                    />
                                  </label>
                                )}
                              </td>
                            )}
                            <td className="px-3 py-3">
                              <div className="flex gap-1 justify-end">
                                <Btn small variant="ghost" onClick={() => setStatsPlayer(p)} title="Estadísticas de temporada">📈</Btn>
                                <Btn small variant="ghost" onClick={() => setAttPlayer(p)} title="Asistencia a entrenamientos">
                                  {attData.total > 0
                                    ? <span className="flex items-center gap-0.5">📋 <span className="text-green-400">{attData.present}</span>/<span className="text-red-400">{attData.absent}</span></span>
                                    : "📋"}
                                </Btn>
                                <Btn small variant="ghost" onClick={() => {
                                  window.dispatchEvent(new CustomEvent("openInformes", { detail: { player: p, team } }));
                                }} title="Informes del jugador">
                                  {(p.reports || []).length > 0 ? `📝 ${(p.reports||[]).length}` : "📝"}
                                </Btn>
                                <Btn small variant="secondary" onClick={() => open(p)} title="Editar">✏️</Btn>
                                <Btn small variant="danger" onClick={() => del(p.id)} title="Eliminar">🗑️</Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </>}
      {fichaVisor && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-700 shrink-0">
            <span className="text-white font-semibold text-sm truncate max-w-xs">{fichaVisor.nombre}</span>
            <div className="flex gap-2">
              {navigator.share && (
                <button onClick={async () => {
                  try {
                    const file = new File([fichaVisor.blob], fichaVisor.nombre, { type: "application/pdf" });
                    await navigator.share({ files: [file], title: fichaVisor.nombre });
                  } catch(e) { if (e.name !== "AbortError") alert("Error: " + e.message); }
                }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white text-sm font-semibold">
                  📤 Compartir
                </button>
              )}
              <button onClick={() => { URL.revokeObjectURL(fichaVisor.blobUrl); setFichaVisor(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold">
                ✕ Cerrar
              </button>
            </div>
          </div>
          <iframe src={fichaVisor.blobUrl} className="flex-1 w-full border-0" title={fichaVisor.nombre} />
        </div>
      )}

      {/* ── Modal: Asistencia a entrenamientos ────────────────────────────── */}
      {attPlayer && (() => {
        const att = getPlayerAttHistory(attPlayer.id);
        const pct = att.total ? Math.round((att.present / att.total) * 100) : 0;
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setAttPlayer(null)}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                <div>
                  <h3 className="text-white font-bold text-lg">📋 Asistencia</h3>
                  <p className="text-zinc-400 text-sm">{attPlayer.name}</p>
                </div>
                <Btn small variant="secondary" onClick={() => setAttPlayer(null)}>✕</Btn>
              </div>
              <div className="p-5 border-b border-zinc-800">
                {att.total === 0 ? (
                  <p className="text-zinc-500 text-sm">Sin registros de asistencia todavía.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-3 mb-4 text-center">
                      <div className="bg-zinc-800 rounded-lg p-3">
                        <div className="text-xl font-black text-white">{att.total}</div>
                        <div className="text-xs text-zinc-500 mt-1">Total</div>
                      </div>
                      <div className="bg-green-900/30 rounded-lg p-3">
                        <div className="text-xl font-black text-green-400">{att.present}</div>
                        <div className="text-xs text-zinc-500 mt-1">Asistió</div>
                      </div>
                      <div className="bg-yellow-900/30 rounded-lg p-3">
                        <div className="text-xl font-black text-yellow-400">{att.late}</div>
                        <div className="text-xs text-zinc-500 mt-1">Tarde</div>
                      </div>
                      <div className="bg-red-900/30 rounded-lg p-3">
                        <div className="text-xl font-black text-red-400">{att.absent}</div>
                        <div className="text-xs text-zinc-500 mt-1">No asistió</div>
                      </div>
                    </div>
                    <div className="mb-2 flex justify-between text-xs text-zinc-400">
                      <span>Asistencia</span>
                      <span className={pct >= 75 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400"}>{pct}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 mb-4">
                      <div className={`h-2 rounded-full transition-all ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{width: `${pct}%`}}></div>
                    </div>
                    <div className="space-y-1.5">
                      {att.detail.map((d, i) => (
                        <div key={i} className="flex items-center justify-between bg-zinc-800/60 rounded px-3 py-1.5">
                          <span className="text-zinc-400 text-xs">📅 {d.fecha}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            d.status === "present" ? "bg-green-900/40 text-green-300" :
                            d.status === "late"    ? "bg-yellow-900/40 text-yellow-300" :
                                                     "bg-red-900/40 text-red-300"
                          }`}>
                            {d.status === "present" ? "Asistió" : d.status === "late" ? "Tarde" : "No asistió"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal: Estadísticas de temporada ─────────────────────────────── */}
      {statsPlayer && (() => {
        const history = getPlayerMatchHistory(statsPlayer.id);
        const avg = history.length ? (history.reduce((s, h) => s + h.nota, 0) / history.length).toFixed(2) : null;
        const totalGoles = history.reduce((s, h) => s + (h.goles || 0), 0);
        const totalAsistencias = history.reduce((s, h) => s + (h.asistencias || 0), 0);
        const totalMinutos = history.reduce((s, h) => s + (h.minutos || 0), 0);
        const titulares = history.filter(h => h.status === "titular").length;
        const suplentes = history.filter(h => h.status === "suplente").length;
        const noConv = history.filter(h => h.status === "no_conv").length;

        const seasonStats = (seasons || []).map(s => {
          const teamD = s.data[team] || { matches: [] };
          const player = (teamD.players || []).find(p => p.name === statsPlayer.name);
          if (!player) return null;
          const hist = (teamD.matches || [])
            .filter(m => m.convocatoria?.find(c => c.playerId === player.id && c.nota !== "" && c.nota !== undefined && c.nota !== null))
            .map(m => { const c = m.convocatoria.find(c => c.playerId === player.id); return { nota: parseFloat(c.nota), goles: c.goles||0, asistencias: c.asistencias||0, minutos: c.minutos||0, status: c.status }; });
          if (!hist.length) return null;
          return {
            name: s.name,
            avg: (hist.reduce((a, h) => a + h.nota, 0) / hist.length).toFixed(2),
            goles: hist.reduce((a, h) => a + h.goles, 0),
            asistencias: hist.reduce((a, h) => a + h.asistencias, 0),
            partidos: hist.length,
            titulares: hist.filter(h => h.status === "titular").length,
            suplentes: hist.filter(h => h.status === "suplente").length,
          };
        }).filter(Boolean);

        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setStatsPlayer(null)}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                <div>
                  <h3 className="text-white font-bold text-lg">{statsPlayer.name}</h3>
                  <p className="text-zinc-400 text-sm">Estadísticas de temporada</p>
                </div>
                <Btn small variant="secondary" onClick={() => setStatsPlayer(null)}>✕</Btn>
              </div>
              {seasonStats.length > 0 && (
                <div className="p-5 border-b border-zinc-800">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Evolución por temporadas</p>
                  <div className="space-y-3">
                    {seasonStats.map((s, i) => (
                      <div key={i} className="bg-zinc-800 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-white font-semibold text-sm">📦 {s.name}</span>
                          <span className={`text-xl font-black ${parseFloat(s.avg) >= 7 ? "text-green-400" : parseFloat(s.avg) >= 5 ? "text-yellow-400" : "text-red-400"}`}>{s.avg}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1 text-center text-xs">
                          <div><div className="text-white font-bold">{s.partidos}</div><div className="text-zinc-500">PJ</div></div>
                          <div><div className="text-green-400 font-bold">{s.goles}</div><div className="text-zinc-500">Goles</div></div>
                          <div><div className="text-yellow-400 font-bold">{s.asistencias}</div><div className="text-zinc-500">Asist.</div></div>
                          <div><div className="text-blue-400 font-bold">{s.titulares}</div><div className="text-zinc-500">Tit.</div></div>
                          <div><div className="text-zinc-400 font-bold">{s.suplentes}</div><div className="text-zinc-500">Sup.</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {history.length === 0 ? (
                <div className="p-5"><p className="text-zinc-500 text-sm">Sin datos esta temporada.</p></div>
              ) : (
                <>
                  <div className="p-5 border-b border-zinc-800">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Resumen de temporada</p>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-zinc-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-red-400">{avg}</div>
                        <div className="text-xs text-zinc-500 mt-1">Nota media</div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-white">{history.length}</div>
                        <div className="text-xs text-zinc-500 mt-1">Partidos</div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-blue-400">{totalMinutos}</div>
                        <div className="text-xs text-zinc-500 mt-1">Minutos</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-zinc-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-green-400">{totalGoles}</div>
                        <div className="text-xs text-zinc-500 mt-1">Goles</div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-yellow-400">{totalAsistencias}</div>
                        <div className="text-xs text-zinc-500 mt-1">Asistencias</div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-purple-400">{totalGoles + totalAsistencias}</div>
                        <div className="text-xs text-zinc-500 mt-1">G+A</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-green-900/30 rounded p-2">
                        <div className="text-green-400 font-bold text-lg">{titulares}</div>
                        <div className="text-zinc-500">Titulares</div>
                      </div>
                      <div className="bg-blue-900/30 rounded p-2">
                        <div className="text-blue-400 font-bold text-lg">{suplentes}</div>
                        <div className="text-zinc-500">Suplentes</div>
                      </div>
                      <div className="bg-zinc-800 rounded p-2">
                        <div className="text-zinc-400 font-bold text-lg">{noConv}</div>
                        <div className="text-zinc-500">No conv.</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Partido a partido</p>
                    {history.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-4 py-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white text-sm font-semibold">vs {h.rival}</span>
                            <Badge color={statusColor[h.status]}>{statusLabel[h.status]}</Badge>
                          </div>
                          <div className="flex gap-3 text-xs text-zinc-400 flex-wrap">
                            <span>📅 {h.fecha}</span>
                            <span>⏱ {h.minutos} min</span>
                            {h.goles > 0 && <span className="text-green-400">⚽ {h.goles}</span>}
                            {h.asistencias > 0 && <span className="text-yellow-400">🎯 {h.asistencias}</span>}
                          </div>
                        </div>
                        <div className={`text-xl font-black ${h.nota >= 7 ? "text-green-400" : h.nota >= 5 ? "text-yellow-400" : "text-red-400"}`}>
                          {h.nota.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// PIZARRA TÁCTICA
// ══════════════════════════════════════════════════════════════════════════════
const PLAYER_COLORS = ["red","yellow","blue","green"];
const PLAYER_COLOR_STYLES = { red:"bg-red-600 border-red-400", yellow:"bg-yellow-500 border-yellow-300", blue:"bg-blue-600 border-blue-400", green:"bg-green-600 border-green-400" };
const PLAYER_COLOR_HEX2 = { red:"#dc2626", yellow:"#eab308", blue:"#2563eb", green:"#16a34a" };

const MATERIALS = [
  { id:"cono", label:"Cono 🟠", svg: <svg viewBox="0 0 24 24" fill="#f97316" className="w-5 h-5"><path d="M12 2L4 20h16L12 2z"/><ellipse cx="12" cy="20" rx="8" ry="2" fill="#f97316" opacity="0.4"/></svg> },
  { id:"cono_amarillo", label:"Cono 🟡", svg: <svg viewBox="0 0 24 24" fill="#eab308" className="w-5 h-5"><path d="M12 2L4 20h16L12 2z"/><ellipse cx="12" cy="20" rx="8" ry="2" fill="#eab308" opacity="0.4"/></svg> },
  { id:"cono_rojo", label:"Cono 🔴", svg: <svg viewBox="0 0 24 24" fill="#dc2626" className="w-5 h-5"><path d="M12 2L4 20h16L12 2z"/><ellipse cx="12" cy="20" rx="8" ry="2" fill="#dc2626" opacity="0.4"/></svg> },
  { id:"cono_azul", label:"Cono 🔵", svg: <svg viewBox="0 0 24 24" fill="#2563eb" className="w-5 h-5"><path d="M12 2L4 20h16L12 2z"/><ellipse cx="12" cy="20" rx="8" ry="2" fill="#2563eb" opacity="0.4"/></svg> },
  { id:"chino", label:"Chino 🟡", svg: <svg viewBox="0 0 24 24" fill="#eab308" className="w-5 h-5"><path d="M12 2L5 21h14L12 2z"/><circle cx="12" cy="21" r="2.5"/></svg> },
  { id:"chino_naranja", label:"Chino 🟠", svg: <svg viewBox="0 0 24 24" fill="#f97316" className="w-5 h-5"><path d="M12 2L5 21h14L12 2z"/><circle cx="12" cy="21" r="2.5"/></svg> },
  { id:"chino_rojo", label:"Chino 🔴", svg: <svg viewBox="0 0 24 24" fill="#dc2626" className="w-5 h-5"><path d="M12 2L5 21h14L12 2z"/><circle cx="12" cy="21" r="2.5"/></svg> },
  { id:"chino_azul", label:"Chino 🔵", svg: <svg viewBox="0 0 24 24" fill="#2563eb" className="w-5 h-5"><path d="M12 2L5 21h14L12 2z"/><circle cx="12" cy="21" r="2.5"/></svg> },
  { id:"porteria_grande", label:"Portería G", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 text-white"><rect x="2" y="5" width="20" height="12" rx="0.5"/><line x1="2" y1="17" x2="2" y2="21"/><line x1="22" y1="17" x2="22" y2="21"/><line x1="2" y1="21" x2="22" y2="21" strokeDasharray="2 2"/></svg> },
  { id:"porteria_pequeña", label:"Portería P", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 text-zinc-300"><rect x="5" y="8" width="14" height="9" rx="0.5"/><line x1="5" y1="17" x2="5" y2="20"/><line x1="19" y1="17" x2="19" y2="20"/><line x1="5" y1="20" x2="19" y2="20" strokeDasharray="2 2"/></svg> },
  { id:"escalera", label:"Escalera", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-amber-400"><line x1="4" y1="4" x2="4" y2="20"/><line x1="20" y1="4" x2="20" y2="20"/><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="4" y1="19" x2="20" y2="19"/></svg> },
  { id:"pesa", label:"Pesa", svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-zinc-400"><rect x="1" y="9" width="4" height="6" rx="1"/><rect x="19" y="9" width="4" height="6" rx="1"/><rect x="6" y="7" width="4" height="10" rx="1"/><rect x="14" y="7" width="4" height="10" rx="1"/><rect x="10" y="10.5" width="4" height="3" rx="0.5"/></svg> },
  { id:"pica", label:"Pica", svg: <svg viewBox="0 0 24 24" className="w-5 h-5 text-pink-400"><rect x="11" y="4" width="2" height="17" rx="1" fill="currentColor"/><polygon points="12,2 10,6 14,6" fill="currentColor"/><ellipse cx="12" cy="21" rx="3" ry="1.5" fill="currentColor" opacity="0.6"/></svg> },
  { id:"aro", label:"Aro 🔵", svg: <svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="3" className="w-5 h-5"><circle cx="12" cy="12" r="8"/></svg> },
  { id:"aro_rojo", label:"Aro 🔴", svg: <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" className="w-5 h-5"><circle cx="12" cy="12" r="8"/></svg> },
  { id:"aro_amarillo", label:"Aro 🟡", svg: <svg viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="3" className="w-5 h-5"><circle cx="12" cy="12" r="8"/></svg> },
  { id:"aro_verde", label:"Aro 🟢", svg: <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" className="w-5 h-5"><circle cx="12" cy="12" r="8"/></svg> },
  { id:"flecha", label:"Flecha", svg: <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5"><line x1="4" y1="20" x2="20" y2="4"/><polyline points="10,4 20,4 20,14"/></svg> },
  { id:"balon", label:"Balón", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-white"><circle cx="12" cy="12" r="9"/><path d="M12 3 L9 8 L12 13 L15 8 Z" fill="currentColor" opacity="0.5"/><path d="M3.5 9 L9 8 L12 13 L8 17 Z" fill="currentColor" opacity="0.3"/><path d="M20.5 9 L15 8 L12 13 L16 17 Z" fill="currentColor" opacity="0.3"/></svg> },
  { id:"valla", label:"Valla", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-lime-400"><rect x="2" y="8" width="20" height="8" rx="1"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/><line x1="2" y1="12" x2="22" y2="12"/></svg> },

];

const FIELD_TYPES = [
  { id:"full", label:"⚽ Campo completo" },
  { id:"half", label:"½ Medio campo" },
  { id:"blank", label:"🟩 Campo libre" },
];

function FieldMarkings({ type }) {
  if (type === "blank") return null;
  if (type === "half") return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 65" preserveAspectRatio="none">
      <rect x="2" y="2" width="96" height="61" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <line x1="2" y1="2" x2="98" y2="2" stroke="white" strokeWidth="0.8" opacity="0.8"/>
      <rect x="28" y="2" width="44" height="18" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="36" y="2" width="28" height="8" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="42" y="0" width="16" height="2" fill="none" stroke="white" strokeWidth="0.7" opacity="0.8"/>
      <path d="M 38 20 A 12 12 0 0 0 62 20" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <circle cx="50" cy="14" r="0.8" fill="white" opacity="0.6"/>
      <path d="M2 5 A3 3 0 0 1 5 2" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <path d="M95 2 A3 3 0 0 1 98 5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
    </svg>
  );
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 65" preserveAspectRatio="none">
      <rect x="2" y="2" width="96" height="61" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <line x1="50" y1="2" x2="50" y2="63" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <circle cx="50" cy="32.5" r="9" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <circle cx="50" cy="32.5" r="0.8" fill="white" opacity="0.6"/>
      <rect x="2" y="18" width="14" height="29" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="2" y="24" width="6" height="17" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="0" y="27" width="2" height="11" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
      <rect x="84" y="18" width="14" height="29" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="92" y="24" width="6" height="17" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="98" y="27" width="2" height="11" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
      <circle cx="11" cy="32.5" r="0.8" fill="white" opacity="0.6"/>
      <circle cx="89" cy="32.5" r="0.8" fill="white" opacity="0.6"/>
      <path d="M2 5 A3 3 0 0 1 5 2" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <path d="M95 2 A3 3 0 0 1 98 5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <path d="M98 60 A3 3 0 0 1 95 63" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <path d="M5 63 A3 3 0 0 1 2 60" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
    </svg>
  );
}

function Pizarra({ value, onChange, fieldType: fieldTypeProp, onFieldTypeChange }) {
  const [tool, setTool] = useState("player_red");
  const [playerNum, setPlayerNum] = useState(1);
  const [_fieldType, _setFieldType] = useState("full");
  const fieldType = fieldTypeProp !== undefined ? fieldTypeProp : _fieldType;
  const setFieldType = onFieldTypeChange || _setFieldType;
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingItem, setEditingItem] = useState(null);
  const [arrowStart, setArrowStart] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const drawingRef = useRef(false);
  const currentPathRef = useRef([]);
  const erasingRef = useRef(false);
  const [pencilColor, setPencilColor] = useState("#ef4444");
  const [pencilSize, setPencilSize] = useState(2);
  const [pencilMode, setPencilMode] = useState("draw"); // draw | erase
  const fieldRef = useRef(null);
  const toolRef = useRef(tool);
  const pencilColorRef = useRef(pencilColor);
  const pencilSizeRef = useRef(pencilSize);
  const pencilModeRef = useRef("draw");
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { pencilColorRef.current = pencilColor; }, [pencilColor]);
  useEffect(() => { pencilSizeRef.current = pencilSize; }, [pencilSize]);
  useEffect(() => { pencilModeRef.current = pencilMode; }, [pencilMode]);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const handleDown = (e) => {
      if (toolRef.current !== "pencil") return;
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      if (pencilModeRef.current === "erase") {
        erasingRef.current = true;
        return;
      }
      drawingRef.current = true;
      currentPathRef.current = [{x, y}];
      setDrawing(true);
      setCurrentPath([{x, y}]);
    };
    const handleMove = (e) => {
      if (toolRef.current !== "pencil") return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      if (pencilModeRef.current === "erase" && erasingRef.current) {
        const RADIUS = 1;
        onChange(prev => {
          return (prev||[]).flatMap(i => {
            if (i.type !== "drawing") return [i];
            // Dividir el path en segmentos eliminando los puntos cercanos al cursor
            const segments = [];
            let current = [];
            for (const p of i.path) {
              const near = Math.abs(p.x - x) < RADIUS && Math.abs(p.y - y) < RADIUS;
              if (near) {
                if (current.length > 1) segments.push({...i, id: Date.now() + Math.random(), path: current});
                current = [];
              } else {
                current.push(p);
              }
            }
            if (current.length > 1) segments.push({...i, id: Date.now() + Math.random(), path: current});
            return segments;
          });
        });
        return;
      }
      if (!drawingRef.current) return;
      currentPathRef.current = [...currentPathRef.current, {x, y}];
      setCurrentPath([...currentPathRef.current]);
    };
    const handleUp = () => {
      erasingRef.current = false;
      if (toolRef.current === "pencil" && drawingRef.current && currentPathRef.current.length > 1) {
        const newItem = { id: Date.now(), type: "drawing", path: [...currentPathRef.current], color: pencilColorRef.current, size: pencilSizeRef.current };
        onChange(prev => [...(prev||[]), newItem]);
      }
      drawingRef.current = false;
      currentPathRef.current = [];
      setDrawing(false);
      setCurrentPath([]);
    };
    el.addEventListener("mousedown", handleDown);
    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseup", handleUp);
    el.addEventListener("touchstart", handleDown, {passive:false});
    el.addEventListener("touchmove", handleMove, {passive:false});
    el.addEventListener("touchend", handleUp);
    return () => {
      el.removeEventListener("mousedown", handleDown);
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseup", handleUp);
      el.removeEventListener("touchstart", handleDown);
      el.removeEventListener("touchmove", handleMove);
      el.removeEventListener("touchend", handleUp);
    };
  }, []);

  const PENCIL_COLORS = [
    {color:"#ef4444",label:"Rojo"},
    {color:"#3b82f6",label:"Azul"},
    {color:"#f97316",label:"Naranja"},
    {color:"#22c55e",label:"Verde"},
    {color:"#ffffff",label:"Blanco"},
  ];
  const PENCIL_SIZES = [{size:1.5,label:"Fino"},{size:3,label:"Medio"},{size:5,label:"Grueso"}];
  const items = (value || []).filter(i => i != null && typeof i === 'object' && typeof i.type === 'string' && (i.type !== 'drawing' || (Array.isArray(i.path) && i.path.length > 0)));

  const getCoords = (e) => {
    if (e.touches && e.touches[0]) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    return { clientX: e.clientX, clientY: e.clientY };
  };
  const addItem = (e) => {
    if (dragging !== null) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const {clientX, clientY} = getCoords(e);
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y2temp = ((clientY - rect.top) / rect.height) * 100;
    if (tool === "flecha") {
      if (!arrowStart) { setArrowStart({x, y: y2temp}); return; }
      const newArrow = { id: Date.now(), type: "flecha", x: arrowStart.x, y: arrowStart.y, x2: x, y2: y2temp };
      onChange([...items, newArrow]);
      setArrowStart(null);
      return;
    }
    const y = ((clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    if (tool === "erase") return;
    if (tool === "move") return;
    if (tool === "pencil") return;
    const isPlayer = tool.startsWith("player_");
    const newItem = { id: Date.now(), x, y, type: tool, ...(isPlayer ? { num: playerNum } : {}) };
    if (isPlayer) setPlayerNum(n => n + 1);
    onChange([...items, newItem]);
  };

  const startDrag = (e, id) => {
    e.stopPropagation();
    if (e.preventDefault) e.preventDefault();
    const rect = fieldRef.current.getBoundingClientRect();
    const item = items.find(i => i.id === id);
    setDragOffset({
      x: e.clientX - rect.left - (item.x / 100) * rect.width,
      y: e.clientY - rect.top - (item.y / 100) * rect.height,
    });
    setDragging(id);
  };

  const onTouchMove = (e) => { e.preventDefault(); onMouseMove(e.touches[0]); };
  const onTouchStart = (e) => { if(e.touches.length===1) startDrag({...e, clientX:e.touches[0].clientX, clientY:e.touches[0].clientY, stopPropagation:()=>e.stopPropagation(), preventDefault:()=>e.preventDefault()}, null); };
  const onMouseMove = (e) => {
    if (dragging === null) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100));
    onChange(items.map(i => i.id === dragging ? { ...i, x, y } : i));
  };

  const onMouseUp = () => setDragging(null);
  const startPencil = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const {clientX, clientY} = getCoords(e);
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    drawingRef.current = true;
    currentPathRef.current = [{x, y}];
    setDrawing(true);
    setCurrentPath([{x, y}]);
  };
  const removeItem = (id) => onChange(items.filter(i => i.id !== id));
  const removeDrawingAt = (e) => {
    if (tool !== "erase") return;
    const rect = fieldRef.current.getBoundingClientRect();
    const {clientX, clientY} = getCoords(e);
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    // Eliminar trazos cercanos al punto de clic
    onChange(items.filter(i => {
      if (i.type !== "drawing") return true;
      return !i.path.some(p => Math.abs(p.x - x) < 3 && Math.abs(p.y - y) < 3);
    }));
  };
  const saveEditNum = (id, num) => { onChange(items.map(i => i.id === id ? { ...i, num } : i)); setEditingItem(null); };

  const renderItem = (item, idx) => { if (!item || typeof item !== 'object' || !item.type || typeof item.type !== 'string') return null;
    if (item.type === "flecha") {
      if (item.x2 == null || item.y2 == null) return null;
      return (
        <svg key={item.id} className="absolute inset-0 w-full h-full" style={{zIndex:5, pointerEvents: tool==="erase"?"auto":"none"}}>
          <defs><marker id={`arr-${item.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="white"/></marker></defs>
          <line x1={`${item.x}%`} y1={`${item.y}%`} x2={`${item.x2}%`} y2={`${item.y2}%`} stroke="white" strokeWidth="8" strokeOpacity="0" onMouseDown={e=>{e.stopPropagation();if(tool==="erase")removeItem(item.id);}} style={{cursor:tool==="erase"?"crosshair":"default"}}/>
          <line x1={`${item.x}%`} y1={`${item.y}%`} x2={`${item.x2}%`} y2={`${item.y2}%`} stroke="white" strokeWidth="2.5" markerEnd={`url(#arr-${item.id})`} style={{pointerEvents:"none"}}/>
        </svg>
      );
    }
    const isPlayer = item.type.startsWith("player_");
    const color = isPlayer ? item.type.replace("player_", "") : null;
    const mat = !isPlayer ? MATERIALS.find(m => m.id === item.type) : null;
    return (
      <div
        key={item.id}
        className="absolute transform -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ left:`${item.x}%`, top:`${item.y}%`, cursor: tool==="erase"?"crosshair":"grab", zIndex: dragging===item.id?10:1 }}
        onMouseDown={e => { if(tool==="erase"){e.stopPropagation();removeItem(item.id);}else startDrag(e,item.id); }}
        onTouchStart={e => { e.stopPropagation(); if(tool==="erase"){removeItem(item.id);}else{ const t=e.touches[0]; startDrag({clientX:t.clientX,clientY:t.clientY,stopPropagation:()=>e.stopPropagation(),preventDefault:()=>e.preventDefault()},item.id);} }}
        onDoubleClick={e => { e.stopPropagation(); if(isPlayer) setEditingItem({id:item.id,num:item.num??""}); }}
      >
        {isPlayer ? (
          (editingItem !== null && editingItem?.id !== undefined && editingItem?.id === item.id) ? (
            <input autoFocus type="number" defaultValue={editingItem?.num ?? ""}
              className="w-7 h-7 rounded-full text-center font-bold border-2 bg-zinc-900 text-white border-white outline-none"
              style={{fontSize:10}}
              onBlur={e => saveEditNum(item.id, e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") saveEditNum(item.id,e.target.value); if(e.key==="Escape") setEditingItem(null); }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-white font-bold shadow-lg" style={{backgroundColor: PLAYER_COLOR_HEX2[color]||"#dc2626", borderColor: PLAYER_COLOR_HEX2[color]||"#dc2626", fontSize:10}} title="Doble clic para editar número">
              {(item.num != null ? item.num : "")}
            </div>
          )
        ) : (
          <div className="w-7 h-7 flex items-center justify-center drop-shadow-lg">{mat?.svg}</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Field type */}
      <div className="flex gap-1 flex-wrap">
        {FIELD_TYPES.map(f => (
          <button key={f.id} onClick={() => setFieldType(f.id)}
            className={`text-xs px-3 py-1 rounded border transition-all ${fieldType===f.id?"bg-zinc-600 border-zinc-400 text-white":"bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >{f.label}</button>
        ))}
      </div>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 items-center flex-wrap">
          <span className="text-xs text-zinc-500 mr-1">Jugadores:</span>
          {PLAYER_COLORS.map(c => (
            <button key={c} onClick={() => setTool(`player_${c}`)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${PLAYER_COLOR_STYLES[c]} ${tool===`player_${c}`?"scale-125 ring-2 ring-white":"opacity-70"}`}
            />
          ))}
          {tool.startsWith("player_") && (
            <div className="flex items-center gap-1 ml-1">
              <span className="text-xs text-zinc-500">#</span>
              <input type="number" value={playerNum} onChange={e => setPlayerNum(Number(e.target.value))}
                className="w-12 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white text-xs text-center focus:outline-none focus:border-red-600"
              />
            </div>
          )}
        </div>
        <div className="flex gap-1 items-center flex-wrap">
          <span className="text-xs text-zinc-500 mr-1">Material:</span>
          {MATERIALS.map(m => (
            <button key={m.id} onClick={() => setTool(m.id)} title={m.label}
              className={`w-8 h-8 rounded flex items-center justify-center border transition-all ${tool===m.id?"border-white bg-zinc-700 scale-110":"border-zinc-700 bg-zinc-800 opacity-70 hover:opacity-100"}`}
            >{m.svg}</button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTool("move")} className={`px-2 py-1 rounded text-xs border transition-all ${tool==="move"?"bg-blue-700 border-blue-500 text-white":"bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`} title="Mover elementos">✋ Mover</button>
            <button onClick={() => { setTool("pencil"); setPencilMode("draw"); pencilModeRef.current = "draw"; }} className={`px-2 py-1 rounded text-xs border transition-all ${tool==="pencil"?"bg-purple-700 border-purple-500 text-white":"bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`} title="Dibujar">✏️ Lápiz</button>
            <button onClick={() => setTool("erase")}
            className={`px-3 py-1 rounded text-xs border transition-all ${tool==="erase"?"bg-red-700 border-red-500 text-white":"bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >🗑 Borrar</button>
        </div>
        {tool === "pencil" && (
          <div className="flex items-center gap-2 flex-wrap">
            {PENCIL_COLORS.map(c => (
              <button key={c.color} onClick={() => setPencilColor(c.color)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${pencilColor===c.color?"border-white scale-125":"border-zinc-600"}`}
                style={{backgroundColor: c.color}} title={c.label}/>
            ))}
            <div className="w-px h-4 bg-zinc-600"/>
            {PENCIL_SIZES.map(s => (
              <button key={s.size} onClick={() => setPencilSize(s.size)}
                className={`px-2 py-0.5 rounded text-xs border transition-all ${pencilSize===s.size?"bg-purple-700 border-purple-500 text-white":"bg-zinc-800 border-zinc-700 text-zinc-400"}`}
              >{s.label}</button>
            ))}
            <button onClick={() => { setPencilMode("erase"); pencilModeRef.current = "erase"; }}
              className={`px-2 py-0.5 rounded text-xs border transition-all ml-2 ${pencilMode==="erase"?"bg-orange-700 border-orange-500 text-white":"bg-zinc-800 border-zinc-600 text-zinc-300"}`}
            >🧹 Goma</button>
          </div>
        )}
          <button onClick={() => { onChange([]); setPlayerNum(1); }}
            className="px-3 py-1 rounded text-xs border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-red-700 hover:text-red-400 transition-all"
          >Limpiar</button>
        </div>
      <p className="text-xs text-zinc-600">Haz clic para añadir · Arrastra para mover · Doble clic en jugador para editar número</p>
      {/* Field */}
      <div ref={fieldRef} className="relative w-full rounded-xl overflow-hidden select-none pizarra-field"
        style={{ paddingBottom:"65%", background:"#1a6b2e", cursor: tool==="pencil"?"crosshair":tool==="erase"?"cell":"crosshair" }}
        onClick={(e) => { if(tool==="pencil") return; addItem(e); }}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => { setDragging(null); onMouseUp(); }}
        onMouseDown={(e) => { if(tool==="pencil") startPencil(e); if(tool==="erase") erasingRef.current=true; }}
        onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
      >
        <FieldMarkings type={fieldType} />
        {/* Renderizar trazos guardados */}
        <svg className="absolute inset-0 w-full h-full" style={{pointerEvents:"none"}} viewBox="0 0 100 100" preserveAspectRatio="none">
          {items.filter(i=>i.type==="drawing").map(item => (
            <polyline key={item.id}
              points={item.path.map(p=>`${p.x},${p.y}`).join(" ")}
              fill="none" stroke={item.color||"#fff"} strokeWidth={item.size||2}
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* Trazo actual en curso */}
          {drawing && currentPath.length > 1 && (
            <polyline
              points={currentPath.map(p=>`${p.x},${p.y}`).join(" ")}
              fill="none" stroke={pencilColor} strokeWidth={pencilSize}
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div className="absolute inset-0">{items.filter(i=>i.type!=="drawing").map(renderItem)}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TASK EDITOR MODAL
// ══════════════════════════════════════════════════════════════════════════════
function TaskEditorModal({ task, onSave, onClose, saveToLibrary }) {
  const [nombre, setNombre] = useState(task?.nombre || "");
  const [minutos, setMinutos] = useState(task?.minutos || 10);
  const [descripcion, setDescripcion] = useState(task?.descripcion || "");
  const [categoria, setCategoria] = useState(task?.categoria || "");
  const [fieldType, setFieldType] = useState(task?.fieldType || "full");
  const [pizarra, setPizarra] = useState((task?.pizarra || []).filter(el => el != null).map((el, idx) => {
    if (el.type === 'drawing') return { id: el.id || (Date.now() + idx), type: 'drawing', path: el.path || [], color: el.color, size: el.size };
    return { id: el.id || (Date.now() + idx), type: el.type || 'player_red', x: el.x || 0, y: el.y || 0, x2: el.x2, y2: el.y2, color: el.color || (el.type ? el.type.replace('player_','') : 'red') || 'red', num: el.num ?? el.number ?? 1, material: el.material || '' };
  }));

  const handleSave = (toLib = false) => {
    if (!nombre.trim()) return;
    const t = { id: task?.id || Date.now(), nombre, minutos, descripcion, pizarra, categoria, fieldType };
    onSave(t, toLib);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-auto" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-white font-bold text-lg">{task?.id ? "Editar tarea" : "Nueva tarea"}</h3>
          <Btn small variant="secondary" onClick={onClose}>✕</Btn>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre de la tarea" value={nombre} onChange={e => setNombre(e.target.value)} />
            <Input label="Duración (minutos)" type="number" min="1" value={minutos} onChange={e => setMinutos(Number(e.target.value))} />
          </div>
          <Textarea label="Descripción" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} />
          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Categoría</label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={e=>{e.preventDefault();setCategoria("");}} className={`px-2 py-1 rounded text-xs border transition-all ${categoria===""?"bg-zinc-600 border-zinc-400 text-white":"bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>Sin categoría</button>
              {TASK_CATEGORIES.map(c=>(
                <button type="button" key={c.id} onClick={e=>{e.preventDefault();setCategoria(c.id);}} className={`px-2 py-1 rounded text-xs border transition-all ${categoria===c.id?"bg-zinc-600 border-zinc-400 text-white":"bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Pizarra táctica</label>
            <Pizarra value={pizarra} onChange={setPizarra} fieldType={fieldType} onFieldTypeChange={setFieldType} />
          </div>
        </div>
        <div className="p-5 border-t border-zinc-800 flex gap-2 flex-wrap">
          <Btn onClick={() => handleSave(false)}>Guardar en entrenamiento</Btn>
          {saveToLibrary && <Btn variant="secondary" onClick={() => handleSave(true)}>💾 Guardar también en biblioteca</Btn>}
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Tareas (biblioteca)
// ══════════════════════════════════════════════════════════════════════════════

const TASK_CATEGORIES = [
  { id: "activacion", label: "🏃 Activación", color: "orange" },
  { id: "tecnica", label: "⚽ Técnica", color: "blue" },
  { id: "tactica", label: "🧠 Táctica", color: "purple" },
  { id: "fisico", label: "💪 Físico", color: "red" },
  { id: "pliometria", label: "🦘 Pliometría/Potencia", color: "yellow" },
  { id: "transiciones", label: "🔄 Transiciones/Juego Real", color: "green" },
  { id: "finalizacion", label: "🎯 Finalización", color: "pink" },
  { id: "porteria", label: "🧤 Portería", color: "cyan" },
];

function TareasSection({ team, data, onSave, globalTasks, onSaveGlobal, isCoord }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [libTab, setLibTab] = useState("equipo");
  const [filterCat, setFilterCat] = useState("all");
  const [showGlobalEditor, setShowGlobalEditor] = useState(false);
  const [editingGlobal, setEditingGlobal] = useState(null);

  const openEdit = (t) => { setEditing({ ...t, pizarra: (t.pizarra || []).filter(el => el != null) }); setShowEditor(true); };

  const tasks = data.tasks || [];

  const saveTask = (t) => {
    const existing = tasks.findIndex(x => x.id === t.id);
    const updated = existing >= 0 ? tasks.map(x => x.id === t.id ? t : x) : [...tasks, t];
    onSave({ ...data, tasks: updated });
    setShowEditor(false);
    setEditing(null);
  };

  const delTask = (id) => {
    if (!window.confirm("¿Eliminar tarea de la biblioteca?")) return;
    onSave({ ...data, tasks: tasks.filter(t => t.id !== id) });
  };

  const saveGlobalTask = (t) => {
    const existing = (globalTasks||[]).findIndex(x => x.id === t.id);
    const updated = existing >= 0 ? globalTasks.map(x => x.id === t.id ? t : x) : [...(globalTasks||[]), t];
    onSaveGlobal(updated);
    setShowGlobalEditor(false);
    setEditingGlobal(null);
  };

  const delGlobalTask = (id) => {
    if (!window.confirm("¿Eliminar tarea de la biblioteca global?")) return;
    onSaveGlobal((globalTasks||[]).filter(t => t.id !== id));
  };

  const catColor = (catId) => {
    const c = TASK_CATEGORIES.find(c=>c.id===catId);
    return c ? c.color : "zinc";
  };
  const catLabel = (catId) => {
    const c = TASK_CATEGORIES.find(c=>c.id===catId);
    return c ? c.label : "Sin categoría";
  };

  const activeTasks = libTab === "equipo" ? (tasks||[]).filter(t=>t!=null) : (globalTasks||[]).filter(t=>t!=null);
  const filteredTasks = filterCat === "all" ? activeTasks : activeTasks.filter(t=>t.categoria===filterCat);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Biblioteca de tareas</h2>
        <Btn onClick={() => { if(libTab==="equipo"){setEditing(null);setShowEditor(true);}else{setEditingGlobal(null);setShowGlobalEditor(true);} }}>+ Nueva tarea</Btn>
      </div>

      {/* Tabs equipo / global */}
      <div className="flex gap-2 border-b border-zinc-700 pb-2">
        <button onClick={()=>setLibTab("equipo")} className={`px-3 py-1.5 rounded-t text-sm font-medium transition-all ${libTab==="equipo"?"bg-zinc-700 text-white":"text-zinc-400 hover:text-white"}`}>👤 Mi equipo ({(tasks||[]).length})</button>
        <button onClick={()=>setLibTab("global")} className={`px-3 py-1.5 rounded-t text-sm font-medium transition-all ${libTab==="global"?"bg-zinc-700 text-white":"text-zinc-400 hover:text-white"}`}>🌐 Todos los equipos ({(globalTasks||[]).length})</button>
      </div>

      {/* Filtro por categoría */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={()=>setFilterCat("all")} className={`px-2 py-1 rounded text-xs border transition-all ${filterCat==="all"?"bg-zinc-600 border-zinc-400 text-white":"bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>Todas</button>
        {TASK_CATEGORIES.map(c=>(
          <button key={c.id} onClick={()=>setFilterCat(c.id)} className={`px-2 py-1 rounded text-xs border transition-all ${filterCat===c.id?"bg-zinc-600 border-zinc-400 text-white":"bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>{c.label}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredTasks.map(t => (
          <Card key={t.id} className="hover:border-zinc-600 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1 cursor-pointer" onClick={() => setPreview({ ...t, pizarra: (t.pizarra || []).filter(el => el != null) })}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-white font-semibold">{t.nombre}</span>
                  <Badge color="blue">⏱ {t.minutos} min</Badge>
                  {t.categoria && <Badge color={catColor(t.categoria)}>{catLabel(t.categoria)}</Badge>}
                  {libTab==="global" && t.equipo && <Badge color="zinc">👤 {t.equipo}</Badge>}
                </div>
                {t.descripcion && <p className="text-zinc-400 text-sm line-clamp-2">{t.descripcion}</p>}
                {t.pizarra?.length > 0 && <p className="text-zinc-600 text-xs mt-1">🎨 Pizarra con {t.pizarra.length} elementos</p>}
              </div>
              <div className="flex gap-1 ml-3 shrink-0">
                {libTab==="equipo" && <Btn small variant="secondary" onClick={() => openEdit(t)}>✏️</Btn>}
                {libTab==="equipo" && <Btn small variant="secondary" title="Publicar en biblioteca global" onClick={() => { if(window.confirm("¿Publicar esta tarea en la biblioteca de todos los equipos?")) { onSaveGlobal([...(globalTasks||[]), {...t, id: Date.now(), equipo: team}]); } }}>🌐</Btn>}
                {libTab==="equipo" && <Btn small variant="danger" onClick={() => delTask(t.id)}>🗑️</Btn>}
                {libTab==="global" && isCoord && <Btn small variant="secondary" onClick={() => {setEditingGlobal(t);setShowGlobalEditor(true);}}>✏️</Btn>}
                {libTab==="global" && isCoord && <Btn small variant="danger" onClick={() => delGlobalTask(t.id)}>🗑️</Btn>}
              </div>
            </div>
          </Card>
        ))}
        {filteredTasks.length === 0 && <p className="text-zinc-500 text-sm">No hay tareas{filterCat!=="all"?" en esta categoría":""} todavía.</p>}
      </div>

      {showEditor && (
        <TaskEditorModal
          task={editing}
          onSave={(t) => saveTask(t)}
          onClose={() => { setShowEditor(false); setEditing(null); }}
          saveToLibrary={false}
        />
      )}

      {showGlobalEditor && (
        <TaskEditorModal
          task={editingGlobal}
          onSave={(t) => saveGlobalTask({...t, equipo: team})}
          onClose={() => { setShowGlobalEditor(false); setEditingGlobal(null); }}
          saveToLibrary={false}
        />
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-auto" onClick={() => setPreview(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl my-4" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">{preview.nombre}</h3>
                <p className="text-zinc-400 text-sm">⏱ {preview.minutos} minutos</p>
              </div>
              <Btn small variant="secondary" onClick={() => setPreview(null)}>✕</Btn>
            </div>
            <div className="p-5 space-y-4">
              {preview.descripcion && <p className="text-zinc-300 text-sm whitespace-pre-wrap">{preview.descripcion}</p>}
              {preview.pizarra?.length > 0 && (
                <div>
                  <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Pizarra</label>
                  <Pizarra value={preview.pizarra} onChange={() => {}} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Entrenamientos
// ══════════════════════════════════════════════════════════════════════════════
function EntrenamientosSection({ team, data, onSave, isCoord }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fecha, setFecha] = useState("");
  const [desc, setDesc] = useState("");
  const [attTraining, setAttTraining] = useState(null);
  const [coachAttTraining, setCoachAttTraining] = useState(null);
  const [taskTraining, setTaskTraining] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [duracion, setDuracion] = useState(90);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const setCoachAttRecord = (sessionId, coachId, status, sessionFecha) => {
    const coachAtt = [...(data.coachAttendance || [])].filter(a => !(a.sessionId === sessionId && a.coachId === coachId));
    coachAtt.push({ sessionId, coachId, status, fecha: sessionFecha });
    onSave({ ...data, coachAttendance: coachAtt });
  };

  const delCoachAttRecord = (sessionId, coachId) => {
    const coachAtt = (data.coachAttendance || []).filter(a => !(a.sessionId === sessionId && a.coachId === coachId));
    onSave({ ...data, coachAttendance: coachAtt });
  };

  const coachAttStatusOpts = [
    { val: "present", label: "Asistió", color: "green" },
    { val: "late", label: "Tarde", color: "yellow" },
    { val: "absent", label: "No asistió", color: "red" },
  ];

  const coachAttBtnClass = (recStatus, val, color) => {
    if (recStatus === val) {
      if (color === "green") return "bg-green-800 border-green-600 text-green-200";
      if (color === "yellow") return "bg-yellow-800 border-yellow-600 text-yellow-200";
      return "bg-red-800 border-red-600 text-red-200";
    }
    return "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500";
  };

  const open = (t = null) => {
    setEditing(t);
    setFecha(t ? t.fecha : "");
    setDesc(t ? t.desc : "");
    setDuracion(t ? (t.duracion || 90) : 90);
    setShowForm(true);
  };

  const save = () => {
    if (!fecha) return;
    const trainings = [...(data.trainings || [])];
    if (editing) {
      const idx = trainings.findIndex(t => t.id === editing.id);
      trainings[idx] = { ...editing, fecha, desc, duracion };
    } else {
      trainings.push({ id: Date.now(), fecha, desc, duracion });
    }
    onSave({ ...data, trainings: trainings.sort((a, b) => b.fecha.localeCompare(a.fecha)) });
    setShowForm(false);
  };

  const del = (id) => {
    if (!window.confirm("¿Eliminar entrenamiento?")) return;
    onSave({ ...data, trainings: data.trainings.filter(t => t.id !== id) });
  };

  const setAttRecord = (sessionId, playerId, playerName, status, sessionFecha) => {
    const att = [...(data.attendance || [])].filter(a => !(a.sessionId === sessionId && a.playerId === playerId));
    att.push({ sessionId, playerId, playerName, status, fecha: sessionFecha });
    onSave({ ...data, attendance: att });
  };

  const delAttRecord = (sessionId, playerId) => {
    const att = (data.attendance || []).filter(a => !(a.sessionId === sessionId && a.playerId === playerId));
    onSave({ ...data, attendance: att });
  };

  const statusOpts = [
    { val: "present", label: "Asistió", color: "green" },
    { val: "late", label: "Tarde", color: "yellow" },
    { val: "absent", label: "No asistió", color: "red" },
  ];

  const statusBtnClass = (recStatus, val, color) => {
    if (recStatus === val) {
      if (color === "green") return "bg-green-800 border-green-600 text-green-200";
      if (color === "yellow") return "bg-yellow-800 border-yellow-600 text-yellow-200";
      return "bg-red-800 border-red-600 text-red-200";
    }
    return "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500";
  };

  const saveTaskToTraining = (task, toLib) => {
    const trainings = (data.trainings || []).map(t => {
      if (t.id !== taskTraining.id) return t;
      const tasks = t.tasks || [];
      const idx = tasks.findIndex(x => x.id === task.id);
      const updated = idx >= 0 ? tasks.map(x => x.id === task.id ? task : x) : [...tasks, task];
      return { ...t, tasks: updated };
    });
    const newData = { ...data, trainings };
    if (toLib) {
      const libTask = { ...task, id: Date.now() };
      newData.tasks = [...(data.tasks || []), libTask];
    }
    saveWithFeedback(newData);
    setShowTaskEditor(false);
    setEditingTask(null);
    // update taskTraining reference
    setTaskTraining(trainings.find(t => t.id === taskTraining.id));
  };

  const saveWithFeedback = async (newData) => {
    setSaving(true);
    try {
      await onSave(newData);
      setLastSaved(new Date());
    } catch(e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const moveTask = (trainingId, taskId, direction) => {
    const trainings = (data.trainings || []).map(t => {
      if (t.id !== trainingId) return t;
      const tasks = [...(t.tasks || [])];
      const idx = tasks.findIndex(x => x.id === taskId);
      if (idx === -1) return t;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= tasks.length) return t;
      [tasks[idx], tasks[newIdx]] = [tasks[newIdx], tasks[idx]];
      return { ...t, tasks };
    });
    saveWithFeedback({ ...data, trainings });
    setTaskTraining(trainings.find(t => t.id === trainingId));
  };

  const delTaskFromTraining = (trainingId, taskId) => {
    const trainings = (data.trainings || []).map(t => {
      if (t.id !== trainingId) return t;
      return { ...t, tasks: (t.tasks || []).filter(x => x.id !== taskId) };
    });
    onSave({ ...data, trainings });
    setTaskTraining(trainings.find(t => t.id === trainingId));
  };

  const addFromLibrary = (libTask) => {
    const task = { ...libTask, id: Date.now() };
    const trainings = (data.trainings || []).map(t => {
      if (t.id !== taskTraining.id) return t;
      return { ...t, tasks: [...(t.tasks || []), task] };
    });
    saveWithFeedback({ ...data, trainings });
    setTaskTraining(trainings.find(t => t.id === taskTraining.id));
  };

  const printTraining = (t) => {
    const PLAYER_COLOR_HEX = { red:"#dc2626", yellow:"#eab308", blue:"#2563eb", green:"#16a34a" };
    const W = 500, H = 320;

    const renderFieldSVG = (rawItems, fieldType) => { const items = (rawItems || []).filter(item => item != null && typeof item === 'object');
      const fieldBg = `<rect width="${W}" height="${H}" fill="#2d6a4f"/>`;
  const markings = fieldType === "blank" ? "" : fieldType === "half" ? `
        <rect x="${2*W/100}" y="${2*H/65}" width="${96*W/100}" height="${61*H/65}" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="${28*W/100}" y="${2*H/65}" width="${44*W/100}" height="${18*H/65}" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="${36*W/100}" y="${2*H/65}" width="${28*W/100}" height="${8*H/65}" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="${42*W/100}" y="0" width="${16*W/100}" height="${2*H/65}" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
        <circle cx="${50*W/100}" cy="${14*H/65}" r="4" fill="white" opacity="0.6"/>
        <path d="M ${(50-12)*W/100} ${20*H/65} A ${12*W/100} ${12*H/65} 0 0 0 ${(50+12)*W/100} ${20*H/65}" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
      ` : `
        <rect x="10" y="10" width="480" height="305" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <line x1="250" y1="10" x2="250" y2="315" stroke="white" stroke-width="2" opacity="0.6"/>
        <circle cx="250" cy="162" r="45" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="10" y="90" width="70" height="145" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="10" y="115" width="30" height="85" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="420" y="90" width="70" height="145" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="460" y="115" width="30" height="85" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
      `;
  const getIcon = (type, cx, cy) => {
    if (type==="cono") return `<polygon points="${cx},${cy-7} ${cx-4},${cy+3} ${cx+4},${cy+3}" fill="#f97316"/>`;
    if (type==="cono_amarillo") return `<polygon points="${cx},${cy-7} ${cx-4},${cy+3} ${cx+4},${cy+3}" fill="#eab308"/>`;
    if (type==="cono_rojo") return `<polygon points="${cx},${cy-7} ${cx-4},${cy+3} ${cx+4},${cy+3}" fill="#dc2626"/>`;
    if (type==="cono_azul") return `<polygon points="${cx},${cy-7} ${cx-4},${cy+3} ${cx+4},${cy+3}" fill="#2563eb"/>`;
    if (type==="chino_naranja") return `<polygon points="${cx},${cy-6} ${cx-3},${cy+4} ${cx+3},${cy+4}" fill="#f97316"/><circle cx="${cx}" cy="${cy+4}" r="1.5" fill="#f97316"/>`;
    if (type==="chino_rojo") return `<polygon points="${cx},${cy-6} ${cx-3},${cy+4} ${cx+3},${cy+4}" fill="#dc2626"/><circle cx="${cx}" cy="${cy+4}" r="1.5" fill="#dc2626"/>`;
    if (type==="chino_azul") return `<polygon points="${cx},${cy-6} ${cx-3},${cy+4} ${cx+3},${cy+4}" fill="#2563eb"/><circle cx="${cx}" cy="${cy+4}" r="1.5" fill="#2563eb"/>`;
    if (type==="aro_rojo") return `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#dc2626" stroke-width="2"/>`;
    if (type==="aro_amarillo") return `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#eab308" stroke-width="2"/>`;
    if (type==="aro_verde") return `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#16a34a" stroke-width="2"/>`;
    if (type==="flecha") return "";
    if (type==="flecha_der") return `<line x1="${cx-8}" y1="${cy}" x2="${cx+8}" y2="${cy}" stroke="white" stroke-width="2"/><polygon points="${cx+8},${cy-4} ${cx+14},${cy} ${cx+8},${cy+4}" fill="white"/>`;
    if (type==="flecha_izq") return `<line x1="${cx+8}" y1="${cy}" x2="${cx-8}" y2="${cy}" stroke="white" stroke-width="2"/><polygon points="${cx-8},${cy-4} ${cx-14},${cy} ${cx-8},${cy+4}" fill="white"/>`;
    if (type==="flecha_arr") return `<line x1="${cx}" y1="${cy+8}" x2="${cx}" y2="${cy-8}" stroke="white" stroke-width="2"/><polygon points="${cx-4},${cy-8} ${cx},${cy-14} ${cx+4},${cy-8}" fill="white"/>`;
    if (type==="flecha_abj") return `<line x1="${cx}" y1="${cy-8}" x2="${cx}" y2="${cy+8}" stroke="white" stroke-width="2"/><polygon points="${cx-4},${cy+8} ${cx},${cy+14} ${cx+4},${cy+8}" fill="white"/>`;
    if (type==="flecha_diagr") return `<line x1="${cx-8}" y1="${cy-8}" x2="${cx+8}" y2="${cy+8}" stroke="white" stroke-width="2"/><polygon points="${cx+4},${cy+10} ${cx+10},${cy+4} ${cx+10},${cy+10}" fill="white"/>`;
    if (type==="flecha_diagl") return `<line x1="${cx+8}" y1="${cy-8}" x2="${cx-8}" y2="${cy+8}" stroke="white" stroke-width="2"/><polygon points="${cx-4},${cy+10} ${cx-10},${cy+4} ${cx-10},${cy+10}" fill="white"/>`;
    if (type==="chino") return `<polygon points="${cx},${cy-6} ${cx-3},${cy+4} ${cx+3},${cy+4}" fill="#eab308"/><circle cx="${cx}" cy="${cy+5}" r="1.5" fill="#eab308"/>`;
    if (type==="porteria_grande") return `<rect x="${cx-11}" y="${cy-7}" width="22" height="12" fill="rgba(255,255,255,0.1)" stroke="white" stroke-width="2"/>`;
    if (type==="porteria_pequeña") return `<rect x="${cx-7}" y="${cy-5}" width="14" height="9" fill="rgba(255,255,255,0.1)" stroke="white" stroke-width="2"/>`;
    if (type==="escalera") return `<rect x="${cx-8}" y="${cy-10}" width="16" height="20" fill="none" stroke="#f59e0b" stroke-width="1.5"/><line x1="${cx-8}" y1="${cy-4}" x2="${cx+8}" y2="${cy-4}" stroke="#f59e0b" stroke-width="1.5"/><line x1="${cx-8}" y1="${cy+3}" x2="${cx+8}" y2="${cy+3}" stroke="#f59e0b" stroke-width="1.5"/>`;
    if (type==="pesa") return `<circle cx="${cx-6}" cy="${cy}" r="4" fill="none" stroke="#a78bfa" stroke-width="2"/><circle cx="${cx+6}" cy="${cy}" r="4" fill="none" stroke="#a78bfa" stroke-width="2"/><line x1="${cx-6}" y1="${cy}" x2="${cx+6}" y2="${cy}" stroke="#a78bfa" stroke-width="3"/>`;
    if (type==="pica") return `<line x1="${cx}" y1="${cy-12}" x2="${cx}" y2="${cy+8}" stroke="#ef4444" stroke-width="2"/><polygon points="${cx},${cy-12} ${cx+8},${cy-6} ${cx},${cy-2}" fill="#ef4444"/>`;
    if (type==="aro") return `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#22d3ee" stroke-width="1.5"/>`;
    if (type==="balon") return `<circle cx="${cx}" cy="${cy}" r="6" fill="white" opacity="0.9"/><circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#333" stroke-width="1"/>`;
    if (type==="valla") return `<rect x="${cx-10}" y="${cy-5}" width="20" height="10" fill="none" stroke="#a3e635" stroke-width="2"/>`;
    if (type==="linea_azul") return `<line x1="${cx-12}" y1="${cy}" x2="${cx+12}" y2="${cy}" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>`;
    if (type==="linea_naranja") return `<line x1="${cx-12}" y1="${cy}" x2="${cx+12}" y2="${cy}" stroke="#f97316" stroke-width="3" stroke-linecap="round"/>`;
    if (type==="linea_azul_v") return `<line x1="${cx}" y1="${cy-12}" x2="${cx}" y2="${cy+12}" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>`;
    if (type==="linea_naranja_v") return `<line x1="${cx}" y1="${cy-12}" x2="${cx}" y2="${cy+12}" stroke="#f97316" stroke-width="3" stroke-linecap="round"/>`;
    return `<circle cx="${cx}" cy="${cy}" r="8" fill="#888"/>`;
  };
      const drawingsSVG = (items || []).filter(i => i && i.type === "drawing" && Array.isArray(i.path) && i.path.length > 0).map(item => {
        const points = item.path.map(p => `${(p.x/100)*W},${(p.y/100)*H}`).join(" ");
        return `<polyline points="${points}" fill="none" stroke="${item.color||"#fff"}" stroke-width="${item.size||2}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }).join("");
      const itemsSVG = (items || []).filter(item => item != null && item.type && item.type !== "drawing").map(item => {
        if (item.type === "flecha") {
          const fx1 = (item.x||0)/100*W, fy1 = (item.y||0)/100*H;
          const fx2 = (item.x2||0)/100*W, fy2 = (item.y2||0)/100*H;
          const aid = `a${Math.round(fx1)}${Math.round(fy1)}`;
          return `<defs><marker id="${aid}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="white"/></marker></defs><line x1="${fx1}" y1="${fy1}" x2="${fx2}" y2="${fy2}" stroke="white" stroke-width="2.5" marker-end="url(#${aid})"/>`;
        }
        const cx = (item.x / 100) * W;
        const cy = (item.y / 100) * H;
        if (item.type.startsWith("player_")) {
          const color = item.type.replace("player_", "");
          return `<circle cx="${cx}" cy="${cy}" r="14" fill="${PLAYER_COLOR_HEX[color]}" stroke="white" stroke-width="1.5"/><text x="${cx}" y="${cy+4}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${item.num ?? ""}</text>`;
        }
        return getIcon(item.type, cx, cy);
      }).join("");
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#1a6b2e;border-radius:8px;display:block;margin:8px auto"><rect width="${W}" height="${H}" fill="#1a6b2e"/><g transform="scale(${W/500},${H/325})">${markings}</g>${drawingsSVG}${itemsSVG}</svg>`;
    };

    const totalMin = (t.tasks || []).reduce((s, x) => s + (x.minutos || 0), 0);

    const tasksHTML = (t.tasks || []).map((task, i) => `
      <div style="page-break-inside:avoid;margin-bottom:28px;border:1px solid #ccc;border-radius:8px;overflow:hidden">
        <div style="background:#1e3a5f;color:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;font-size:15px">#${i+1} — ${task.nombre}</span>
          <span style="background:#3b82f6;color:white;padding:3px 12px;border-radius:12px;font-size:12px">⏱ ${task.minutos} min</span>
        </div>
        ${task.descripcion ? `<div style="padding:12px 16px;font-size:13px;color:#333;white-space:pre-wrap;border-bottom:1px solid #eee">${task.descripcion}</div>` : ""}
        ${(task.pizarra?.length > 0) ? `<div style="padding:12px 16px;background:#f0f0f0">${renderFieldSVG(task.pizarra, task.fieldType || "full")}</div>` : `<div style="padding:10px 16px;font-size:12px;color:#999;font-style:italic">Sin pizarra</div>`}
      </div>
    `).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Entrenamiento ${t.fecha} — ${team}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 32px; max-width: 820px; margin: 0 auto; color: #111; }
      h1 { font-size: 22px; margin: 0 0 6px; color: #1a1a1a; }
      .club { font-size: 13px; color: #888; margin-bottom: 4px; }
      .meta { display:flex; gap:16px; font-size:13px; color:#555; margin-bottom:20px; padding-bottom:12px; border-bottom:2px solid #dc2626; }
      .desc-box { background:#f8f8f8; border-left:4px solid #dc2626; padding:12px 16px; border-radius:4px; margin-bottom:28px; font-size:13px; color:#333; white-space:pre-wrap; }
      .section-title { font-size:16px; font-weight:700; color:#1e3a5f; margin-bottom:14px; padding-bottom:4px; border-bottom:1px solid #ddd; }
      .no-tasks { color:#999; font-style:italic; font-size:13px; }
      @media print { body { padding:16px; } button { display:none; } }
    </style></head><body>
    <div class="club">CD La Magdalena — ${team}</div>
    <h1>Entrenamiento del ${t.fecha}</h1>
    <div class="meta">
      <span>🗂 ${(t.tasks||[]).length} tareas</span>
      <span>⏱ ${totalMin} minutos totales</span>
    </div>
    ${t.desc ? `<div class="desc-box">${t.desc}</div>` : ""}
    <div class="section-title">Tareas</div>
    ${(t.tasks||[]).length > 0 ? tasksHTML : '<p class="no-tasks">Sin tareas registradas.</p>'}
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  const players = data.players || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-xl font-bold text-white">Entrenamientos — {team}</h2>
        <Btn onClick={() => open()}>+ Nuevo entrenamiento</Btn>
      </div>

      {showForm && (
        <Card className="border-red-900/50">
          <h3 className="text-sm font-bold text-zinc-300 mb-4">{editing ? "Editar" : "Nuevo entrenamiento"}</h3>
          <div className="space-y-3">
            <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            <Input label="Duración total (min)" type="number" min="1" value={duracion} onChange={e => setDuracion(Number(e.target.value))} />
            <Textarea label="Descripción de la sesión" value={desc} onChange={e => setDesc(e.target.value)} rows={5} />
          </div>
          <div className="flex gap-2 mt-4">
            <Btn onClick={save}>Guardar</Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {(data.trainings || []).map(t => {
          const sessionId = `t_${t.id}`;
          const recs = (data.attendance || []).filter(a => a.sessionId === sessionId);
          const present = recs.filter(r => r.status === "present").length;
          const late = recs.filter(r => r.status === "late").length;
          const absent = recs.filter(r => r.status === "absent").length;
          const totalTaskMin = (t.tasks || []).reduce((s, x) => s + (x.minutos || 0), 0);
          return (
            <Card key={t.id}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-red-400 font-bold text-sm">{t.fecha}</span>
                    <Badge>Entrenamiento</Badge>
                    {t.duracion && <Badge color="zinc">⏱ {t.duracion} min</Badge>}
                    {(t.tasks || []).length > 0 && <Badge color="blue">🗂 {(t.tasks||[]).length} tareas · {totalTaskMin} min</Badge>}
                    {t.duracion > 0 && (t.tasks||[]).length > 0 && (
                      <Badge color={totalTaskMin > t.duracion ? "red" : totalTaskMin === t.duracion ? "green" : "yellow"}>
                        {Math.round((totalTaskMin / t.duracion) * 100)}%
                      </Badge>
                    )}
                    {recs.length > 0 && (
                      <span className="text-xs text-zinc-500">
                        <span className="text-green-400">{present}✓</span>{" "}
                        <span className="text-yellow-400">{late}⏱</span>{" "}
                        <span className="text-red-400">{absent}✗</span>
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{t.desc || <span className="text-zinc-500 italic">Sin descripción</span>}</p>
                </div>
                <div className="flex gap-1 ml-3 shrink-0flex-wrap">
                  <Btn small variant="secondary" onClick={() => setTaskTraining(t)}>🗂 Tareas</Btn>
                  <Btn small variant="primary" onClick={() => setAttTraining(t)}>📋 Jugadores</Btn>
                  {(data.coaches || []).length > 0 && isCoord && <Btn small variant="secondary" onClick={() => setCoachAttTraining(t)}>🧑‍🏫 Entrenadores</Btn>}
                  <Btn small variant="secondary" onClick={() => printTraining(t)}>🖨️ PDF</Btn>
                  <Btn small variant="secondary" onClick={() => open(t)}>✏️</Btn>
                  <Btn small variant="danger" onClick={() => del(t.id)}>🗑️</Btn>
                </div>
              </div>
            </Card>
          );
        })}
        {(data.trainings || []).length === 0 && <p className="text-zinc-500 text-sm">No hay entrenamientos registrados.</p>}
      </div>

      {/* Tasks panel modal */}
      {taskTraining && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-auto" onClick={() => { setTaskTraining(null); setShowTaskEditor(false); }}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl my-4" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">Tareas del entrenamiento</h3>
                <p className="text-zinc-400 text-sm">{taskTraining.fecha}</p>
              </div>
              <div className="flex items-center gap-2">
                {saving && <span className="text-zinc-400 text-xs">💾 Guardando...</span>}
                {lastSaved && !saving && <span className="text-green-400 text-xs">✓ Guardado</span>}
                <Btn small variant="secondary" onClick={() => { setTaskTraining(null); setShowTaskEditor(false); }}>✕</Btn>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {/* Progress bar */}
              {taskTraining.duracion > 0 && (() => {
                const used = (taskTraining.tasks||[]).reduce((s,x)=>s+(x.minutos||0),0);
                const pct = Math.min(100, Math.round((used / taskTraining.duracion) * 100));
                const over = used > taskTraining.duracion;
                const done = used === taskTraining.duracion;
                const color = over ? "bg-red-500" : done ? "bg-green-500" : "bg-yellow-500";
                const textColor = over ? "text-red-400" : done ? "text-green-400" : "text-yellow-400";
                return (
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-zinc-400">Tiempo planificado</span>
                      <span className={`text-sm font-bold ${textColor}`}>{used} / {taskTraining.duracion} min</span>
                    </div>
                    <div className="w-full bg-zinc-700 rounded-full h-3">
                      <div className={`${color} h-3 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 mt-1">
                      <span>0 min</span>
                      <span className={`font-bold ${textColor}`}>{pct}%</span>
                      <span>{taskTraining.duracion} min</span>
                    </div>
                    {over && <p className="text-red-400 text-xs mt-1">⚠️ Te pasas {used - taskTraining.duracion} min del tiempo planificado</p>}
                    {done && <p className="text-green-400 text-xs mt-1">✅ Entrenamiento completo</p>}
                  </div>
                );
              })()}
              <div className="flex gap-2 flex-wrap">
                <Btn small onClick={() => { setEditingTask(null); setShowTaskEditor(true); }}>+ Nueva tarea</Btn>
                {(data.tasks || []).length > 0 && (
                  <div className="flex-1">
                    <select
                      className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1 text-zinc-100 text-xs w-full focus:outline-none focus:border-red-600"
                      defaultValue=""
                      onChange={e => {
                        const lib = (data.tasks || []).find(t => t.id === Number(e.target.value));
                        if (lib) addFromLibrary(lib);
                        e.target.value = "";
                      }}
                    >
                      <option value="">📚 Añadir desde biblioteca...</option>
                      {(data.tasks || []).map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.minutos} min)</option>)}
                    </select>
                  </div>
                )}
              </div>
              {(taskTraining.tasks || []).length === 0 && <p className="text-zinc-500 text-sm">No hay tareas. Crea una o añade desde la biblioteca.</p>}
              {(taskTraining.tasks || []).map((task, i) => (
                <div key={task.id} className="bg-zinc-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-zinc-500 text-xs font-bold">#{i+1}</span>
                        <span className="text-white font-semibold">{task.nombre}</span>
                        <Badge color="blue">⏱ {task.minutos} min</Badge>
                      </div>
                      {task.descripcion && <p className="text-zinc-400 text-sm">{task.descripcion}</p>}
                      {task.pizarra?.length > 0 && <p className="text-zinc-600 text-xs mt-1">🎨 Pizarra con {task.pizarra.length} elementos</p>}
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <Btn small variant="secondary" onClick={() => { setEditingTask(task); setShowTaskEditor(true); }}>✏️</Btn>
                      <Btn small variant="secondary" onClick={() => moveTask(taskTraining.id, task.id, "up")} disabled={i===0}>↑</Btn>
                      <Btn small variant="secondary" onClick={() => moveTask(taskTraining.id, task.id, "down")} disabled={i===(taskTraining.tasks||[]).length-1}>↓</Btn>
                      <Btn small variant="danger" onClick={() => delTaskFromTraining(taskTraining.id, task.id)}>🗑️</Btn>
                    </div>
                  </div>
                </div>
              ))}
              {(taskTraining.tasks || []).length > 0 && (
                <p className="text-zinc-500 text-xs text-right">Total: {(taskTraining.tasks||[]).reduce((s,x)=>s+(x.minutos||0),0)} minutos</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Coach attendance modal */}
      {coachAttTraining && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setCoachAttTraining(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">🧑‍🏫 Asistencia entrenadores</h3>
                <p className="text-zinc-400 text-sm">{coachAttTraining.fecha}</p>
              </div>
              <Btn small variant="secondary" onClick={() => setCoachAttTraining(null)}>✕</Btn>
            </div>
            <div className="p-5 space-y-2">
              {(data.coaches || []).length === 0 && <p className="text-zinc-500 text-sm">No hay entrenadores registrados en este equipo.</p>}
              {(data.coaches || []).map(c => {
                const sessionId = `t_${coachAttTraining.id}`;
                const rec = (data.coachAttendance || []).find(a => a.sessionId === sessionId && a.coachId === c.id);
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-white text-sm font-semibold flex-1">{c.name}</span>
                    <div className="flex gap-1">
                      {coachAttStatusOpts.map(opt => (
                        <button key={opt.val}
                          onClick={() => setCoachAttRecord(sessionId, c.id, opt.val, coachAttTraining.fecha)}
                          className={`text-xs px-2 py-1 rounded border transition-all ${coachAttBtnClass(rec?.status, opt.val, opt.color)}`}
                        >{opt.label}</button>
                      ))}
                      {rec && <Btn small variant="danger" onClick={() => delCoachAttRecord(sessionId, c.id)}>✕</Btn>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showTaskEditor && taskTraining && (
        <TaskEditorModal
          task={editingTask}
          onSave={saveTaskToTraining}
          onClose={() => { setShowTaskEditor(false); setEditingTask(null); }}
          saveToLibrary={true}
        />
      )}

      {/* Attendance modal */}
      {attTraining && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setAttTraining(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">Asistencia</h3>
                <p className="text-zinc-400 text-sm">{attTraining.fecha} — {attTraining.desc || "Sin descripción"}</p>
              </div>
              <Btn small variant="secondary" onClick={() => setAttTraining(null)}>✕</Btn>
            </div>
            <div className="p-5 space-y-2">
              {players.length === 0 && <p className="text-zinc-500 text-sm">No hay jugadores en la plantilla.</p>}
              {players.map(p => {
                const sessionId = `t_${attTraining.id}`;
                const rec = (data.attendance || []).find(a => a.sessionId === sessionId && a.playerId === p.id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-white text-sm font-semibold flex-1">{p.name}</span>
                    <div className="flex gap-1">
                      {statusOpts.map(opt => (
                        <button
                          key={opt.val}
                          onClick={() => setAttRecord(`t_${attTraining.id}`, p.id, p.name, opt.val, attTraining.fecha)}
                          className={`text-xs px-2 py-1 rounded border transition-all ${statusBtnClass(rec?.status, opt.val, opt.color)}`}
                        >{opt.label}</button>
                      ))}
                      {rec && (
                        <Btn small variant="danger" onClick={() => delAttRecord(`t_${attTraining.id}`, p.id)}>✕</Btn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Partidos
// ══════════════════════════════════════════════════════════════════════════════
function PartidosSection({ team, data, onSave, isCoord }) {
  const [view, setView] = useState("list"); // list | form | detail
  const [editing, setEditing] = useState(null);
  const [activeMatch, setActiveMatch] = useState(null);
  const [attMatch, setAttMatch] = useState(null);
  const [coachAttMatch, setCoachAttMatch] = useState(null);

  const coachAttStatusOpts = [
    { val: "present", label: "Asistió", color: "green" },
    { val: "late", label: "Tarde", color: "yellow" },
    { val: "absent", label: "No asistió", color: "red" },
  ];

  const coachAttBtnClass = (recStatus, val, color) => {
    if (recStatus === val) {
      if (color === "green") return "bg-green-800 border-green-600 text-green-200";
      if (color === "yellow") return "bg-yellow-800 border-yellow-600 text-yellow-200";
      return "bg-red-800 border-red-600 text-red-200";
    }
    return "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500";
  };

  const setCoachAttRecord = (sessionId, coachId, status, fecha) => {
    const coachAtt = [...(data.coachAttendance || [])].filter(a => !(a.sessionId === sessionId && a.coachId === coachId));
    coachAtt.push({ sessionId, coachId, status, fecha });
    onSave({ ...data, coachAttendance: coachAtt });
  };

  const delCoachAttRecord = (sessionId, coachId) => {
    const coachAtt = (data.coachAttendance || []).filter(a => !(a.sessionId === sessionId && a.coachId === coachId));
    onSave({ ...data, coachAttendance: coachAtt });
  };

  // Match form state
  const [rival, setRival] = useState("");
  const [lugar, setLugar] = useState("");
  const [fecha, setFecha] = useState("");
  const [golesLocal, setGolesLocal] = useState("");
  const [golesVisitante, setGolesVisitante] = useState("");
  const [rivales, setRivales] = useState([{num:"",nombre:""},{num:"",nombre:""}]);

  const setAttRecord = (sessionId, playerId, playerName, status, sessionFecha) => {
    const att = [...(data.attendance || [])].filter(a => !(a.sessionId === sessionId && a.playerId === playerId));
    att.push({ sessionId, playerId, playerName, status, fecha: sessionFecha });
    onSave({ ...data, attendance: att });
  };

  const delAttRecord = (sessionId, playerId) => {
    const att = (data.attendance || []).filter(a => !(a.sessionId === sessionId && a.playerId === playerId));
    onSave({ ...data, attendance: att });
  };

  const attStatusOpts = [
    { val: "present", label: "Asistió", color: "green" },
    { val: "late", label: "Tarde", color: "yellow" },
    { val: "absent", label: "No asistió", color: "red" },
  ];

  const attStatusBtnClass = (recStatus, val, color) => {
    if (recStatus === val) {
      if (color === "green") return "bg-green-800 border-green-600 text-green-200";
      if (color === "yellow") return "bg-yellow-800 border-yellow-600 text-yellow-200";
      return "bg-red-800 border-red-600 text-red-200";
    }
    return "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500";
  };

  const openForm = (m = null) => {
    setEditing(m);
    setRival(m ? m.rival : "");
    setLugar(m ? m.lugar : "");
    setFecha(m ? m.fecha : "");
    if (m?.resultado) {
      const parts = m.resultado.split("-");
      setGolesLocal(parts[0]?.trim() || "");
      setGolesVisitante(parts[1]?.trim() || "");
    } else {
      setGolesLocal(""); setGolesVisitante("");
    }
    setRivales(m?.mejoresRivales || [{num:"",nombre:""},{num:"",nombre:""}]);
    setView("form");
  };

  const saveMatch = () => {
    if (!rival) return;
    const resultado = golesLocal !== "" && golesVisitante !== "" ? `${golesLocal}-${golesVisitante}` : "";
    const matches = [...(data.matches || [])];
    if (editing) {
      const idx = matches.findIndex(m => m.id === editing.id);
      matches[idx] = { ...editing, rival, lugar, fecha, resultado, mejoresRivales: rivales };
    } else {
      const players = data.players || [];
      const convocatoria = players.map(p => ({
        playerId: p.id, playerName: p.name,
        status: "no_conv", minutos: 0, goles: 0, asistencias: 0, nota: ""
      }));
      matches.push({ id: Date.now(), rival, lugar, fecha, resultado, convocatoria, capitan: null, formacion: [], mejoresRivales: rivales });
    }
    onSave({ ...data, matches: matches.sort((a, b) => b.fecha.localeCompare(a.fecha)) });
    setView("list");
  };

  const delMatch = (id) => {
    if (!window.confirm("¿Eliminar partido?")) return;
    onSave({ ...data, matches: data.matches.filter(m => m.id !== id) });
  };

  const openDetail = (m) => { setActiveMatch(m); setView("detail"); };

  const updateConv = (matchId, playerId, field, value) => {
    const matches = (data.matches || []).map(m => {
      if (m.id !== matchId) return m;
      return {
        ...m,
        convocatoria: m.convocatoria.map(c =>
          c.playerId === playerId ? { ...c, [field]: value } : c
        )
      };
    });
    const updated = matches.find(m => m.id === matchId);
    setActiveMatch(updated);
    onSave({ ...data, matches });
  };

  // Sync new players into existing matches
  useEffect(() => {
    const matches = data.matches || [];
    const players = data.players || [];
    let changed = false;
    const newMatches = matches.map(m => {
      const conv = m.convocatoria || [];
      const newEntries = players
        .filter(p => !conv.find(c => c.playerId === p.id))
        .map(p => ({ playerId: p.id, playerName: p.name, status: "no_conv", minutos: 0, goles: 0, asistencias: 0, nota: "" }));
      if (newEntries.length) { changed = true; return { ...m, convocatoria: [...conv, ...newEntries] }; }
      return m;
    });
    if (changed) onSave({ ...data, matches: newMatches });
  }, [data.players?.length]);

  const statusColor = { titular: "green", suplente: "blue", no_conv: "zinc" };
  useEffect(() => { if (!isCoord) return; loadFichas(team).then(setFichas); }, [team]);

  const statusLabel = { titular: "Titular", suplente: "Suplente", no_conv: "No conv." };

  if (view === "form") return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Btn variant="ghost" onClick={() => setView("list")}>← Volver</Btn>
        <h2 className="text-xl font-bold text-white">{editing ? "Editar partido" : "Nuevo partido"}</h2>
      </div>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Rival" value={rival} onChange={e => setRival(e.target.value)} />
          <Input label="Lugar" value={lugar} onChange={e => setLugar(e.target.value)} />
          <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400 uppercase tracking-wider">Resultado</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" value={golesLocal}
                onChange={e => setGolesLocal(e.target.value)}
                placeholder="0"
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full text-center font-bold text-lg"
              />
              <span className="text-white font-black text-xl shrink-0">—</span>
              <input
                type="number" min="0" value={golesVisitante}
                onChange={e => setGolesVisitante(e.target.value)}
                placeholder="0"
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full text-center font-bold text-lg"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Btn onClick={saveMatch}>Guardar partido</Btn>
          <Btn variant="secondary" onClick={() => setView("list")}>Cancelar</Btn>
        </div>
      </Card>
      <Card>
        <p className="text-white font-semibold mb-1">⭐ Mejores jugadores rivales</p>
        <p className="text-zinc-400 text-sm mb-3">Los dos jugadores más destacados del equipo rival.</p>
        <div className="space-y-3">
          {[0,1].map(i => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-zinc-400 text-sm w-4">{i+1}.</span>
              <input type="number" min="1" max="99" placeholder="Nº" value={rivales[i]?.num||""} onChange={e => setRivales(prev => prev.map((x,j)=>j===i?{...x,num:e.target.value}:x))} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-16 text-center"/>
              <input type="text" placeholder="Nombre y apellidos" value={rivales[i]?.nombre||""} onChange={e => setRivales(prev => prev.map((x,j)=>j===i?{...x,nombre:e.target.value}:x))} className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 flex-1"/>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  if (view === "detail" && activeMatch) {
    const match = (data.matches || []).find(m => m.id === activeMatch.id) || activeMatch;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={() => setView("list")}>← Volver</Btn>
          <h2 className="text-xl font-bold text-white">vs {match.rival}</h2>
        </div>
        <Card>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>📅 {match.fecha}</span>
            <span>📍 {match.lugar}</span>
            {match.resultado && <span className="text-white font-bold">⚽ {match.resultado}</span>}
            {match.capitan && (() => { const cap = (match.convocatoria||[]).find(c=>c.playerId===match.capitan); return cap ? <span className="text-yellow-400">⭐ {cap.playerName}</span> : null; })()}
          </div>
        </Card>

        <div className="space-y-2">

          {(match.convocatoria || []).map(c => (
            <Card key={c.playerId} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white font-semibold flex-1">{c.playerName}</span>
                {["titular", "suplente", "no_conv"].map(s => (
                  <button
                    key={s}
                    onClick={() => updateConv(match.id, c.playerId, "status", s)}
                    className={`text-xs px-2 py-1 rounded border transition-all ${
                      c.status === s
                        ? s === "titular" ? "bg-green-800 border-green-600 text-green-200"
                        : s === "suplente" ? "bg-blue-800 border-blue-600 text-blue-200"
                        : "bg-zinc-700 border-zinc-500 text-zinc-300"
                        : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    }`}
                  >{statusLabel[s]}</button>
                ))}
                <button
                  onClick={() => {
                    const matches2 = (data.matches||[]).map(m2 => m2.id !== match.id ? m2 : {...m2, capitan: m2.capitan === c.playerId ? null : c.playerId});
                    const upd = matches2.find(m2=>m2.id===match.id);
                    setActiveMatch(upd);
                    onSave({...data, matches: matches2});
                  }}
                  className={`text-xs px-2 py-1 rounded border transition-all ${match.capitan===c.playerId ? "bg-yellow-700 border-yellow-500 text-yellow-200" : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}
                  title="Capitán"
                >⭐ Capitán</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input label="Minutos" type="number" value={c.minutos} onChange={e => updateConv(match.id, c.playerId, "minutos", Number(e.target.value))} />
                <Input label="Goles" type="number" value={c.goles} onChange={e => updateConv(match.id, c.playerId, "goles", Number(e.target.value))} />
                <Input label="Asistencias" type="number" value={c.asistencias} onChange={e => updateConv(match.id, c.playerId, "asistencias", Number(e.target.value))} />
                <Input label="Nota (0-10)" type="number" step="0.01" min="0" max="10" value={c.nota} onChange={e => updateConv(match.id, c.playerId, "nota", e.target.value)} />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Partidos — {team}</h2>
        <Btn onClick={() => openForm()}>+ Nuevo partido</Btn>
      </div>

      {/* Season classification */}
      {(data.matches || []).length > 0 && (() => {
        const parseResult = (r) => {
          if (!r) return null;
          const p = r.split("-").map(n => parseInt(n.trim()));
          return (p.length === 2 && !p.some(isNaN)) ? p : null;
        };
        const stats = (data.matches || []).reduce((acc, m) => {
          const p = parseResult(m.resultado);
          if (!p) return acc;
          const [gf, gc] = p;
          acc.pj++; acc.gf += gf; acc.gc += gc;
          if (gf > gc) { acc.v++; acc.pts += 3; }
          else if (gf === gc) { acc.e++; acc.pts += 1; }
          else acc.d++;
          return acc;
        }, { pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0, pts: 0 });

        return (
          <Card className="border-zinc-700">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Clasificación de temporada</p>
            <div className="grid grid-cols-4 gap-2 text-center mb-3">
              <div>
                <div className="text-2xl font-black text-white">{stats.pts}</div>
                <div className="text-xs text-zinc-500">Puntos</div>
              </div>
              <div>
                <div className="text-2xl font-black text-green-400">{stats.v}</div>
                <div className="text-xs text-zinc-500">V</div>
              </div>
              <div>
                <div className="text-2xl font-black text-yellow-400">{stats.e}</div>
                <div className="text-xs text-zinc-500">E</div>
              </div>
              <div>
                <div className="text-2xl font-black text-red-400">{stats.d}</div>
                <div className="text-xs text-zinc-500">D</div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-zinc-400 border-t border-zinc-800 pt-2">
              <span>PJ: {stats.pj}</span>
              <span>GF: {stats.gf}</span>
              <span>GC: {stats.gc}</span>
              <span>DG: {stats.gf - stats.gc > 0 ? "+" : ""}{stats.gf - stats.gc}</span>
            </div>
            {/* Points bar */}
            <div className="mt-3 flex h-2 rounded-full overflow-hidden gap-0.5">
              {stats.v > 0 && <div className="bg-green-500" style={{ flex: stats.v }} />}
              {stats.e > 0 && <div className="bg-yellow-500" style={{ flex: stats.e }} />}
              {stats.d > 0 && <div className="bg-red-600" style={{ flex: stats.d }} />}
            </div>
          </Card>
        );
      })()}

      <div className="space-y-3">
        {(data.matches || []).map(m => (
          <Card key={m.id} className="hover:border-zinc-600 transition-colors cursor-pointer" onClick={() => openDetail(m)}>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-bold">vs {m.rival}</span>
                  {m.resultado && <Badge color="green">{m.resultado}</Badge>}
                </div>
                <div className="flex gap-3 text-xs text-zinc-400">
                  <span>📅 {m.fecha}</span>
                  <span>📍 {m.lugar}</span>
                </div>
              </div>
              <div className="flex gap-1 ml-3" onClick={e => e.stopPropagation()}>
                <Btn small variant="primary" onClick={() => openDetail(m)}>⭐ Valorar</Btn>
                <Btn small variant="secondary" onClick={() => { setAttMatch(m); }}>📋 Jugadores</Btn>
                {(data.coaches || []).length > 0 && isCoord && <Btn small variant="secondary" onClick={() => setCoachAttMatch(m)}>🧑‍🏫 Entrenadores</Btn>}
                <Btn small variant="secondary" onClick={() => openForm(m)}>✏️</Btn>
                <Btn small variant="danger" onClick={() => delMatch(m.id)}>🗑️</Btn>
              </div>
            </div>
          </Card>
        ))}
        {(data.matches || []).length === 0 && <p className="text-zinc-500 text-sm">No hay partidos registrados.</p>}
      </div>

      {/* Attendance modal */}
      {attMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setAttMatch(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">Asistencia</h3>
                <p className="text-zinc-400 text-sm">{attMatch.fecha} — vs {attMatch.rival}</p>
              </div>
              <Btn small variant="secondary" onClick={() => setAttMatch(null)}>✕</Btn>
            </div>
            <div className="p-5 space-y-2">
              {(data.players || []).length === 0 && <p className="text-zinc-500 text-sm">No hay jugadores en la plantilla.</p>}
              {(data.players || []).map(p => {
                const sessionId = `m_${attMatch.id}`;
                const rec = (data.attendance || []).find(a => a.sessionId === sessionId && a.playerId === p.id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-white text-sm font-semibold flex-1">{p.name}</span>
                    <div className="flex gap-1">
                      {attStatusOpts.map(opt => (
                        <button
                          key={opt.val}
                          onClick={() => setAttRecord(sessionId, p.id, p.name, opt.val, attMatch.fecha)}
                          className={`text-xs px-2 py-1 rounded border transition-all ${attStatusBtnClass(rec?.status, opt.val, opt.color)}`}
                        >{opt.label}</button>
                      ))}
                      {rec && <Btn small variant="danger" onClick={() => delAttRecord(sessionId, p.id)}>✕</Btn>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Coach attendance modal */}
      {coachAttMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setCoachAttMatch(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">🧑‍🏫 Asistencia entrenadores</h3>
                <p className="text-zinc-400 text-sm">{coachAttMatch.fecha} — vs {coachAttMatch.rival}</p>
              </div>
              <Btn small variant="secondary" onClick={() => setCoachAttMatch(null)}>✕</Btn>
            </div>
            <div className="p-5 space-y-3">
              {(data.coaches || []).length === 0 && <p className="text-zinc-500 text-sm">No hay entrenadores registrados.</p>}
              {(() => {
                const sessionId = `m_${coachAttMatch.id}`;
                const valorados = (data.coachAttendance || []).filter(a => a.sessionId === sessionId);
                const coachesConVal = (data.coaches || []).filter(c => valorados.find(a => a.coachId === c.id));
                const coachesSinVal = (data.coaches || []).filter(c => !valorados.find(a => a.coachId === c.id));
                return <>
                  {coachesConVal.map(c => {
                    const rec = valorados.find(a => a.coachId === c.id);
                    return (
                      <div key={c.id} className="flex flex-wrap items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
                        <span className="text-white text-sm font-semibold flex-1">{c.name}</span>
                        <div className="flex gap-1">
                          {coachAttStatusOpts.map(opt => (
                            <button key={opt.val}
                              onClick={() => setCoachAttRecord(sessionId, c.id, opt.val, coachAttMatch.fecha)}
                              className={`text-xs px-2 py-1 rounded border transition-all ${coachAttBtnClass(rec?.status, opt.val, opt.color)}`}
                            >{opt.label}</button>
                          ))}
                          <Btn small variant="danger" onClick={() => delCoachAttRecord(sessionId, c.id)}>✕</Btn>
                        </div>
                      </div>
                    );
                  })}
                  {coachesSinVal.length > 0 && (
                    <div className="border-t border-zinc-700 pt-3">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Añadir valoración</p>
                      <div className="flex flex-wrap gap-2">
                        {coachesSinVal.map(c => (
                          <button key={c.id}
                            onClick={() => setCoachAttRecord(sessionId, c.id, "present", coachAttMatch.fecha)}
                            className="px-3 py-1.5 bg-zinc-800 border border-zinc-600 text-zinc-300 text-xs rounded hover:border-zinc-400 transition-all"
                          >➕ {c.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {coachesConVal.length === 0 && coachesSinVal.length > 0 && (
                    <p className="text-zinc-500 text-sm">Ninguna valoración añadida. Usa los botones de abajo para añadir.</p>
                  )}
                </>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Asistencia
// ══════════════════════════════════════════════════════════════════════════════
function AsistenciaSection({ team, data, onSave, isCoord }) {
  const [activePlayer, setActivePlayer] = useState(null);
  const [searchDate, setSearchDate] = useState("");

  const sessions = [
    ...(data.trainings || []).map(t => ({ id: `t_${t.id}`, fecha: t.fecha, tipo: "Entrenamiento", desc: t.desc })),
    ...(data.matches || []).map(m => ({ id: `m_${m.id}`, fecha: m.fecha, tipo: "Partido", desc: `vs ${m.rival}` }))
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const setRecord = (sessionId, playerId, playerName, status) => {
    const fecha = sessions.find(s => s.id === sessionId)?.fecha;
    const att = [...(data.attendance || [])].filter(a => !(a.sessionId === sessionId && a.playerId === playerId));
    att.push({ sessionId, playerId, playerName, status, fecha });
    onSave({ ...data, attendance: att });
  };

  const delRecord = (sessionId, playerId) => {
    const att = (data.attendance || []).filter(a => !(a.sessionId === sessionId && a.playerId === playerId));
    onSave({ ...data, attendance: att });
  };

  const getPlayerStats = (playerId) => {
    const records = (data.attendance || []).filter(a => a.playerId === playerId);
    return {
      present: records.filter(r => r.status === "present").length,
      late: records.filter(r => r.status === "late").length,
      absent: records.filter(r => r.status === "absent").length,
    };
  };

  const statusOpts = [
    { val: "present", label: "Asistió", color: "green" },
    { val: "late", label: "Tarde", color: "yellow" },
    { val: "absent", label: "No asistió", color: "red" },
  ];

  const statusBtnClass = (recStatus, val, color) => {
    if (recStatus === val) {
      if (color === "green") return "bg-green-800 border-green-600 text-green-200";
      if (color === "yellow") return "bg-yellow-800 border-yellow-600 text-yellow-200";
      return "bg-red-800 border-red-600 text-red-200";
    }
    return "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500";
  };

  const players = data.players || [];

  // ── Player detail view ──────────────────────────────────────────────────────
  if (activePlayer) {
    const p = activePlayer;
    const stats = getPlayerStats(p.id);
    const filteredSessions = searchDate ? sessions.filter(s => s.fecha.includes(searchDate)) : sessions;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={() => { setActivePlayer(null); setSearchDate(""); }}>← Volver</Btn>
          <h2 className="text-xl font-bold text-white">{p.name}</h2>
        </div>

        {/* Stats chart */}
        <Card>
          <div className="flex gap-6 mb-3">
            <div className="text-center">
              <div className="text-2xl font-black text-green-400">{stats.present}</div>
              <div className="text-xs text-zinc-500">Asistió</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-yellow-400">{stats.late}</div>
              <div className="text-xs text-zinc-500">Tarde</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-red-400">{stats.absent}</div>
              <div className="text-xs text-zinc-500">No asistió</div>
            </div>
          </div>
          <AttendanceChart {...stats} />
        </Card>

        {/* Session history */}
        <Input label="Buscar sesión por fecha" value={searchDate} onChange={e => setSearchDate(e.target.value)} placeholder="2024-10" />
        <div className="space-y-2">
          {filteredSessions.map(s => {
            const rec = (data.attendance || []).find(a => a.sessionId === s.id && a.playerId === p.id);
            return (
              <Card key={s.id} className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">{s.fecha}</span>
                    <Badge color={s.tipo === "Partido" ? "red" : "blue"}>{s.tipo === "Partido" ? "⚽ Partido" : "🏃 Entrenamiento"}</Badge>
                    <span className="text-zinc-400 text-xs truncate">{s.desc}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {statusOpts.map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setRecord(s.id, p.id, p.name, opt.val)}
                      className={`text-xs px-2 py-1 rounded border transition-all ${statusBtnClass(rec?.status, opt.val, opt.color)}`}
                    >{opt.label}</button>
                  ))}
                  {rec && (
                    <Btn small variant="danger" onClick={() => delRecord(s.id, p.id)}>✕</Btn>
                  )}
                </div>
              </Card>
            );
          })}
          {filteredSessions.length === 0 && <p className="text-zinc-500 text-sm">No hay sesiones registradas.</p>}
        </div>
      </div>
    );
  }

  // ── Player list view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Asistencia — {team}</h2>
      <p className="text-zinc-500 text-sm">Selecciona un jugador para ver y registrar su asistencia.</p>
      <div className="space-y-2">
        {[...players].sort((a, b) => {
          const sa = getPlayerStats(a.id);
          const sb = getPlayerStats(b.id);
          if (sb.present !== sa.present) return sb.present - sa.present;
          if (sb.late !== sa.late) return sb.late - sa.late;
          return sa.absent - sb.absent;
        }).map(p => {
          const stats = getPlayerStats(p.id);
          const total = stats.present + stats.late + stats.absent;
          return (
            <Card
              key={p.id}
              className="hover:border-zinc-600 transition-colors cursor-pointer"
              onClick={() => setActivePlayer(p)}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <span className="text-white font-semibold">{p.name}</span>
                  {total > 0 && (
                    <div className="mt-2">
                      <AttendanceChart {...stats} />
                    </div>
                  )}
                  {total === 0 && <p className="text-zinc-600 text-xs mt-1">Sin registros todavía</p>}
                </div>
                <div className="flex gap-3 text-xs shrink-0">
                  <span className="text-green-400 font-bold">{stats.present}✓</span>
                  <span className="text-yellow-400 font-bold">{stats.late}⏱</span>
                  <span className="text-red-400 font-bold">{stats.absent}✗</span>
                  <span className="text-zinc-500">→</span>
                </div>
              </div>
            </Card>
          );
        })}
        {players.length === 0 && <p className="text-zinc-500 text-sm">No hay jugadores en la plantilla.</p>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Tácticas Animadas
// ══════════════════════════════════════════════════════════════════════════════
function TacticasSection({ team, data, onSave }) {
  const tacticas = data.tacticas || [];
  const [view, setView] = useState("lista"); // "lista" | "editor"
  const [editando, setEditando] = useState(null);

  const nuevaTactica = () => {
    setEditando({
      id: Date.now(),
      nombre: "Nueva táctica",
      jugadores: [
        { id: 1, num: 1, x: 50, y: 88, color: "#ef4444" },
        { id: 2, num: 2, x: 20, y: 72, color: "#ef4444" },
        { id: 3, num: 3, x: 35, y: 72, color: "#ef4444" },
        { id: 4, num: 4, x: 65, y: 72, color: "#ef4444" },
        { id: 5, num: 5, x: 80, y: 72, color: "#ef4444" },
        { id: 6, num: 6, x: 30, y: 55, color: "#ef4444" },
        { id: 7, num: 7, x: 50, y: 52, color: "#ef4444" },
        { id: 8, num: 8, x: 70, y: 55, color: "#ef4444" },
        { id: 9, num: 9, x: 25, y: 35, color: "#ef4444" },
        { id: 10, num: 10, x: 50, y: 30, color: "#ef4444" },
        { id: 11, num: 11, x: 75, y: 35, color: "#ef4444" },
      ],
      keyframes: [], // [{id, duracion, jugadores: [{...j, activo}]}]
    });
    setView("editor");
  };

  const guardarTactica = (t) => {
    const existe = tacticas.find(x => x.id === t.id);
    const nuevas = existe
      ? tacticas.map(x => x.id === t.id ? t : x)
      : [...tacticas, t];
    onSave({ ...data, tacticas: nuevas });
    setView("lista");
    setEditando(null);
  };

  const eliminarTactica = (id) => {
    if (!window.confirm("¿Eliminar esta táctica?")) return;
    onSave({ ...data, tacticas: tacticas.filter(t => t.id !== id) });
  };

  const abrirEditor = (t) => {
    setEditando(JSON.parse(JSON.stringify(t))); // copia profunda
    setView("editor");
  };

  if (view === "editor" && editando) {
    return (
      <TacticaEditor
        tactica={editando}
        onGuardar={guardarTactica}
        onCancelar={() => { setView("lista"); setEditando(null); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">🎬 Tácticas Animadas</h2>
        <Btn onClick={nuevaTactica}>+ Nueva táctica</Btn>
      </div>

      {tacticas.length === 0 && (
        <Card>
          <p className="text-zinc-400 text-center py-6">
            No hay tácticas guardadas. Crea una nueva para empezar.
          </p>
        </Card>
      )}

      {tacticas.map(t => (
        <Card key={t.id} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-white font-semibold">{t.nombre}</p>
            <p className="text-zinc-500 text-sm">
              {t.jugadores?.length || 11} jugadores
              {t.keyframes?.length > 0 ? ` · ${t.keyframes.length} paso${t.keyframes.length > 1 ? "s" : ""}` : " · sin animación"}
            </p>
          </div>
          <div className="flex gap-2">
            <Btn small onClick={() => abrirEditor(t)}>✏️ Editar</Btn>
            <Btn small variant="danger" onClick={() => eliminarTactica(t.id)}>🗑️</Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Funciones de dibujo (fuera del componente para evitar re-renders) ─────────
const FIELD_W = 400;
const FIELD_H = 560;

function dibujarCampo(ctx) {
  ctx.fillStyle = "#2d6a2d";
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 20, FIELD_W - 40, FIELD_H - 40);
  ctx.beginPath(); ctx.moveTo(20, FIELD_H / 2); ctx.lineTo(FIELD_W - 20, FIELD_H / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(FIELD_W / 2, FIELD_H / 2, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(FIELD_W / 2, FIELD_H / 2, 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fill();
  const fw = FIELD_W - 40; const fh = FIELD_H - 40;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.strokeRect(20 + fw * 0.15, 20, fw * 0.7, fh * 0.2);
  ctx.strokeRect(20 + fw * 0.3, 20, fw * 0.4, fh * 0.1);
  ctx.strokeRect(20 + fw * 0.15, FIELD_H - 20 - fh * 0.2, fw * 0.7, fh * 0.2);
  ctx.strokeRect(20 + fw * 0.3, FIELD_H - 20 - fh * 0.1, fw * 0.4, fh * 0.1);
  ctx.strokeRect(20 + fw * 0.38, 14, fw * 0.24, 6);
  ctx.strokeRect(20 + fw * 0.38, FIELD_H - 20, fw * 0.24, 6);
}

function dibujarJugadores(ctx, jugs) {
  jugs.forEach(j => {
    const px = (j.x / 100) * FIELD_W;
    const py = (j.y / 100) * FIELD_H;
    const inactivo = j.activo === false;
    const colorFondo = inactivo ? "#3f3f46" : (j.color || "#ef4444");
    // El número debe ser negro si el fondo es blanco o muy claro
    const colorTexto = (!inactivo && (j.color === "#ffffff" || j.color === "#fff")) ? "#111" : (inactivo ? "#a1a1aa" : "white");

    // Establecer globalAlpha ANTES de dibujar cualquier cosa de este jugador
    ctx.globalAlpha = inactivo ? 0.5 : 1;

    // Sombra
    ctx.beginPath(); ctx.arc(px + 1, py + 1, 14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();

    // Círculo jugador
    ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fillStyle = colorFondo; ctx.fill();
    ctx.strokeStyle = inactivo ? "#71717a" : "white";
    ctx.lineWidth = inactivo ? 1 : 2; ctx.stroke();

    // Número
    ctx.fillStyle = colorTexto;
    ctx.font = `${inactivo ? "normal" : "bold"} 11px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(j.num, px, py);

    ctx.globalAlpha = 1; // resetear siempre al final
  });
}

function dibujarFlechas(ctx, jugsBase, jugsDestino) {
  if (!jugsDestino) return;
  jugsBase.forEach(j => {
    const dest = jugsDestino.find(d => d.id === j.id);
    if (!dest) return;
    const x1 = (j.x / 100) * FIELD_W; const y1 = (j.y / 100) * FIELD_H;
    const x2 = (dest.x / 100) * FIELD_W; const y2 = (dest.y / 100) * FIELD_H;
    if (Math.abs(x1 - x2) < 2 && Math.abs(y1 - y2) < 2) return;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = "rgba(255,255,100,0.6)"; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 10 * Math.cos(angle - 0.4), y2 - 10 * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - 10 * Math.cos(angle + 0.4), y2 - 10 * Math.sin(angle + 0.4));
    ctx.closePath(); ctx.fillStyle = "rgba(255,255,100,0.8)"; ctx.fill();
  });
}

function dibujarBalon(ctx, b) {
  const px = (b.x / 100) * FIELD_W;
  const py = (b.y / 100) * FIELD_H;
  const r = 11;

  // Sombra
  ctx.beginPath(); ctx.arc(px + 2, py + 2, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fill();

  // Círculo blanco
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = "white"; ctx.fill();
  ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5; ctx.stroke();

  // Cruz central (estilo balón clásico, limpio en cualquier tamaño)
  ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px + 6, py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px, py - 6); ctx.lineTo(px, py + 6); ctx.stroke();

  // 4 cuartos sombreados alternos
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, r - 2, 0, Math.PI/2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, r - 2, Math.PI, Math.PI*3/2); ctx.closePath(); ctx.fill();
}

function dibujarFlechaBalon(ctx, origen, destino) {
  if (!origen || !destino) return;
  const x1 = (origen.x / 100) * FIELD_W, y1 = (origen.y / 100) * FIELD_H;
  const x2 = (destino.x / 100) * FIELD_W, y2 = (destino.y / 100) * FIELD_H;
  if (Math.abs(x1 - x2) < 2 && Math.abs(y1 - y2) < 2) return;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 10 * Math.cos(angle - 0.4), y2 - 10 * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - 10 * Math.cos(angle + 0.4), y2 - 10 * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fill();
}

function TacticaEditor({ tactica, onGuardar, onCancelar }) {
  const canvasRef = useRef(null);
  const [nombre, setNombre] = useState(tactica.nombre);
  const [jugadores, setJugadores] = useState(tactica.jugadores.map(j => ({ ...j, tipo: j.tipo || "local" })));

  // Valores por defecto — se declaran ANTES de los useState que los usan
  const rivsDefault = tactica.rivales || [
    { id: "r1",  num: 1,  x: 50, y: 12, color: "#1d4ed8", tipo: "rival" },
    { id: "r2",  num: 2,  x: 20, y: 28, color: "#1d4ed8", tipo: "rival" },
    { id: "r3",  num: 3,  x: 35, y: 28, color: "#1d4ed8", tipo: "rival" },
    { id: "r4",  num: 4,  x: 65, y: 28, color: "#1d4ed8", tipo: "rival" },
    { id: "r5",  num: 5,  x: 80, y: 28, color: "#1d4ed8", tipo: "rival" },
    { id: "r6",  num: 6,  x: 30, y: 45, color: "#1d4ed8", tipo: "rival" },
    { id: "r7",  num: 7,  x: 50, y: 48, color: "#1d4ed8", tipo: "rival" },
    { id: "r8",  num: 8,  x: 70, y: 45, color: "#1d4ed8", tipo: "rival" },
    { id: "r9",  num: 9,  x: 25, y: 65, color: "#1d4ed8", tipo: "rival" },
    { id: "r10", num: 10, x: 50, y: 70, color: "#1d4ed8", tipo: "rival" },
    { id: "r11", num: 11, x: 75, y: 65, color: "#1d4ed8", tipo: "rival" },
  ];
  const balDefault = tactica.balon || { id: "balon", x: 50, y: 50 };

  // Normalizar keyframes antiguos sin rivales/balon — también antes de usarla
  const normalizarKeyframes = (kfs, rivs, bal) =>
    (kfs || []).map(kf => ({
      ...kf,
      rivales: kf.rivales || rivs.map(j => ({ ...j, activo: true })),
      balon:   kf.balon   || { ...bal, activo: true },
    }));

  const [rivales, setRivales] = useState(rivsDefault);
  const [balon, setBalon] = useState(balDefault);
  const [keyframes, setKeyframes] = useState(normalizarKeyframes(tactica.keyframes, rivsDefault, balDefault));
  const [dragging, setDragging] = useState(null);
  const [frameActivo, setFrameActivo] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const animFrameRef = useRef(null);
  const gifRef = useRef(null);

  const kfActivo = frameActivo !== null ? keyframes[frameActivo] : null;
  const posLocales = kfActivo ? kfActivo.jugadores : jugadores;
  const posRivales = kfActivo ? kfActivo.rivales   : rivales;
  const posBalon   = kfActivo ? kfActivo.balon      : balon;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    dibujarCampo(ctx);
    if (kfActivo) {
      const origenLocales = frameActivo === 0 ? jugadores : keyframes[frameActivo - 1].jugadores;
      const origenRivales = frameActivo === 0 ? rivales   : keyframes[frameActivo - 1].rivales;
      const soloActivosL  = kfActivo.jugadores.filter(j => j.activo !== false);
      const soloActivosR  = kfActivo.rivales.filter(j => j.activo !== false);
      dibujarFlechas(ctx, origenLocales, soloActivosL);
      dibujarFlechas(ctx, origenRivales, soloActivosR);
      const bOrigen = frameActivo === 0 ? balon : keyframes[frameActivo - 1].balon;
      if (kfActivo.balon.activo !== false) dibujarFlechaBalon(ctx, bOrigen, kfActivo.balon);
    }
    dibujarJugadores(ctx, posLocales);
    dibujarJugadores(ctx, posRivales);
    dibujarBalon(ctx, posBalon);
  }, [jugadores, rivales, balon, keyframes, frameActivo]);

  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  const getPosEnCampo = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = FIELD_W / rect.width;
    const scaleY = FIELD_H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) * scaleX / FIELD_W) * 100,
      y: ((clientY - rect.top)  * scaleY / FIELD_H) * 100,
    };
  };

  const onMouseDown = (e) => {
    if (playing) return;
    const canvas = canvasRef.current;
    const pos = getPosEnCampo(e, canvas);

    // Modo eliminar: toca un jugador y lo elimina
    if (modoEliminar) {
      const lista = modoEliminar === "local" ? posLocales : posRivales;
      const jug = [...lista].reverse().find(j => {
        const dx = j.x - pos.x, dy = j.y - pos.y;
        return Math.sqrt(dx*dx + dy*dy) < 5;
      });
      if (jug) { e.preventDefault(); eliminarJugador(jug.id, modoEliminar); }
      return;
    }

    // Balón
    const dxB = posBalon.x - pos.x, dyB = posBalon.y - pos.y;
    if (Math.sqrt(dxB*dxB + dyB*dyB) < 5) {
      if (kfActivo && kfActivo.balon.activo === false) return;
      e.preventDefault(); setDragging({ id: "balon", tipo: "balon" }); return;
    }
    // Local
    const jugL = [...posLocales].reverse().find(j => {
      if (kfActivo && j.activo === false) return false;
      const dx = j.x - pos.x, dy = j.y - pos.y;
      return Math.sqrt(dx*dx + dy*dy) < 5;
    });
    if (jugL) { e.preventDefault(); setDragging({ id: jugL.id, tipo: "local" }); return; }
    // Rival
    const jugR = [...posRivales].reverse().find(j => {
      if (kfActivo && j.activo === false) return false;
      const dx = j.x - pos.x, dy = j.y - pos.y;
      return Math.sqrt(dx*dx + dy*dy) < 5;
    });
    if (jugR) { e.preventDefault(); setDragging({ id: jugR.id, tipo: "rival" }); }
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPosEnCampo(e, canvas);
    const nx = Math.max(2, Math.min(98, pos.x));
    const ny = Math.max(2, Math.min(98, pos.y));
    if (dragging.tipo === "balon") {
      if (frameActivo !== null) {
        setKeyframes(prev => prev.map((kf, i) =>
          i === frameActivo ? { ...kf, balon: { ...kf.balon, x: nx, y: ny } } : kf
        ));
      } else { setBalon(prev => ({ ...prev, x: nx, y: ny })); }
      return;
    }
    const setter = dragging.tipo === "local" ? setJugadores : setRivales;
    const kfKey  = dragging.tipo === "local" ? "jugadores"  : "rivales";
    if (frameActivo !== null) {
      setKeyframes(prev => prev.map((kf, i) =>
        i === frameActivo
          ? { ...kf, [kfKey]: kf[kfKey].map(j => j.id === dragging.id ? { ...j, x: nx, y: ny } : j) }
          : kf
      ));
    } else {
      setter(prev => prev.map(j => j.id === dragging.id ? { ...j, x: nx, y: ny } : j));
    }
  };

  const [modoEliminar, setModoEliminar] = useState(null); // null | "local" | "rival"

  const onMouseUp = () => setDragging(null);

  // ── Añadir / eliminar jugadores ──────────────────────────────────────────
  const añadirJugador = (tipo) => {
    if (frameActivo !== null) return; // solo en posición inicial
    const lista = tipo === "local" ? jugadores : rivales;
    const setter = tipo === "local" ? setJugadores : setRivales;
    const color = tipo === "local"
      ? (jugadores[0]?.color || "#ef4444")
      : (rivales[0]?.color || "#1d4ed8");
    const numsUsados = lista.map(j => j.num);
    let nuevoNum = 1;
    while (numsUsados.includes(nuevoNum)) nuevoNum++;
    const nuevo = {
      id: `${tipo[0]}${Date.now()}`,
      num: nuevoNum,
      x: 50 + (Math.random() - 0.5) * 20,
      y: tipo === "local" ? 70 : 30,
      color,
      tipo,
    };
    setter(prev => [...prev, nuevo]);
    // Añadir también a todos los keyframes existentes
    const kfKey = tipo === "local" ? "jugadores" : "rivales";
    setKeyframes(prev => prev.map(kf => ({
      ...kf,
      [kfKey]: [...kf[kfKey], { ...nuevo, activo: true }],
    })));
  };

  const eliminarJugador = (id, tipo) => {
    if (frameActivo !== null) return; // solo en posición inicial
    const setter = tipo === "local" ? setJugadores : setRivales;
    const kfKey = tipo === "local" ? "jugadores" : "rivales";
    setter(prev => prev.filter(j => j.id !== id));
    setKeyframes(prev => prev.map(kf => ({
      ...kf,
      [kfKey]: kf[kfKey].filter(j => j.id !== id),
    })));
  };

  const addKeyframe = () => {
    const ultimo = keyframes.length > 0 ? keyframes[keyframes.length - 1] : null;
    const nuevo = {
      id: Date.now(),
      duracion: 1.5,
      jugadores: (ultimo ? ultimo.jugadores : jugadores).map(j => ({ ...j, activo: true })),
      rivales:   (ultimo ? ultimo.rivales   : rivales).map(j =>   ({ ...j, activo: true })),
      balon:     { ...(ultimo ? ultimo.balon : balon), activo: true },
    };
    setKeyframes(prev => [...prev, nuevo]);
    setFrameActivo(keyframes.length);
  };

  const eliminarKeyframe = (idx) => {
    setKeyframes(prev => prev.filter((_, i) => i !== idx));
    setFrameActivo(prev => {
      if (prev === null) return null;
      if (prev === idx) return null;
      if (prev > idx) return prev - 1;
      return prev;
    });
  };

  const toggleActivo = (id, tipo) => {
    if (frameActivo === null) return;
    if (tipo === "balon") {
      setKeyframes(prev => prev.map((kf, i) =>
        i === frameActivo ? { ...kf, balon: { ...kf.balon, activo: !kf.balon.activo } } : kf
      ));
    } else {
      const kfKey = tipo === "local" ? "jugadores" : "rivales";
      setKeyframes(prev => prev.map((kf, i) =>
        i === frameActivo
          ? { ...kf, [kfKey]: kf[kfKey].map(j => j.id === id ? { ...j, activo: !j.activo } : j) }
          : kf
      ));
    }
  };

  const cambiarDuracion = (d) => {
    if (frameActivo === null) return;
    setKeyframes(prev => prev.map((kf, i) => i === frameActivo ? { ...kf, duracion: d } : kf));
  };

  const cambiarColor = (color, tipo) => {
    if (tipo === "local") {
      setJugadores(prev => prev.map(j => ({ ...j, color })));
      setKeyframes(prev => prev.map(kf => ({ ...kf, jugadores: kf.jugadores.map(j => ({ ...j, color })) })));
    } else {
      setRivales(prev => prev.map(j => ({ ...j, color })));
      setKeyframes(prev => prev.map(kf => ({ ...kf, rivales: kf.rivales.map(j => ({ ...j, color })) })));
    }
  };

  const playAnimacion = (onFinish) => {
    if (keyframes.length === 0) return;
    setPlaying(true);
    setFrameActivo(null);

    const getPosBase = (idx) => ({
      jugs: idx < 0 ? jugadores : keyframes[idx].jugadores,
      rivs: idx < 0 ? rivales   : keyframes[idx].rivales,
      bal:  idx < 0 ? balon     : keyframes[idx].balon,
    });

    const segmentos = keyframes.map((kf, i) => {
      const base = getPosBase(i - 1);
      const durMs = (kf.duracion || 1.5) * 1000;
      const toJugs = kf.jugadores.map(j => {
        if (!j.activo) { const o = base.jugs.find(f => f.id === j.id)||j; return {...j, x:o.x, y:o.y}; }
        return j;
      });
      const toRivs = kf.rivales.map(j => {
        if (!j.activo) { const o = base.rivs.find(f => f.id === j.id)||j; return {...j, x:o.x, y:o.y}; }
        return j;
      });
      const toBal = kf.balon.activo === false
        ? { ...kf.balon, x: base.bal.x, y: base.bal.y }
        : kf.balon;
      return { fromJugs: base.jugs, fromRivs: base.rivs, fromBal: base.bal, toJugs, toRivs, toBal, durMs };
    });

    let segIdx = 0;
    let segStartTime = null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const step = (timestamp) => {
      if (segIdx >= segmentos.length) {
        setPlaying(false);
        dibujarCampo(ctx);
        dibujarJugadores(ctx, jugadores);
        dibujarJugadores(ctx, rivales);
        dibujarBalon(ctx, balon);
        if (onFinish) onFinish();
        return;
      }
      if (segStartTime === null) segStartTime = timestamp;
      const elapsed = timestamp - segStartTime;
      const { fromJugs, fromRivs, fromBal, toJugs, toRivs, toBal, durMs } = segmentos[segIdx];
      const t = Math.min(1, elapsed / durMs);
      const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
      const interp = (from, to) => from.map(j => {
        const d = to.find(x => x.id === j.id)||j;
        return { ...j, x: j.x + (d.x - j.x)*ease, y: j.y + (d.y - j.y)*ease };
      });
      const interpBal = { ...fromBal,
        x: fromBal.x + (toBal.x - fromBal.x)*ease,
        y: fromBal.y + (toBal.y - fromBal.y)*ease
      };
      dibujarCampo(ctx);
      dibujarJugadores(ctx, interp(fromJugs, toJugs));
      dibujarJugadores(ctx, interp(fromRivs, toRivs));
      dibujarBalon(ctx, interpBal);
      if (t >= 1) { segIdx++; segStartTime = null; }
      animFrameRef.current = requestAnimationFrame(step);
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(step);
  };

  const stopAnimacion = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setPlaying(false);
    const ctx = canvasRef.current.getContext("2d");
    dibujarCampo(ctx);
    dibujarJugadores(ctx, jugadores);
    dibujarJugadores(ctx, rivales);
    dibujarBalon(ctx, balon);
  };

  const generarGif = () => {
    if (keyframes.length === 0) { alert("Añade al menos un paso antes de generar el GIF."); return; }
    setGrabando(true);

    const FPS_GIF = 25;
    const MS_POR_FRAME = 1000 / FPS_GIF;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const getPosBase = (idx) => ({
      jugs: idx < 0 ? jugadores : keyframes[idx].jugadores,
      rivs: idx < 0 ? rivales   : keyframes[idx].rivales,
      bal:  idx < 0 ? balon     : keyframes[idx].balon,
    });

    const segmentos = keyframes.map((kf, i) => {
      const base = getPosBase(i - 1);
      const durMs = (kf.duracion || 1.5) * 1000;
      const toJugs = kf.jugadores.map(j => {
        if (!j.activo) { const o = base.jugs.find(f => f.id === j.id)||j; return {...j, x:o.x, y:o.y}; }
        return j;
      });
      const toRivs = kf.rivales.map(j => {
        if (!j.activo) { const o = base.rivs.find(f => f.id === j.id)||j; return {...j, x:o.x, y:o.y}; }
        return j;
      });
      const toBal = kf.balon.activo === false
        ? { ...kf.balon, x: base.bal.x, y: base.bal.y }
        : kf.balon;
      return { fromJugs: base.jugs, fromRivs: base.rivs, fromBal: base.bal, toJugs, toRivs, toBal, durMs };
    });

    const gif = new GIF({
      workers: 2,
      quality: 8,
      width: FIELD_W,
      height: FIELD_H,
      workerScript: "/gif.worker.js",
    });

    const interpArr = (from, to, ease) => from.map(j => {
      const d = to.find(x => x.id === j.id) || j;
      return { ...j, x: j.x + (d.x - j.x)*ease, y: j.y + (d.y - j.y)*ease };
    });

    segmentos.forEach(({ fromJugs, fromRivs, fromBal, toJugs, toRivs, toBal, durMs }) => {
      const totalFrames = Math.max(1, Math.round(durMs / MS_POR_FRAME));
      for (let f = 0; f < totalFrames; f++) {
        const t = f >= totalFrames - 1 ? 1 : f / totalFrames;
        const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
        const interpBal = {
          ...fromBal,
          x: fromBal.x + (toBal.x - fromBal.x)*ease,
          y: fromBal.y + (toBal.y - fromBal.y)*ease,
        };
        dibujarCampo(ctx);
        dibujarJugadores(ctx, interpArr(fromJugs, toJugs, ease));
        dibujarJugadores(ctx, interpArr(fromRivs, toRivs, ease));
        dibujarBalon(ctx, interpBal);
        gif.addFrame(ctx, { copy: true, delay: MS_POR_FRAME });
      }
    });

    gif.on("finished", (blob) => {
      setGrabando(false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const nombreArchivo = nombre.replace(/[/\\:*?"<>|]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").trim() || "tactica";
      a.href = url;
      a.download = `tactica_${nombreArchivo}.gif`;
      a.click();
      URL.revokeObjectURL(url);
      dibujarCampo(ctx);
      dibujarJugadores(ctx, jugadores);
      dibujarJugadores(ctx, rivales);
      dibujarBalon(ctx, balon);
    });

    gif.render();
  };

  const grabarMP4 = async () => {
    if (keyframes.length === 0) { alert("Añade al menos un paso antes de grabar."); return; }

    // Verificar soporte WebCodecs
    if (typeof VideoEncoder === "undefined") {
      alert("Tu navegador no soporta grabación de vídeo MP4.\n\nUsa Chrome o Safari actualizados. Puedes usar el botón GIF como alternativa.");
      return;
    }

    setGrabando(true);
    const FPS = 30;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const getPosBase = (idx) => ({
      jugs: idx < 0 ? jugadores : keyframes[idx].jugadores,
      rivs: idx < 0 ? rivales   : keyframes[idx].rivales,
      bal:  idx < 0 ? balon     : keyframes[idx].balon,
    });

    const segmentos = keyframes.map((kf, i) => {
      const base = getPosBase(i - 1);
      const durMs = (kf.duracion || 1.5) * 1000;
      const toJugs = kf.jugadores.map(j => {
        if (!j.activo) { const o = base.jugs.find(f => f.id === j.id)||j; return {...j, x:o.x, y:o.y}; }
        return j;
      });
      const toRivs = kf.rivales.map(j => {
        if (!j.activo) { const o = base.rivs.find(f => f.id === j.id)||j; return {...j, x:o.x, y:o.y}; }
        return j;
      });
      const toBal = kf.balon.activo === false
        ? { ...kf.balon, x: base.bal.x, y: base.bal.y }
        : kf.balon;
      return { fromJugs: base.jugs, fromRivs: base.rivs, fromBal: base.bal, toJugs, toRivs, toBal, durMs };
    });

    const interpArr = (from, to, ease) => from.map(j => {
      const d = to.find(x => x.id === j.id) || j;
      return { ...j, x: j.x + (d.x - j.x)*ease, y: j.y + (d.y - j.y)*ease };
    });

    // Crear muxer MP4
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width: FIELD_W, height: FIELD_H },
      fastStart: "in-memory",
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { console.error(e); setGrabando(false); },
    });

    encoder.configure({
      codec: "avc1.42001f",
      width: FIELD_W,
      height: FIELD_H,
      bitrate: 1_500_000,
      framerate: FPS,
    });

    let frameIdx = 0;
    const MS_POR_FRAME = 1000 / FPS;

    for (const { fromJugs, fromRivs, fromBal, toJugs, toRivs, toBal, durMs } of segmentos) {
      const totalFrames = Math.max(1, Math.round(durMs / MS_POR_FRAME));
      for (let f = 0; f < totalFrames; f++) {
        const t = f >= totalFrames - 1 ? 1 : f / totalFrames;
        const ease = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
        const interpBal = {
          ...fromBal,
          x: fromBal.x + (toBal.x - fromBal.x)*ease,
          y: fromBal.y + (toBal.y - fromBal.y)*ease,
        };
        dibujarCampo(ctx);
        dibujarJugadores(ctx, interpArr(fromJugs, toJugs, ease));
        dibujarJugadores(ctx, interpArr(fromRivs, toRivs, ease));
        dibujarBalon(ctx, interpBal);

        const videoFrame = new VideoFrame(canvas, {
          timestamp: Math.round(frameIdx * (1_000_000 / FPS)),
          duration: Math.round(1_000_000 / FPS),
        });
        encoder.encode(videoFrame, { keyFrame: frameIdx % (FPS * 2) === 0 });
        videoFrame.close();
        frameIdx++;
      }
    }

    await encoder.flush();
    muxer.finalize();

    const { buffer } = muxer.target;
    const blob = new Blob([buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const nombreArchivo = nombre.replace(/[\/\\:*?"<>|]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").trim() || "tactica";
    a.href = url;
    a.download = `tactica_${nombreArchivo}.mp4`;
    a.click();
    URL.revokeObjectURL(url);

    // Redibujar posición inicial
    dibujarCampo(ctx);
    dibujarJugadores(ctx, jugadores);
    dibujarJugadores(ctx, rivales);
    dibujarBalon(ctx, balon);
    setGrabando(false);
  };

  const guardar = () => onGuardar({ ...tactica, nombre, jugadores, rivales, balon, keyframes });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => {
          // Normalizar quitando campos internos (tipo) antes de comparar
          const normJugs = jugs => jugs.map(({ tipo, ...rest }) => rest);
          const haycambios =
            nombre !== tactica.nombre ||
            JSON.stringify(normJugs(jugadores)) !== JSON.stringify(normJugs(tactica.jugadores || [])) ||
            JSON.stringify(normJugs(rivales))   !== JSON.stringify(normJugs(tactica.rivales  || [])) ||
            JSON.stringify(keyframes) !== JSON.stringify(tactica.keyframes || []);
          if (haycambios && !window.confirm("¿Salir sin guardar? Se perderán los cambios.")) return;
          onCancelar();
        }} className="text-zinc-400 hover:text-white text-sm">← Volver</button>
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm flex-1 min-w-40"
          placeholder="Nombre de la táctica"
        />
        <Btn onClick={guardar}>💾 Guardar</Btn>
      </div>

      <Card>
        <p className="text-zinc-400 text-xs font-semibold mb-1">CÓMO CREAR UNA ANIMACIÓN</p>
        <ol className="text-zinc-500 text-xs space-y-0.5 list-decimal list-inside">
          <li><span className="text-zinc-300">Posición inicial:</span> arrastra jugadores, rivales y el balón</li>
          <li><span className="text-zinc-300">Añadir paso:</span> crea un nuevo movimiento</li>
          <li><span className="text-zinc-300">Activa/desactiva</span> quién se mueve en ese paso</li>
          <li><span className="text-zinc-300">Elige duración</span> y arrastra al destino</li>
          <li>Repite. Luego <span className="text-zinc-300">▶ Ver animación</span></li>
        </ol>
      </Card>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex flex-col gap-3 w-full lg:w-64 lg:order-2">

          <Card>
            <p className="text-zinc-400 text-xs font-semibold mb-1">🔴 LOCAL</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {["#ef4444","#f97316","#22c55e","#f59e0b","#a855f7","#ffffff"].map(c => (
                <button key={c} onClick={() => cambiarColor(c, "local")}
                  className="w-7 h-7 rounded-full border-2 border-zinc-600 hover:border-white transition-all"
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            {frameActivo === null && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => añadirJugador("local")}
                  className="px-2 py-1 rounded text-xs bg-zinc-700 hover:bg-zinc-600 text-white transition-all">
                  + Añadir
                </button>
                <button
                  onClick={() => setModoEliminar(prev => prev === "local" ? null : "local")}
                  className={`px-2 py-1 rounded text-xs transition-all ${modoEliminar === "local" ? "bg-red-700 text-white" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"}`}>
                  {modoEliminar === "local" ? "✕ Toca un jugador" : "− Eliminar"}
                </button>
                <span className="text-zinc-600 text-xs self-center">{jugadores.length} jugadores</span>
              </div>
            )}
          </Card>

          <Card>
            <p className="text-zinc-400 text-xs font-semibold mb-1">🔵 VISITANTE</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {["#1d4ed8","#0891b2","#16a34a","#7c3aed","#db2777","#ffffff"].map(c => (
                <button key={c} onClick={() => cambiarColor(c, "rival")}
                  className="w-7 h-7 rounded-full border-2 border-zinc-600 hover:border-white transition-all"
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            {frameActivo === null && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => añadirJugador("rival")}
                  className="px-2 py-1 rounded text-xs bg-zinc-700 hover:bg-zinc-600 text-white transition-all">
                  + Añadir
                </button>
                <button
                  onClick={() => setModoEliminar(prev => prev === "rival" ? null : "rival")}
                  className={`px-2 py-1 rounded text-xs transition-all ${modoEliminar === "rival" ? "bg-red-700 text-white" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"}`}>
                  {modoEliminar === "rival" ? "✕ Toca un jugador" : "− Eliminar"}
                </button>
                <span className="text-zinc-600 text-xs self-center">{rivales.length} jugadores</span>
              </div>
            )}
          </Card>

          <Card>
            <p className="text-zinc-400 text-xs font-semibold mb-2">MOVIMIENTOS</p>
            <div className="space-y-1 mb-2">
              <button onClick={() => { setFrameActivo(null); setModoEliminar(null); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-all ${frameActivo === null ? "bg-red-900/50 text-red-300 font-semibold" : "text-zinc-400 hover:bg-zinc-700 hover:text-white"}`}>
                📍 Posición inicial
              </button>
              {keyframes.map((kf, i) => (
                <div key={kf.id} className="flex items-center gap-1">
                  <button onClick={() => { setFrameActivo(i); setModoEliminar(null); }}
                    className={`flex-1 text-left px-2 py-1.5 rounded text-sm transition-all ${frameActivo === i ? "bg-red-900/50 text-red-300 font-semibold" : "text-zinc-400 hover:bg-zinc-700 hover:text-white"}`}>
                    🔑 Paso {i + 1} <span className="text-zinc-500 text-xs">({kf.duracion || 1.5}s)</span>
                  </button>
                  <button onClick={() => eliminarKeyframe(i)} className="text-zinc-600 hover:text-red-400 text-xs px-1.5 py-1">✕</button>
                </div>
              ))}
            </div>
            <Btn small onClick={addKeyframe}>+ Añadir paso</Btn>
          </Card>

          {frameActivo !== null && kfActivo && (
            <Card>
              <p className="text-zinc-400 text-xs font-semibold mb-2">PASO {frameActivo + 1} — OPCIONES</p>
              <div className="mb-3">
                <p className="text-zinc-500 text-xs mb-1">⏱ Duración</p>
                <div className="flex gap-1 flex-wrap">
                  {[1, 1.5, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => cambiarDuracion(s)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${(kfActivo.duracion||1.5)===s ? "bg-red-700 text-white" : "bg-zinc-700 text-zinc-400 hover:text-white"}`}>
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-2">
                <p className="text-zinc-500 text-xs mb-1">🔴 Locales</p>
                <div className="grid grid-cols-4 gap-1">
                  {kfActivo.jugadores.map(j => (
                    <button key={j.id} onClick={() => toggleActivo(j.id, "local")}
                      className={`rounded py-1 text-xs font-bold transition-all border ${j.activo ? "border-transparent" : "border-zinc-600 bg-zinc-800 text-zinc-500"}`}
                      style={j.activo ? { backgroundColor: j.color||"#ef4444", color: j.color==="#ffffff"?"#111":"white" } : {}}>
                      {j.num}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-2">
                <p className="text-zinc-500 text-xs mb-1">🔵 Rivales</p>
                <div className="grid grid-cols-4 gap-1">
                  {kfActivo.rivales.map(j => (
                    <button key={j.id} onClick={() => toggleActivo(j.id, "rival")}
                      className={`rounded py-1 text-xs font-bold transition-all border ${j.activo ? "border-transparent" : "border-zinc-600 bg-zinc-800 text-zinc-500"}`}
                      style={j.activo ? { backgroundColor: j.color||"#1d4ed8", color: j.color==="#ffffff"?"#111":"white" } : {}}>
                      {j.num}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">⚽ Balón</p>
                <button onClick={() => toggleActivo("balon", "balon")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all border ${kfActivo.balon.activo !== false ? "bg-white text-black border-transparent" : "bg-zinc-800 text-zinc-500 border-zinc-600"}`}>
                  {kfActivo.balon.activo !== false ? "Se mueve" : "Quieto"}
                </button>
              </div>
            </Card>
          )}

          <div className="flex flex-col gap-2">
            {!playing
              ? <Btn onClick={() => playAnimacion()} disabled={keyframes.length === 0}>▶ Ver animación</Btn>
              : <Btn variant="secondary" onClick={stopAnimacion}>⏹ Parar</Btn>
            }
            <Btn variant="secondary" onClick={grabarMP4} disabled={grabando || playing || keyframes.length === 0}>
              {grabando ? "⏳ Exportando..." : "🎬 Exportar MP4"}
            </Btn>
            <Btn variant="secondary" onClick={generarGif} disabled={grabando || playing || keyframes.length === 0}>
              🎞️ Exportar GIF
            </Btn>
            {grabando && <p className="text-yellow-400 text-xs text-center">Exportando... espera</p>}
          </div>
        </div>

        <div className="flex-1 lg:order-1 flex justify-center">
          <canvas
            ref={canvasRef}
            width={FIELD_W}
            height={FIELD_H}
            className="rounded-lg border border-zinc-700"
            style={{
              width: "100%",
              maxWidth: "380px",
              touchAction: dragging ? "none" : "pan-y",
              cursor: modoEliminar ? "crosshair" : (dragging ? "grabbing" : "grab"),
              outline: modoEliminar ? "2px solid #ef4444" : "none",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onMouseDown}
            onTouchMove={onMouseMove}
            onTouchEnd={onMouseUp}
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Clasificación
// ══════════════════════════════════════════════════════════════════════════════
function ClasificacionSection({ team, data }) {
  const [tab, setTab] = useState("goles");

  const players = data.players || [];
  const matches = data.matches || [];
  const attendance = data.attendance || [];

  const TABS = [
    { id: "goles", label: "🥇 Goleadores" },
    { id: "asistencias", label: "🎯 Asistencias" },
    { id: "ga", label: "⚡ G+A" },
    { id: "minutos", label: "⏱ Minutos" },
    { id: "partidos", label: "📋 Partidos" },
  ];

  const getPlayerMatchStats = (playerId) => {
    let goles = 0, asistencias = 0, minutos = 0, titular = 0, suplente = 0, noConv = 0;
    matches.forEach(m => {
      const c = (m.convocatoria || []).find(c => c.playerId === playerId);
      if (!c) return;
      goles += c.goles || 0;
      asistencias += c.asistencias || 0;
      minutos += c.minutos || 0;
      if (c.status === "titular") titular++;
      else if (c.status === "suplente") suplente++;
      else noConv++;
    });
    return { goles, asistencias, ga: goles + asistencias, minutos, titular, suplente, noConv, partidos: titular + suplente };
  };

  const getPlayerAttendance = (playerId) => {
    const recs = attendance.filter(a => a.playerId === playerId);
    return {
      present: recs.filter(r => r.status === "present").length,
      late: recs.filter(r => r.status === "late").length,
      absent: recs.filter(r => r.status === "absent").length,
    };
  };

  const getPlayerCapitanias = (playerId) => matches.filter(m => m.capitan === playerId).length;
  const ranked = players.map(p => ({
    ...p,
    ...getPlayerMatchStats(p.id),
    att: getPlayerAttendance(p.id),
    capitanias: getPlayerCapitanias(p.id),
  }));

  const medal = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

  const Row = ({ i, name, main, sub }) => (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${i < 3 ? "bg-zinc-800" : "bg-zinc-900 border border-zinc-800"}`}>
      <span className="text-lg w-8 text-center">{medal(i)}</span>
      <span className="text-white font-semibold flex-1">{name}</span>
      <div className="text-right">
        <div className={`font-black text-lg ${i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-zinc-400"}`}>{main}</div>
        {sub && <div className="text-xs text-zinc-500">{sub}</div>}
      </div>
    </div>
  );

  const renderTab = () => {
    if (tab === "goles") {
      const sorted = [...ranked].sort((a, b) => b.goles - a.goles).filter(p => p.goles > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin goles registrados todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.goles} ⚽`} />);
    }
    if (tab === "asistencias") {
      const sorted = [...ranked].sort((a, b) => b.asistencias - a.asistencias).filter(p => p.asistencias > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin asistencias registradas todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.asistencias} 🎯`} />);
    }
    if (tab === "ga") {
      const sorted = [...ranked].sort((a, b) => b.ga - a.ga).filter(p => p.ga > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin datos todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.ga} ⚡`} sub={`${p.goles} ⚽ + ${p.asistencias} 🎯`} />);
    }
    if (tab === "minutos") {
      const sorted = [...ranked].sort((a, b) => b.minutos - a.minutos).filter(p => p.minutos > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin minutos registrados todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.minutos} min`} />);
    }
    if (tab === "partidos") {
      const sorted = [...ranked].sort((a, b) => b.partidos - a.partidos).filter(p => p.partidos > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin partidos registrados todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.partidos} partidos`} sub={`${p.titular} tit. · ${p.suplente} sup. · ${p.noConv} no conv.`} />);
    }
    if (tab === "asistencia") {
      const sorted = [...ranked].sort((a, b) => (b.att.present + b.att.late) - (a.att.present + a.att.late));
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin registros de asistencia todavía.</p>;
      return sorted.map((p, i) => (
        <div key={p.id} className={`px-4 py-3 rounded-lg ${i < 3 ? "bg-zinc-800" : "bg-zinc-900 border border-zinc-800"}`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lg w-8 text-center">{medal(i)}</span>
            <span className="text-white font-semibold flex-1">{p.name}</span>
            <span className="text-white font-black">{p.att.present + p.att.late} sesiones</span>
          </div>
          <div className="flex gap-3 text-xs ml-11">
            <span className="text-green-400">✓ {p.att.present} asistió</span>
            <span className="text-yellow-400">⏱ {p.att.late} tarde</span>
            <span className="text-red-400">✗ {p.att.absent} no vino</span>
          </div>
        </div>
      ));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Clasificaciones — {team}</h2>

      {/* Tab selector */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-sm border transition-all ${tab === t.id ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
          >{t.label}</button>
        ))}
      </div>

      <div className="space-y-2">
        {renderTab()}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Gestión de temporadas (coordinadores only)
// ══════════════════════════════════════════════════════════════════════════════
function MejoresRivalesSection({ db }) {
  const TEAMS_LIST = Object.keys(db);
  const [filterTeam, setFilterTeam] = useState("all");

  // Recopilar todos los mejores rivales de todos los equipos
  const allRivales = [];
  TEAMS_LIST.forEach(team => {
    const matches = db[team]?.matches || [];
    matches.forEach(m => {
      (m.mejoresRivales || []).filter(r => r.nombre).forEach(r => {
        allRivales.push({
          ...r,
          equipo: team,
          rival: m.rival,
          fecha: m.fecha,
          resultado: m.resultado,
        });
      });
    });
  });

  const CATEGORIAS = [
    { id: "Escoleta", color: "bg-pink-900 border-pink-700 text-pink-200" },
    { id: "Prebenjamín", color: "bg-orange-900 border-orange-700 text-orange-200" },
    { id: "Benjamín", color: "bg-yellow-900 border-yellow-700 text-yellow-200" },
    { id: "Alevín", color: "bg-green-900 border-green-700 text-green-200" },
    { id: "Infantil", color: "bg-blue-900 border-blue-700 text-blue-200" },
    { id: "Cadete", color: "bg-purple-900 border-purple-700 text-purple-200" },
    { id: "Juvenil", color: "bg-red-900 border-red-700 text-red-200" },
  ];
  const teamToCategoria = (team) => {
    const t = team.toLowerCase();
    if (t.includes("escoleta")) return "Escoleta";
    if (t.includes("prebenjam")) return "Prebenjamín";
    if (t.includes("benjam")) return "Benjamín";
    if (t.includes("alevín")||t.includes("alevin")) return "Alevín";
    if (t.includes("infantil")) return "Infantil";
    if (t.includes("cadete")) return "Cadete";
    if (t.includes("juvenil")) return "Juvenil";
    return "Otros";
  };
  const filtered = filterTeam === "all" ? allRivales : allRivales.filter(r => teamToCategoria(r.equipo) === filterTeam);
  const categoriesWithData = [...new Set(allRivales.map(r => teamToCategoria(r.equipo)))];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">⭐ Mejores Jugadores Rivales</h2>
      <p className="text-zinc-400 text-sm">Jugadores rivales destacados registrados por los entrenadores en cada partido.</p>

      {/* Filtro por equipo */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterTeam("all")} className={`px-2 py-1 rounded text-xs border transition-all ${filterTeam==="all"?"bg-zinc-600 border-zinc-400 text-white":"bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>Todos</button>
        {CATEGORIAS.filter(c => categoriesWithData.includes(c.id)).map(c => (
          <button key={c.id} onClick={() => setFilterTeam(c.id)} className={`px-2 py-1 rounded text-xs border transition-all ${filterTeam===c.id?c.color+" font-semibold":"bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>{c.id}</button>
        ))}
      </div>

      {filtered.length === 0 && <p className="text-zinc-500 text-sm">No hay jugadores rivales registrados todavía.</p>}

      {(() => {
        const renderRival = (r, i, colorClass) => (
          <div key={i} className={`border rounded-xl p-4 flex items-center gap-3 flex-wrap ${colorClass}`}>
            <div className="flex items-center gap-2">
              {r.num && <span className="font-mono text-sm bg-black/20 px-2 py-0.5 rounded">#{r.num}</span>}
              <span className="font-semibold">{r.nombre}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap text-xs opacity-80">
              <span>{r.equipo}</span>
              <span>vs {r.rival}</span>
              <span>📅 {r.fecha}</span>
              {r.resultado && <span className="bg-black/20 px-1.5 py-0.5 rounded">{r.resultado}</span>}
            </div>
          </div>
        );

        if (filterTeam !== "all") {
          const cat = CATEGORIAS.find(c => teamToCategoria(filterTeam) === c.id) || {color:"bg-zinc-800 border-zinc-700 text-white"};
          return <div className="space-y-2">{filtered.map((r,i) => renderRival(r,i,cat.color))}</div>;
        }

        return CATEGORIAS.map(cat => {
          const catRivales = filtered.filter(r => teamToCategoria(r.equipo) === cat.id);
          if (catRivales.length === 0) return null;
          return (
            <div key={cat.id} className="space-y-2">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${cat.color}`}>{cat.id}</div>
              {catRivales.map((r,i) => renderRival(r,i,cat.color))}
            </div>
          );
        });
      })()}
    </div>
  );
}

function GestionSection({ db, onArchive, onRestore, passwords, onSavePasswords }) {
  const [seasons, setSeasons] = useState([]);
  const [seasonName, setSeasonName] = useState("");
  const [viewingSeason, setViewingSeason] = useState(null);
  const [viewingTeam, setViewingTeam] = useState(TEAMS[0]);
  const [confirming, setConfirming] = useState(false);
  const [confirmingRestore, setConfirmingRestore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ajustesTab, setAjustesTab] = useState("temporadas");
  const [editPwd, setEditPwd] = useState({});
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    loadSeasons().then(s => { setSeasons(s); setLoading(false); });
  }, []);

  const archive = async () => {
    if (!seasonName.trim()) return;
    const newSeason = {
      id: Date.now(),
      name: seasonName.trim(),
      date: new Date().toLocaleDateString("es-ES"),
      data: JSON.parse(JSON.stringify(db)),
    };
    const updated = [newSeason, ...seasons];
    await saveSeasons(updated);
    setSeasons(updated);
    await onArchive();
    setSeasonName("");
    setConfirming(false);
  };

  const delSeason = async (id) => {
    const updated = seasons.filter(s => s.id !== id);
    await saveSeasons(updated);
    setSeasons(updated);
    if (viewingSeason?.id === id) setViewingSeason(null);
  };

  const restore = async (season) => {
    await onRestore(season.data);
    setConfirmingRestore(null);
    setViewingSeason(null);
  };

  if (viewingSeason) {
    const teamData = viewingSeason.data[viewingTeam] || { players: [], matches: [] };
    const matches = (teamData.matches || []).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const parseResult = (r) => { if (!r) return null; const p = r.split("-").map(n => parseInt(n.trim())); return (p.length===2&&!p.some(isNaN))?p:null; };
    const stats = matches.reduce((acc, m) => { const p = parseResult(m.resultado); if (!p) return acc; const [g,gc]=p; acc.pj++; acc.gf+=g; acc.gc+=gc; if(g>gc){acc.v++;acc.pts+=3;}else if(g===gc){acc.e++;acc.pts+=1;}else acc.d++; return acc; }, {pj:0,v:0,e:0,d:0,gf:0,gc:0,pts:0});

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={() => setViewingSeason(null)}>← Volver</Btn>
          <h2 className="text-xl font-bold text-white">📦 {viewingSeason.name}</h2>
          <Btn variant="secondary" small onClick={() => setConfirmingRestore(viewingSeason)}>↩️ Restaurar</Btn>
        </div>

        {confirmingRestore && (
          <Card className="border-yellow-800">
            <p className="text-yellow-300 font-semibold mb-2">⚠️ ¿Restaurar esta temporada?</p>
            <p className="text-zinc-400 text-sm mb-3">Se reemplazarán todos los datos actuales con los de <strong className="text-white">"{confirmingRestore.name}"</strong>. Los datos actuales se perderán si no los has archivado antes.</p>
            <div className="flex gap-2">
              <Btn onClick={() => restore(confirmingRestore)}>Sí, restaurar</Btn>
              <Btn variant="secondary" onClick={() => setConfirmingRestore(null)}>Cancelar</Btn>
            </div>
          </Card>
        )}
        <div className="flex flex-wrap gap-2">
          {TEAMS.map(t => (
            <button key={t} onClick={() => setViewingTeam(t)}
              className={`px-3 py-1.5 rounded text-sm border transition-all ${viewingTeam === t ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
            >{t}</button>
          ))}
        </div>
        <Card>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">{viewingTeam} — Resumen</p>
          <div className="grid grid-cols-4 gap-2 text-center mb-3">
            <div><div className="text-2xl font-black text-white">{stats.pts}</div><div className="text-xs text-zinc-500">Pts</div></div>
            <div><div className="text-2xl font-black text-green-400">{stats.v}</div><div className="text-xs text-zinc-500">V</div></div>
            <div><div className="text-2xl font-black text-yellow-400">{stats.e}</div><div className="text-xs text-zinc-500">E</div></div>
            <div><div className="text-2xl font-black text-red-400">{stats.d}</div><div className="text-xs text-zinc-500">D</div></div>
          </div>
          <p className="text-xs text-zinc-500">Jugadores: {(teamData.players||[]).length} · Entrenamientos: {(teamData.trainings||[]).length} · Partidos: {matches.length}</p>
        </Card>
        <div className="space-y-2">
          {matches.map(m => (
            <Card key={m.id}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold">vs {m.rival}</span>
                {m.resultado && <Badge color="green">{m.resultado}</Badge>}
                <span className="text-zinc-400 text-xs ml-auto">📅 {m.fecha}</span>
              </div>
            </Card>
          ))}
          {matches.length === 0 && <p className="text-zinc-500 text-sm">Sin partidos en esta temporada.</p>}
        </div>
      </div>
    );
  }

  const savePwd = async (team) => {
    const val = (editPwd[team] || "").trim().toUpperCase();
    if (!val) return;
    const newPwds = { ...passwords, [team]: val };
    setPwdSaving(true);
    await onSavePasswords(newPwds);
    setEditPwd(prev => { const n = {...prev}; delete n[team]; return n; });
    setPwdSaving(false);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">⚙️ Ajustes</h2>
      <div className="flex gap-2 border-b border-zinc-700 pb-2">
        <button onClick={() => setAjustesTab("temporadas")} className={`px-4 py-1.5 rounded-t text-sm font-medium transition-all ${ajustesTab==="temporadas"?"bg-zinc-700 text-white":"text-zinc-400 hover:text-white"}`}>📦 Temporadas</button>
        <button onClick={() => setAjustesTab("entrenadores")} className={`px-4 py-1.5 rounded-t text-sm font-medium transition-all ${ajustesTab==="entrenadores"?"bg-zinc-700 text-white":"text-zinc-400 hover:text-white"}`}>🔑 Contraseñas entrenadores</button>
      </div>

      {ajustesTab === "entrenadores" && (
        <div className="space-y-3">
          <p className="text-zinc-400 text-sm">Gestiona las contraseñas de acceso de cada entrenador. Cada entrenador inicia sesión con el nombre de su equipo y su contraseña.</p>
          {TEAMS.map(team => (
            <Card key={team} className="flex items-center gap-3 flex-wrap">
              <span className="text-white font-semibold w-32">{team}</span>
              <span className="text-zinc-500 text-sm font-mono bg-zinc-800 px-2 py-1 rounded">{passwords[team] || "—"}</span>
              {editPwd[team] !== undefined ? (
                <div className="flex gap-2 items-center ml-auto">
                  <input
                    className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-sm font-mono w-28 uppercase"
                    value={editPwd[team]}
                    onChange={e => setEditPwd(prev => ({...prev, [team]: e.target.value.toUpperCase()}))}
                    placeholder="Nueva clave"
                    maxLength={10}
                  />
                  <Btn small onClick={() => savePwd(team)} disabled={pwdSaving}>Guardar</Btn>
                  <Btn small variant="secondary" onClick={() => setEditPwd(prev => { const n={...prev}; delete n[team]; return n; })}>✕</Btn>
                </div>
              ) : (
                <Btn small variant="secondary" className="ml-auto" onClick={() => setEditPwd(prev => ({...prev, [team]: passwords[team] || ""}))}>✏️ Editar</Btn>
              )}
            </Card>
          ))}
        </div>
      )}

      {ajustesTab === "temporadas" && <>
      {/* Archive current season */}
      <Card className="border-red-900/50">
        <p className="text-white font-semibold mb-1">Archivar temporada actual</p>
        <p className="text-zinc-400 text-sm mb-4">Guarda todos los datos actuales y empieza limpio para la nueva temporada. Los jugadores se mantienen pero se borran partidos, entrenamientos y asistencias.</p>
        {!confirming ? (
          <div className="space-y-3">
            <Input label="Nombre de la temporada" value={seasonName} onChange={e => setSeasonName(e.target.value)} placeholder="Ej: Temporada 2025-26" />
            <Btn onClick={() => seasonName.trim() && setConfirming(true)}>📦 Archivar y empezar nueva temporada</Btn>
          </div>
        ) : (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 space-y-3">
            <p className="text-red-300 font-semibold">⚠️ ¿Estás seguro?</p>
            <p className="text-zinc-400 text-sm">Se archivará la temporada <strong className="text-white">"{seasonName}"</strong> y se borrarán partidos, entrenamientos y asistencias de todos los equipos. Los jugadores y entrenadores se mantienen.</p>
            <div className="flex gap-2">
              <Btn onClick={archive}>Sí, archivar</Btn>
              <Btn variant="secondary" onClick={() => setConfirming(false)}>Cancelar</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Past seasons */}
      <div className="space-y-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Temporadas archivadas</p>
        {loading && <p className="text-zinc-500 text-sm animate-pulse">Cargando...</p>}
        {!loading && seasons.length === 0 && <p className="text-zinc-500 text-sm">No hay temporadas archivadas todavía.</p>}
        {seasons.map(s => (
          <Card key={s.id} className="hover:border-zinc-600 transition-colors">
            <div className="flex justify-between items-center">
              <div className="cursor-pointer flex-1" onClick={() => setViewingSeason(s)}>
                <p className="text-white font-semibold">📦 {s.name}</p>
                <p className="text-zinc-500 text-xs">Archivada el {s.date}</p>
              </div>
              <div className="flex gap-2 ml-3">
                <Btn small variant="secondary" onClick={() => setViewingSeason(s)}>Ver</Btn>
                <Btn small variant="danger" onClick={() => delSeason(s.id)}>🗑️</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
      </>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Entrenadores (coordinadores only)
// ══════════════════════════════════════════════════════════════════════════════
function ValoracionesTab({ matches, coaches, coordProfile, saveValuation, deleteValuation, players, getCoachHistory }) {
  const [step, setStep] = useState("list"); // list | pickMatch | pickType | pickCoach | valorCoach | valorEquipo
  const [selMatch, setSelMatch] = useState(null);
  const [selCoach, setSelCoach] = useState(null);

  if (matches.length === 0) return <p className="text-zinc-500 text-sm">No hay partidos registrados.</p>;

  const reset = () => { setStep("list"); setSelMatch(null); setSelCoach(null); };

  const matchObj = matches.find(m => m.id === selMatch);

  // STEP: list — mostrar valoraciones existentes
  if (step === "informes") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Btn small variant="ghost" onClick={() => setStep("list")}>← Volver</Btn>
          <p className="text-white font-semibold">📊 Informes de entrenadores</p>
        </div>
        {coaches.length === 0 && <p className="text-zinc-500 text-sm">No hay entrenadores registrados.</p>}
        {coaches.map(c => {
          const history = getCoachHistory(c.id);
          const avg = history.length ? (history.reduce((s,h)=>s+h.nota,0)/history.length).toFixed(2) : null;
          return (
            <Card key={c.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white font-bold text-lg">👤 {c.name}</span>
                {avg ? <div className="text-center"><div className={`text-2xl font-black ${avg>=7?"text-green-400":avg>=5?"text-yellow-400":"text-red-400"}`}>{avg}</div><div className="text-xs text-zinc-500">Media temporada</div></div> : <span className="text-zinc-500 text-sm">Sin valoraciones</span>}
              </div>
              {history.length > 0 && (
                <div className="space-y-2">
                  {history.map((h,i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-semibold">vs {h.rival}</span>
                          <span className="text-zinc-400 text-xs">📅 {h.fecha}</span>
                          {h.coordinador && <Badge color="blue">👤 {h.coordinador}</Badge>}
                        </div>
                        {h.comentario && <p className="text-zinc-400 text-xs mt-1">{h.comentario}</p>}
                      </div>
                      <div className={`text-xl font-black ${h.nota>=7?"text-green-400":h.nota>=5?"text-yellow-400":"text-red-400"}`}>{h.nota.toFixed(1)}</div>
                      <Btn small variant="danger" onClick={() => deleteValuation(h.matchId, c.id)}>🗑️</Btn>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  if (step === "list") return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Valoraciones por partido</p>
        <div className="flex gap-2">
          <Btn small variant="secondary" onClick={() => setStep("informes")}>📊 Informes</Btn>
          <Btn small onClick={() => setStep("pickMatch")}>➕ Añadir valoración</Btn>
        </div>
      </div>
      {matches.filter(m => (m.coachValuations||[]).length > 0 || (m.playerValuations||[]).length > 0).map(m => (
        <Card key={m.id} className="cursor-pointer hover:border-zinc-600" onClick={() => { setSelMatch(m.id); setStep("pickType"); }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold">vs {m.rival}</span>
            <span className="text-zinc-400 text-xs">📅 {m.fecha}</span>
            {m.resultado && <Badge color="green">{m.resultado}</Badge>}
            {(m.coachValuations||[]).length > 0 && <Badge color="blue">Entrenadores</Badge>}
            {(m.playerValuations||[]).length > 0 && <Badge color="purple">Jugadores</Badge>}
          </div>
        </Card>
      ))}
      {matches.filter(m=>(m.coachValuations||[]).length>0||(m.playerValuations||[]).length>0).length === 0 &&
        <p className="text-zinc-500 text-sm">No hay valoraciones todavía. Usa "➕ Añadir valoración" para empezar.</p>}
    </div>
  );

  // STEP: pickMatch
  if (step === "pickMatch") return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><Btn small variant="ghost" onClick={reset}>← Volver</Btn><p className="text-white font-semibold">1. Selecciona un partido</p></div>
      {matches.map(m => (
        <div key={m.id} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 cursor-pointer transition-colors"
          onClick={(e) => { e.stopPropagation(); setSelMatch(m.id); setStep("pickType"); }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white text-sm font-semibold">vs {m.rival}</span>
            <span className="text-zinc-400 text-xs">📅 {m.fecha}</span>
            {m.resultado && <Badge color="green">{m.resultado}</Badge>}
          </div>
        </div>
      ))}
    </div>
  );

  // STEP: pickType — entrenador o equipo
  if (step === "pickType") return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><Btn small variant="ghost" onClick={() => setStep("pickMatch")}>← Volver</Btn><p className="text-white font-semibold">2. ¿Qué quieres valorar?</p></div>
      <p className="text-zinc-400 text-xs">Partido: vs {matchObj?.rival} — {matchObj?.fecha}</p>
      <div className="bg-zinc-900 border border-zinc-700 hover:border-blue-700 rounded-xl p-4 cursor-pointer transition-colors"
        onClick={(e) => { e.stopPropagation(); setStep("pickCoach"); }}>
        <p className="text-white font-semibold">👤 Entrenador</p>
        <p className="text-zinc-400 text-sm">Valorar a un entrenador individualmente</p>
      </div>
      <div className="bg-zinc-900 border border-zinc-700 hover:border-purple-700 rounded-xl p-4 cursor-pointer transition-colors"
        onClick={(e) => { e.stopPropagation(); setStep("valorEquipo"); }}>
        <p className="text-white font-semibold">🏟️ Equipo</p>
        <p className="text-zinc-400 text-sm">Valorar a entrenadores y jugadores del equipo</p>
      </div>
    </div>
  );

  // STEP: pickCoach
  if (step === "pickCoach") return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><Btn small variant="ghost" onClick={() => setStep("pickType")}>← Volver</Btn><p className="text-white font-semibold">3. Selecciona un entrenador</p></div>
      {coaches.length === 0 && <p className="text-zinc-500 text-sm">No hay entrenadores registrados.</p>}
      {coaches.map(c => (
        <div key={c.id} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 cursor-pointer transition-colors"
          onClick={(e) => { e.stopPropagation(); setSelCoach(c.id); setStep("valorCoach"); }}>
          <span className="text-white font-semibold">👤 {c.name}</span>
        </div>
      ))}
    </div>
  );

  // STEP: valorCoach
  if (step === "valorCoach") {
    const c = coaches.find(x => x.id === selCoach);
    const val = (matchObj?.coachValuations || []).find(v => v.coachId === selCoach) || {};
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2"><Btn small variant="ghost" onClick={() => setStep("pickCoach")}>← Volver</Btn><p className="text-white font-semibold">Valorar a {c?.name}</p></div>
        <p className="text-zinc-400 text-xs">Partido: vs {matchObj?.rival} — {matchObj?.fecha}</p>
        <Card className="space-y-3">
          <Input label="Tu nombre (coordinador)" value={val.coordinador || coordProfile || ""} onChange={e => saveValuation(matchObj.id, selCoach, "coordinador", e.target.value)} placeholder="¿Quién hace esta valoración?" />
          <Input label="Nota (0-10)" type="number" step="0.1" min="0" max="10" value={val.nota || ""} onChange={e => saveValuation(matchObj.id, selCoach, "nota", e.target.value)} />
          <Textarea label="Observación" value={val.comentario || ""} onChange={e => saveValuation(matchObj.id, selCoach, "comentario", e.target.value)} placeholder="Escribe tu observación..." rows={3} />
        </Card>
        <Btn onClick={reset}>✓ Guardar y volver</Btn>
      </div>
    );
  }

  // STEP: valorEquipo — entrenadores + jugadores
  if (step === "valorEquipo") {
    const convocados = (matchObj?.convocatoria || []).filter(c => c.status !== "no_conv");
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2"><Btn small variant="ghost" onClick={() => setStep("pickType")}>← Volver</Btn><p className="text-white font-semibold">Valorar equipo — vs {matchObj?.rival}</p></div>

        {coaches.length > 0 && <>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Entrenadores</p>
          {coaches.map(c => {
            const val = (matchObj?.coachValuations || []).find(v => v.coachId === c.id) || {};
            return (
              <Card key={c.id} className="space-y-2">
                <span className="text-white font-semibold">👤 {c.name}</span>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Nota (0-10)" type="number" step="0.1" min="0" max="10" value={val.nota || ""} onChange={e => saveValuation(matchObj.id, c.id, "nota", e.target.value)} />
                  <Input label="Coordinador" value={val.coordinador || coordProfile || ""} onChange={e => saveValuation(matchObj.id, c.id, "coordinador", e.target.value)} />
                </div>
                <Textarea label="Observación" value={val.comentario || ""} onChange={e => saveValuation(matchObj.id, c.id, "comentario", e.target.value)} rows={2} />
              </Card>
            );
          })}
        </>}

        {convocados.length > 0 && <>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mt-2">Jugadores convocados</p>
          {convocados.map(c => {
            const pvals = matchObj?.playerValuations || [];
            const val = pvals.find(v => v.playerId === c.playerId) || {};
            const savePlayerVal = (field, value) => {
              const newVals = pvals.filter(v => v.playerId !== c.playerId);
              newVals.push({...val, playerId: c.playerId, playerName: c.playerName, [field]: value});
              const newMatches = matches.map(m => m.id !== matchObj.id ? m : {...m, playerValuations: newVals});
              saveValuation(matchObj.id, null, "__playerVals__", newVals, newMatches);
            };
            return (
              <Card key={c.playerId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{c.playerName}</span>
                  <Badge color={c.status==="titular"?"green":"blue"}>{c.status==="titular"?"Titular":"Suplente"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Nota (0-10)" type="number" step="0.1" min="0" max="10" value={val.nota || ""} onChange={e => savePlayerVal("nota", e.target.value)} />
                  <Input label="Coordinador" value={val.coordinador || coordProfile || ""} onChange={e => savePlayerVal("coordinador", e.target.value)} />
                </div>
                <Textarea label="Observación" value={val.comentario || ""} onChange={e => savePlayerVal("comentario", e.target.value)} rows={2} />
              </Card>
            );
          })}
        </>}
        {convocados.length === 0 && <p className="text-zinc-400 text-sm">No hay jugadores convocados en este partido.</p>}
        <Btn onClick={reset}>✓ Guardar y volver</Btn>
      </div>
    );
  }

  return null;
}


function EntrenadoresSection({ db, onSaveTeam, coordProfile }) {
  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0]);
  const [newCoachName, setNewCoachName] = useState("");
  const [statsCoach, setStatsCoach] = useState(null);
  const [attCoach, setAttCoach] = useState(null); // coach whose attendance panel is open
  const [tab, setTab] = useState("valoraciones"); // valoraciones | asistencia

  const teamData = db[selectedTeam] || { coaches: [], matches: [] };
  const coaches = teamData.coaches || [];
  const matches = (teamData.matches || []).sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Sessions = trainings + matches
  const sessions = [
    ...(teamData.trainings || []).map(t => ({ id: `t_${t.id}`, fecha: t.fecha, tipo: "Entrenamiento", desc: t.desc || "" })),
    ...(teamData.matches || []).map(m => ({ id: `m_${m.id}`, fecha: m.fecha, tipo: "Partido", desc: `vs ${m.rival}` })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const addCoach = () => {
    if (!newCoachName.trim()) return;
    const updated = [...coaches, { id: Date.now(), name: newCoachName.trim() }];
    onSaveTeam(selectedTeam, { ...teamData, coaches: updated });
    setNewCoachName("");
  };

  const delCoach = (id) => {
    onSaveTeam(selectedTeam, { ...teamData, coaches: coaches.filter(c => c.id !== id) });
  };

  const saveValuation = (matchId, coachId, field, value, prebuiltMatches) => {
    if (prebuiltMatches) {
      onSaveTeam(selectedTeam, { ...teamData, matches: prebuiltMatches });
      return;
    }
    const newMatches = (teamData.matches || []).map(m => {
      if (m.id !== matchId) return m;
      const vals = m.coachValuations || [];
      const idx = vals.findIndex(v => v.coachId === coachId);
      const updated = idx >= 0
        ? vals.map(v => v.coachId === coachId ? { ...v, [field]: value } : v)
        : [...vals, { coachId, nota: "", comentario: "", [field]: value }];
      return { ...m, coachValuations: updated };
    });
    onSaveTeam(selectedTeam, { ...teamData, matches: newMatches });
  };

  const deleteValuation = (matchId, coachId) => {
    const newMatches = (teamData.matches || []).map(m => {
      if (m.id !== matchId) return m;
      return { ...m, coachValuations: (m.coachValuations || []).filter(v => v.coachId !== coachId) };
    });
    onSaveTeam(selectedTeam, { ...teamData, matches: newMatches });
  };

  const getCoachHistory = (coachId) => {
    return matches
      .filter(m => m.coachValuations?.find(v => v.coachId === coachId && v.nota !== "" && v.nota !== undefined))
      .map(m => {
        const v = m.coachValuations.find(v => v.coachId === coachId);
        return { matchId: m.id, rival: m.rival, fecha: m.fecha, nota: parseFloat(v.nota), comentario: v.comentario || "", coordinador: v.coordinador || "" };
      });
  };

  const setAttRecord = (sessionId, coachId, status, fecha) => {
    const coachAtt = teamData.coachAttendance || [];
    const filtered = coachAtt.filter(a => !(a.sessionId === sessionId && a.coachId === coachId));
    filtered.push({ sessionId, coachId, status, fecha });
    onSaveTeam(selectedTeam, { ...teamData, coachAttendance: filtered });
  };

  const delAttRecord = (sessionId, coachId) => {
    const coachAtt = (teamData.coachAttendance || []).filter(a => !(a.sessionId === sessionId && a.coachId === coachId));
    onSaveTeam(selectedTeam, { ...teamData, coachAttendance: coachAtt });
  };

  const getCoachAttStats = (coachId) => {
    const recs = (teamData.coachAttendance || []).filter(a => a.coachId === coachId);
    return {
      present: recs.filter(r => r.status === "present").length,
      late: recs.filter(r => r.status === "late").length,
      absent: recs.filter(r => r.status === "absent").length,
    };
  };

  const attStatusOpts = [
    { val: "present", label: "Asistió", color: "green" },
    { val: "late", label: "Tarde", color: "yellow" },
    { val: "absent", label: "No asistió", color: "red" },
  ];

  const attBtnClass = (recStatus, val, color) => {
    if (recStatus === val) {
      if (color === "green") return "bg-green-800 border-green-600 text-green-200";
      if (color === "yellow") return "bg-yellow-800 border-yellow-600 text-yellow-200";
      return "bg-red-800 border-red-600 text-red-200";
    }
    return "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500";
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">Entrenadores</h2>

      {/* Team selector */}
      <div className="flex flex-wrap gap-2">
        {TEAMS.map(t => (
          <button key={t} onClick={() => setSelectedTeam(t)}
            className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedTeam === t ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
          >{t}</button>
        ))}
      </div>

      {/* Tab selector */}
      <div className="flex gap-2">
        <button onClick={() => setTab("valoraciones")}
          className={`px-4 py-2 rounded text-sm border transition-all ${tab === "valoraciones" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
        >⭐ Valoraciones</button>
        <button onClick={() => setTab("asistencia")}
          className={`px-4 py-2 rounded text-sm border transition-all ${tab === "asistencia" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
        >📋 Asistencia</button>
      </div>

      {/* Add coach - only visible in asistencia tab or no tab */}
      {tab !== "valoraciones" && (<Card>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Entrenadores de {selectedTeam}</p>
        <div className="flex gap-2">
          <input
            value={newCoachName}
            onChange={e => setNewCoachName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCoach()}
            placeholder="Nombre del entrenador"
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 flex-1"
          />
          <Btn onClick={addCoach}>+ Añadir</Btn>
        </div>
        <div className="mt-3 space-y-2">
          {coaches.length === 0 && <p className="text-zinc-500 text-sm">No hay entrenadores registrados.</p>}
          {coaches.map(c => {
            const stats = getCoachAttStats(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-2">
                <div>
                  <span className="text-white text-sm font-semibold">{c.name}</span>
                  {(stats.present + stats.absent + stats.late) > 0 && (
                    <div className="flex gap-2 text-xs mt-0.5">
                      <span className="text-green-400">✓ {stats.present}</span>
                      <span className="text-yellow-400">⏱ {stats.late}</span>
                      <span className="text-red-400">✗ {stats.absent}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <Btn small variant="ghost" onClick={() => setStatsCoach({ coach: c, team: selectedTeam })}>📈</Btn>
                  <Btn small variant="danger" onClick={() => delCoach(c.id)}>🗑️</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>)}

      {/* Valoraciones tab */}
      {tab === "valoraciones" && (
        <ValoracionesTab key={selectedTeam} matches={matches} coaches={coaches} coordProfile={coordProfile} saveValuation={saveValuation} deleteValuation={deleteValuation} players={teamData.players||[]} getCoachHistory={getCoachHistory} />
      )}

      {/* Asistencia tab */}
      {tab === "asistencia" && (
        <div className="space-y-3">
          {!attCoach ? (
            <>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Selecciona un entrenador</p>
              {coaches.length === 0 && <p className="text-zinc-500 text-sm">No hay entrenadores registrados.</p>}
              {coaches.map(c => {
                const stats = getCoachAttStats(c.id);
                return (
                  <Card key={c.id} className="hover:border-zinc-600 cursor-pointer transition-colors" onClick={() => setAttCoach(c)}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-semibold">{c.name}</p>
                        <div className="flex gap-3 text-xs mt-1">
                          <span className="text-green-400">✓ {stats.present} asistió</span>
                          <span className="text-yellow-400">⏱ {stats.late} tarde</span>
                          <span className="text-red-400">✗ {stats.absent} no asistió</span>
                        </div>
                      </div>
                      <span className="text-zinc-500">→</span>
                    </div>
                  </Card>
                );
              })}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Btn variant="ghost" onClick={() => setAttCoach(null)}>← Volver</Btn>
                <h3 className="text-white font-bold">{attCoach.name}</h3>
              </div>
              {(() => {
                const stats = getCoachAttStats(attCoach.id);
                const total = stats.present + stats.absent + stats.late;
                return total > 0 && (
                  <Card>
                    <div className="flex gap-4">
                      <div className="text-center"><div className="text-2xl font-black text-green-400">{stats.present}</div><div className="text-xs text-zinc-500">Asistió</div></div>
                      <div className="text-center"><div className="text-2xl font-black text-yellow-400">{stats.late}</div><div className="text-xs text-zinc-500">Tarde</div></div>
                      <div className="text-center"><div className="text-2xl font-black text-red-400">{stats.absent}</div><div className="text-xs text-zinc-500">No asistió</div></div>
                      <div className="text-center"><div className="text-2xl font-black text-white">{total}</div><div className="text-xs text-zinc-500">Total</div></div>
                    </div>
                    <div className="mt-3 flex h-2 rounded-full overflow-hidden gap-0.5">
                      {stats.present > 0 && <div className="bg-green-500" style={{ flex: stats.present }} />}
                      {stats.late > 0 && <div className="bg-yellow-500" style={{ flex: stats.late }} />}
                      {stats.absent > 0 && <div className="bg-red-600" style={{ flex: stats.absent }} />}
                    </div>
                  </Card>
                );
              })()}
              <div className="space-y-2">
                {sessions.length === 0 && <p className="text-zinc-500 text-sm">No hay sesiones registradas.</p>}
                {sessions.map(s => {
                  const rec = (teamData.coachAttendance || []).find(a => a.sessionId === s.id && a.coachId === attCoach.id);
                  return (
                    <Card key={s.id} className="flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-semibold">{s.fecha}</span>
                          <Badge color={s.tipo === "Partido" ? "red" : "blue"}>{s.tipo}</Badge>
                          <span className="text-zinc-400 text-xs truncate">{s.desc}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {attStatusOpts.map(opt => (
                          <button key={opt.val}
                            onClick={() => setAttRecord(s.id, attCoach.id, opt.val, s.fecha)}
                            className={`text-xs px-2 py-1 rounded border transition-all ${attBtnClass(rec?.status, opt.val, opt.color)}`}
                          >{opt.label}</button>
                        ))}
                        {rec && <Btn small variant="danger" onClick={() => delAttRecord(s.id, attCoach.id)}>✕</Btn>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats modal */}
      {statsCoach && (() => {
        const history = getCoachHistory(statsCoach.coach.id);
        const avg = history.length ? (history.reduce((s, h) => s + h.nota, 0) / history.length).toFixed(2) : null;
        return (
          <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-auto" onClick={() => setStatsCoach(null)}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg my-4" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                <div>
                  <h3 className="text-white font-bold text-lg">{statsCoach.coach.name}</h3>
                  <p className="text-zinc-400 text-sm">Evolución — {statsCoach.team}</p>
                </div>
                <div className="flex items-center gap-3">
                  {avg && (
                    <div className="text-center">
                      <div className="text-2xl font-black text-red-400">{avg}</div>
                      <div className="text-xs text-zinc-500">Media</div>
                    </div>
                  )}
                  <Btn small variant="secondary" onClick={() => setStatsCoach(null)}>✕</Btn>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {history.length === 0 && <p className="text-zinc-500 text-sm">Sin valoraciones todavía.</p>}
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-4 py-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-semibold">vs {h.rival}</span>
                        <span className="text-zinc-400 text-xs">📅 {h.fecha}</span>
                        {h.coordinador && <Badge color="blue">👤 {h.coordinador}</Badge>}
                      </div>
                      {h.comentario && <p className="text-zinc-400 text-xs">{h.comentario}</p>}
                    </div>
                    <div className={`text-xl font-black ${h.nota >= 7 ? "text-green-400" : h.nota >= 5 ? "text-yellow-400" : "text-red-400"}`}>
                      {h.nota.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Resumen (coordinadores)
// ══════════════════════════════════════════════════════════════════════════════
function ResumenSection({ db }) {
  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0]);
  const teamData = db[selectedTeam] || { matches: [] };
  const matches = (teamData.matches || []).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const parseResult = (resultado) => {
    if (!resultado) return null;
    const parts = resultado.split("-").map(n => parseInt(n.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return null;
    return parts;
  };

  const getResultBadge = (resultado) => {
    const parts = parseResult(resultado);
    if (!parts) return <Badge color="zinc">Sin resultado</Badge>;
    const [g, gc] = parts;
    if (g > gc) return <Badge color="green">Victoria</Badge>;
    if (g < gc) return <Badge color="red">Derrota</Badge>;
    return <Badge color="yellow">Empate</Badge>;
  };

  const stats = matches.reduce((acc, m) => {
    const parts = parseResult(m.resultado);
    if (!parts) return acc;
    const [g, gc] = parts;
    acc.gf += g; acc.gc += gc;
    if (g > gc) acc.v++;
    else if (g < gc) acc.d++;
    else acc.e++;
    return acc;
  }, { v: 0, e: 0, d: 0, gf: 0, gc: 0 });

  const total = stats.v + stats.e + stats.d;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Resumen de partidos</h2>

      {/* Team selector */}
      <div className="flex flex-wrap gap-2">
        {TEAMS.map(t => (
          <button key={t} onClick={() => setSelectedTeam(t)}
            className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedTeam === t ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
          >{t}</button>
        ))}
      </div>

      {/* Summary stats */}
      {total > 0 && (
        <Card>
          <div className="flex flex-wrap gap-6 justify-around text-center">
            <div>
              <div className="text-3xl font-black text-white">{total}</div>
              <div className="text-xs text-zinc-500 mt-1">Partidos</div>
            </div>
            <div>
              <div className="text-3xl font-black text-green-400">{stats.v}</div>
              <div className="text-xs text-zinc-500 mt-1">Victorias</div>
            </div>
            <div>
              <div className="text-3xl font-black text-yellow-400">{stats.e}</div>
              <div className="text-xs text-zinc-500 mt-1">Empates</div>
            </div>
            <div>
              <div className="text-3xl font-black text-red-400">{stats.d}</div>
              <div className="text-xs text-zinc-500 mt-1">Derrotas</div>
            </div>
            <div>
              <div className="text-3xl font-black text-blue-400">{stats.gf} — {stats.gc}</div>
              <div className="text-xs text-zinc-500 mt-1">GF — GC</div>
            </div>
          </div>
          {/* Win bar */}
          <div className="mt-4 flex h-3 rounded-full overflow-hidden gap-0.5">
            {stats.v > 0 && <div className="bg-green-500 transition-all" style={{ width: `${(stats.v/total)*100}%` }} />}
            {stats.e > 0 && <div className="bg-yellow-500 transition-all" style={{ width: `${(stats.e/total)*100}%` }} />}
            {stats.d > 0 && <div className="bg-red-600 transition-all" style={{ width: `${(stats.d/total)*100}%` }} />}
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span className="text-green-400">{Math.round((stats.v/total)*100)}% victorias</span>
            <span className="text-red-400">{Math.round((stats.d/total)*100)}% derrotas</span>
          </div>
        </Card>
      )}

      {/* Match list */}
      <div className="space-y-2">
        {matches.length === 0 && <p className="text-zinc-500 text-sm">No hay partidos registrados para {selectedTeam}.</p>}
        {matches.map(m => (
          <Card key={m.id} className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-white font-semibold">vs {m.rival}</span>
                {m.resultado ? (
                  <>
                    <span className="text-white font-black text-lg">{m.resultado}</span>
                    {getResultBadge(m.resultado)}
                  </>
                ) : (
                  <Badge color="zinc">Sin resultado</Badge>
                )}
              </div>
              <div className="flex gap-3 text-xs text-zinc-400">
                <span>📅 {m.fecha}</span>
                {m.lugar && <span>📍 {m.lugar}</span>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Informes del jugador (página completa)
// ══════════════════════════════════════════════════════════════════════════════
function InformesSection({ player, team, data, onSave, onBack }) {
  const [reportTitle, setReportTitle] = useState("");
  const [reportText, setReportText] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [editingReport, setEditingReport] = useState(null);

  const currentPlayer = (data.players || []).find(p => p.id === player.id) || player;

  const saveReport = () => {
    if (!reportText.trim()) return;
    const players = (data.players || []).map(p => {
      if (p.id !== currentPlayer.id) return p;
      const reports = p.reports || [];
      if (editingReport) {
        return { ...p, reports: reports.map(r => r.id === editingReport.id ? { ...r, title: reportTitle, text: reportText, fecha: reportDate } : r) };
      }
      return { ...p, reports: [{ id: Date.now(), title: reportTitle, text: reportText, fecha: reportDate }, ...reports] };
    });
    onSave({ ...data, players });
    setReportTitle(""); setReportText(""); setEditingReport(null);
    setReportDate(new Date().toISOString().split("T")[0]);
  };

  const delReport = (reportId) => {
    if (!window.confirm("¿Eliminar informe?")) return;
    const players = (data.players || []).map(p =>
      p.id !== currentPlayer.id ? p : { ...p, reports: (p.reports || []).filter(r => r.id !== reportId) }
    );
    onSave({ ...data, players });
  };

  const openEditReport = (r) => {
    setEditingReport(r);
    setReportTitle(r.title || "");
    setReportText(r.text);
    setReportDate(r.fecha);
  };

  const posColorMap = {
    Portero: "text-yellow-400", Defensa: "text-blue-400",
    Mediocentro: "text-green-400", Delantero: "text-red-400",
  };

  const getPosColor = (p) => {
    const pp = p.posicionPrincipal || (p.positions||[])[0] || "";
    if (pp === "Portero") return posColorMap.Portero;
    if (["Lateral Derecho","Central","Lateral Izquierdo","Carrilero Derecho","Carrilero Izquierdo","Defensa"].includes(pp)) return posColorMap.Defensa;
    if (["Mediocentro","Mediocentro Defensivo","Mediocentro Ofensivo","Interior Derecho","Interior Izquierdo"].includes(pp)) return posColorMap.Mediocentro;
    if (["Extremo Derecho","Extremo Izquierdo","Delantero","Falso Nueve"].includes(pp)) return posColorMap.Delantero;
    return "text-zinc-400";
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Btn variant="secondary" small onClick={onBack}>← Volver a Plantilla</Btn>
        <div>
          <h2 className="text-xl font-bold text-white">
            📋 Informes — {currentPlayer.name}
            {currentPlayer.dorsal && <span className={`ml-2 text-base font-black ${getPosColor(currentPlayer)}`}>#{currentPlayer.dorsal}</span>}
          </h2>
          <p className="text-zinc-500 text-xs">{team} · {currentPlayer.posicionPrincipal || "Sin posición"}</p>
        </div>
      </div>

      {/* New / edit report form */}
      <Card className="border-zinc-700">
        <h3 className="text-sm font-bold text-zinc-300 mb-4">{editingReport ? "✏️ Editar informe" : "📝 Nuevo informe"}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
            <Input label="Título (opcional)" value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="Ej: Partido vs Valencia" />
          </div>
          <Textarea label="Informe" value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Escribe el informe del jugador aquí..." rows={5} />
          <div className="flex gap-2">
            <Btn onClick={saveReport}>{editingReport ? "Actualizar informe" : "Añadir informe"}</Btn>
            {editingReport && (
              <Btn variant="secondary" onClick={() => { setEditingReport(null); setReportTitle(""); setReportText(""); setReportDate(new Date().toISOString().split("T")[0]); }}>
                Cancelar
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Reports list */}
      <div className="space-y-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
          Historial de informes ({(currentPlayer.reports || []).length})
        </p>
        {(currentPlayer.reports || []).length === 0 && (
          <p className="text-zinc-600 text-sm">No hay informes todavía para este jugador.</p>
        )}
        {(currentPlayer.reports || []).map(r => (
          <Card key={r.id} className="border-zinc-800">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <span className="text-red-400 text-xs font-bold bg-red-900/30 border border-red-800/50 px-2 py-1 rounded">{r.fecha}</span>
                {r.title && <span className="text-white text-sm font-semibold">{r.title}</span>}
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Btn small variant="secondary" onClick={() => openEditReport(r)}>✏️</Btn>
                <Btn small variant="danger" onClick={() => delReport(r.id)}>🗑️</Btn>
              </div>
            </div>
            <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{r.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Convocatoria
// ══════════════════════════════════════════════════════════════════════════════
function ConvocatoriaContent({ team, data, onSave, isCoord, db }) {
  const TEAMS = ["Escoleta","Prebenjamín","Benjamín C","Benjamín B","Benjamín A","Alevín B","Alevín A","Transición","Infantil B","Infantil A","Cadete","Juvenil"];
  const [convocatorias, setConvocatorias] = React.useState([]);
  const [vista, setVista] = React.useState("lista"); // "lista" | "nueva" | "ver"
  const [nombre, setNombre] = React.useState("");
  const [fechaConv, setFechaConv] = React.useState(new Date().toISOString().split("T")[0]);
  const [equipoFiltro, setEquipoFiltro] = React.useState(team);
  const [seleccionados, setSeleccionados] = React.useState([]);
  const [convActual, setConvActual] = React.useState(null);
  const [mostrarDorsal, setMostrarDorsal] = React.useState(true);
  const [mostrarTelefono, setMostrarTelefono] = React.useState(false);
  const [mostrarDNI, setMostrarDNI] = React.useState(false);
  const [mostrarFechaNac, setMostrarFechaNac] = React.useState(false);

  const convocatoriasGuardadas = data.convocatorias || [];

  const jugadoresEquipo = (eq) => (db[eq]?.players || []).map(p => ({ ...p, equipo: eq }));

  const toggleJugador = (p) => {
    const key = p.equipo + "_" + p.id;
    setSeleccionados(prev =>
      prev.find(s => s.equipo + "_" + s.id === key)
        ? prev.filter(s => s.equipo + "_" + s.id !== key)
        : [...prev, p]
    );
  };

  const isSelected = (p) => !!seleccionados.find(s => s.equipo + "_" + s.id === p.equipo + "_" + p.id);

  const guardar = () => {
    if (!nombre.trim() || seleccionados.length === 0) return;
    const nueva = { id: Date.now(), nombre, fecha: fechaConv, jugadores: seleccionados.map(p => ({ id: p.id, equipo: p.equipo })) };
    const updated = [...convocatoriasGuardadas, nueva];
    onSave({ ...data, convocatorias: updated });
    setVista("lista");
    setNombre("");
    setSeleccionados([]);
  };

  const eliminar = (id) => {
    if (!window.confirm("¿Eliminar convocatoria?")) return;
    onSave({ ...data, convocatorias: convocatoriasGuardadas.filter(c => c.id !== id) });
  };

  const resolveJugadores = (conv) => {
    return (conv.jugadores || []).map(ref => {
      const jugador = (db[ref.equipo]?.players || []).find(p => p.id === ref.id);
      return jugador ? { ...jugador, equipo: ref.equipo } : null;
    }).filter(Boolean);
  };

  const generarPDF = (conv) => {
    const jugadoresResueltos = resolveJugadores(conv);
    conv = { ...conv, jugadores: jugadoresResueltos };
    const campos = [];
    if (mostrarDorsal) campos.push("Dorsal");
    if (mostrarTelefono) campos.push("Teléfono");
    if (mostrarDNI) campos.push("DNI");
    if (mostrarFechaNac) campos.push("F. Nacimiento");

    const equipos = [...new Set(conv.jugadores.map(j => j.equipo))];
    let html = `<html><head><style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 13px; color: #666; margin-bottom: 16px; font-weight: normal; }
      h3 { font-size: 14px; margin: 16px 0 6px; color: #c00; border-bottom: 1px solid #eee; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 12px; }
      td { padding: 5px 8px; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
      tr:nth-child(even) td { background: #fafafa; }
    </style></head><body>
    <h1>📋 ${conv.nombre}</h1>
    <h2>Fecha: ${conv.fecha} · Total jugadores: ${conv.jugadores.length}</h2>`;

    equipos.forEach(eq => {
      const jEq = conv.jugadores.filter(j => j.equipo === eq);
      html += `<h3>${eq} (${jEq.length})</h3><table><tr><th>Nombre</th><th>Posición</th>`;
      campos.forEach(c => { html += `<th>${c}</th>`; });
      html += `</tr>`;
      jEq.forEach(j => {
        html += `<tr><td>${j.name}</td><td>${j.posicionPrincipal || (j.positions||[])[0] || "—"}</td>`;
        if (mostrarDorsal) html += `<td>${j.dorsal || "—"}</td>`;
        if (mostrarTelefono) html += `<td>${j.telefono || "—"}</td>`;
        if (mostrarDNI) html += `<td>${j.dni || "—"}</td>`;
        if (mostrarFechaNac) html += `<td>${j.fechaNacimiento || "—"}</td>`;
        html += `</tr>`;
      });
      html += `</table>`;
    });
    html += `</body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    w.print();
  };

  // ── VISTA LISTA ─────────────────────────────────────────────────────────
  if (vista === "lista") return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">Convocatorias guardadas</h2>
        {isCoord && <button onClick={() => setVista("nueva")} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">+ Nueva convocatoria</button>}
      </div>
      {convocatoriasGuardadas.length === 0 ? (
        <div className="text-zinc-500 text-sm text-center py-12">No hay convocatorias guardadas aún.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {convocatoriasGuardadas.map(c => (
            <div key={c.id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">{c.nombre}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{c.fecha} · {resolveJugadores(c).length} jugadores</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setConvActual(c); setVista("ver"); }} className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Ver</button>
                {isCoord && <button onClick={() => {
                  setNombre(c.nombre);
                  setFechaConv(c.fecha);
                  setSeleccionados(c.jugadores);
                  setConvActual(c);
                  setVista("editar");
                }} className="bg-blue-900/50 hover:bg-blue-800 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-semibold">Editar</button>}
                {isCoord && <button onClick={() => eliminar(c.id)} className="bg-red-900/50 hover:bg-red-800 text-red-300 px-3 py-1.5 rounded-lg text-xs font-semibold">Eliminar</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const guardarEdicion = () => {
    if (!nombre.trim() || seleccionados.length === 0) return;
    const updated = convocatoriasGuardadas.map(c =>
      c.id === convActual.id ? { ...c, nombre, fecha: fechaConv, jugadores: seleccionados.map(p => ({ id: p.id, equipo: p.equipo })) } : c
    );
    onSave({ ...data, convocatorias: updated });
    setVista("lista");
    setNombre("");
    setSeleccionados([]);
    setConvActual(null);
  };

  // ── VISTA NUEVA ─────────────────────────────────────────────────────────
  if (vista === "nueva") return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setVista("lista")} className="text-zinc-400 hover:text-white text-sm">← Volver</button>
        <h2 className="text-lg font-bold text-white">Nueva convocatoria</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Nombre</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Torneo 2026, Jornada 1..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Fecha</label>
          <input type="date" value={fechaConv} onChange={e => setFechaConv(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Filtrar por equipo</label>
        <div className="flex flex-wrap gap-2">
          {["Escoleta","Prebenjamín","Benjamín C","Benjamín B","Benjamín A","Alevín B","Alevín A","Transición","Infantil B","Infantil A","Cadete","Juvenil"].map(eq => (
            <button key={eq} onClick={() => setEquipoFiltro(eq)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${equipoFiltro === eq ? "bg-orange-600 border-orange-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
              {eq}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Jugadores de {equipoFiltro} — Seleccionados: {seleccionados.length}</div>
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {jugadoresEquipo(equipoFiltro).length === 0 ? (
            <div className="text-zinc-600 text-sm py-4 text-center">No hay jugadores en este equipo</div>
          ) : jugadoresEquipo(equipoFiltro).map(p => (
            <div key={p.id} onClick={() => toggleJugador(p)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-all ${isSelected(p) ? "bg-orange-900/30 border-orange-600" : "bg-zinc-800 border-zinc-700 hover:border-zinc-500"}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected(p) ? "bg-orange-500 border-orange-500" : "border-zinc-500"}`}>
                {isSelected(p) && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="text-white text-sm font-medium">{p.name}</span>
              <span className="text-zinc-400 text-xs">{p.posicionPrincipal || (p.positions||[])[0] || "—"}</span>
              {p.dorsal && <span className="text-zinc-500 text-xs ml-auto">#{p.dorsal}</span>}
            </div>
          ))}
        </div>
      </div>

      {seleccionados.length > 0 && (
        <div className="mb-4 bg-zinc-800/50 border border-zinc-700 rounded-xl p-3">
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Seleccionados ({seleccionados.length})</div>
          <div className="flex flex-wrap gap-2">
            {seleccionados.map(p => (
              <span key={p.equipo+"_"+p.id} className="bg-orange-900/40 border border-orange-700 text-orange-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {p.name} <span className="text-orange-500 text-xs">({p.equipo})</span>
                <button onClick={() => toggleJugador(p)} className="ml-1 text-orange-400 hover:text-white">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={guardar} disabled={!nombre.trim() || seleccionados.length === 0}
          className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-semibold">
          💾 Guardar convocatoria
        </button>
        <button onClick={() => { setVista("lista"); setNombre(""); setSeleccionados([]); }}
          className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );

  // ── VISTA EDITAR ────────────────────────────────────────────────────────
  if (vista === "editar") return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setVista("lista")} className="text-zinc-400 hover:text-white text-sm">← Volver</button>
        <h2 className="text-lg font-bold text-white">Editar convocatoria</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Nombre</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Fecha</label>
          <input type="date" value={fechaConv} onChange={e => setFechaConv(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>
      </div>
      <div className="mb-3">
        <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Filtrar por equipo</label>
        <div className="flex flex-wrap gap-2">
          {["Escoleta","Prebenjamín","Benjamín C","Benjamín B","Benjamín A","Alevín B","Alevín A","Transición","Infantil B","Infantil A","Cadete","Juvenil"].map(eq => (
            <button key={eq} onClick={() => setEquipoFiltro(eq)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${equipoFiltro === eq ? "bg-orange-600 border-orange-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
              {eq}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Jugadores de {equipoFiltro} — Seleccionados: {seleccionados.length}</div>
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {jugadoresEquipo(equipoFiltro).length === 0 ? (
            <div className="text-zinc-600 text-sm py-4 text-center">No hay jugadores en este equipo</div>
          ) : jugadoresEquipo(equipoFiltro).map(p => (
            <div key={p.id} onClick={() => toggleJugador(p)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-all ${isSelected(p) ? "bg-orange-900/30 border-orange-600" : "bg-zinc-800 border-zinc-700 hover:border-zinc-500"}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected(p) ? "bg-orange-500 border-orange-500" : "border-zinc-500"}`}>
                {isSelected(p) && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="text-white text-sm font-medium">{p.name}</span>
              <span className="text-zinc-400 text-xs">{p.posicionPrincipal || (p.positions||[])[0] || "—"}</span>
              {p.dorsal && <span className="text-zinc-500 text-xs ml-auto">#{p.dorsal}</span>}
            </div>
          ))}
        </div>
      </div>
      {seleccionados.length > 0 && (
        <div className="mb-4 bg-zinc-800/50 border border-zinc-700 rounded-xl p-3">
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Seleccionados ({seleccionados.length})</div>
          <div className="flex flex-wrap gap-2">
            {seleccionados.map(p => (
              <span key={p.equipo+"_"+p.id} className="bg-orange-900/40 border border-orange-700 text-orange-300 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {p.name} <span className="text-orange-500 text-xs">({p.equipo})</span>
                <button onClick={() => toggleJugador(p)} className="ml-1 text-orange-400 hover:text-white">×</button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={guardarEdicion} disabled={!nombre.trim() || seleccionados.length === 0}
          className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-semibold">
          💾 Guardar cambios
        </button>
        <button onClick={() => { setVista("lista"); setNombre(""); setSeleccionados([]); setConvActual(null); }}
          className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );

  // ── VISTA VER ────────────────────────────────────────────────────────────
  const jugadoresResueltos = convActual ? resolveJugadores(convActual) : [];
  if (vista === "ver" && convActual) return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setVista("lista")} className="text-zinc-400 hover:text-white text-sm">← Volver</button>
        <div>
          <h2 className="text-lg font-bold text-white">{convActual.nombre}</h2>
          <div className="text-xs text-zinc-400">{convActual.fecha} · {jugadoresResueltos.length} jugadores</div>
        </div>
      </div>

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 mb-4">
        <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">Campos en el PDF</div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Dorsal", val: mostrarDorsal, set: setMostrarDorsal },
            { label: "Teléfono", val: mostrarTelefono, set: setMostrarTelefono },
            { label: "DNI", val: mostrarDNI, set: setMostrarDNI },
            { label: "F. Nacimiento", val: mostrarFechaNac, set: setMostrarFechaNac },
          ].map(({ label, val, set }) => (
            <button key={label} onClick={() => set(!val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${val ? "bg-orange-600 border-orange-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
              {val ? "✓" : "+"} {label}
            </button>
          ))}
        </div>
      </div>

      {[...new Set(jugadoresResueltos.map(j => j.equipo))].map(eq => (
        <div key={eq} className="mb-4">
          <div className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">{eq} ({jugadoresResueltos.filter(j => j.equipo === eq).length})</div>
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left px-3 py-2 text-xs text-zinc-500 font-semibold uppercase">Nombre</th>
                  <th className="text-left px-3 py-2 text-xs text-zinc-500 font-semibold uppercase">Posición</th>
                  {mostrarDorsal && <th className="text-left px-3 py-2 text-xs text-zinc-500 font-semibold uppercase">Dorsal</th>}
                  {mostrarTelefono && <th className="text-left px-3 py-2 text-xs text-zinc-500 font-semibold uppercase">Teléfono</th>}
                  {mostrarDNI && <th className="text-left px-3 py-2 text-xs text-zinc-500 font-semibold uppercase">DNI</th>}
                  {mostrarFechaNac && <th className="text-left px-3 py-2 text-xs text-zinc-500 font-semibold uppercase">F. Nac.</th>}
                </tr>
              </thead>
              <tbody>
                {jugadoresResueltos.filter(j => j.equipo === eq).map(j => (
                  <tr key={j.id} className="border-b border-zinc-700/50">
                    <td className="px-3 py-2 text-sm text-white">{j.name}</td>
                    <td className="px-3 py-2 text-sm text-zinc-300">{j.posicionPrincipal || (j.positions||[])[0] || "—"}</td>
                    {mostrarDorsal && <td className="px-3 py-2 text-sm text-zinc-300">{j.dorsal || "—"}</td>}
                    {mostrarTelefono && <td className="px-3 py-2 text-sm text-zinc-300">{j.telefono || "—"}</td>}
                    {mostrarDNI && <td className="px-3 py-2 text-sm text-zinc-300">{j.dni || "—"}</td>}
                    {mostrarFechaNac && <td className="px-3 py-2 text-sm text-zinc-300">{j.fechaNacimiento || "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <button onClick={() => generarPDF(convActual)}
        className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm mt-2">
        📄 Generar PDF
      </button>
    </div>
  );

  return null;
}

// SECTION: Jugadores Probando
// ══════════════════════════════════════════════════════════════════════════════
function ProbandoContent({ team, data, onSave, isCoord }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [dorsal, setDorsal] = useState("");
  const [positions, setPositions] = useState([]);
  const [posicionPrincipal, setPosicionPrincipal] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dni, setDni] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [fechaPrueba, setFechaPrueba] = useState(new Date().toISOString().split("T")[0]);
  const [estadoPrueba, setEstadoPrueba] = useState("pendiente");
  const [notas, setNotas] = useState("");
  const [search, setSearch] = useState("");
  const [notasPlayer, setNotasPlayer] = useState(null);

  const ESTADOS = [
    { val: "pendiente",  label: "Pendiente",  color: "bg-zinc-800 border-zinc-600 text-zinc-300" },
    { val: "aceptado",   label: "Aceptado",   color: "bg-green-900/40 border-green-700 text-green-300" },
    { val: "rechazado",  label: "Rechazado",  color: "bg-red-900/40 border-red-700 text-red-300" },
    { val: "seguimiento",label: "Seguimiento",color: "bg-blue-900/40 border-blue-700 text-blue-300" },
  ];

  const posColorMap = {
    Portero:        { bg: "bg-yellow-900/30", text: "text-yellow-300", border: "border-yellow-700/50", dot: "bg-yellow-400" },
    Defensa:        { bg: "bg-blue-900/30",   text: "text-blue-300",   border: "border-blue-700/50",   dot: "bg-blue-400" },
    Mediocentro:    { bg: "bg-green-900/30",  text: "text-green-300",  border: "border-green-700/50",  dot: "bg-green-400" },
    Delantero:      { bg: "bg-red-900/30",    text: "text-red-300",    border: "border-red-700/50",    dot: "bg-red-400" },
    "Sin posición": { bg: "bg-zinc-800/50",   text: "text-zinc-400",   border: "border-zinc-700/50",   dot: "bg-zinc-500" },
  };

  const getPosGroup = (p) => {
    const pp = p.posicionPrincipal || (p.positions||[])[0] || "";
    if (pp === "Portero") return "Portero";
    if (["Lateral Derecho","Central","Lateral Izquierdo","Carrilero Derecho","Carrilero Izquierdo","Defensa"].includes(pp)) return "Defensa";
    if (["Mediocentro","Mediocentro Defensivo","Mediocentro Ofensivo","Interior Derecho","Interior Izquierdo"].includes(pp)) return "Mediocentro";
    if (["Extremo Derecho","Extremo Izquierdo","Delantero","Falso Nueve"].includes(pp)) return "Delantero";
    if (["Portero","Defensa","Mediocentro","Delantero"].includes(pp)) return pp;
    return "Sin posición";
  };

  const getEstadoInfo = (val) => ESTADOS.find(e => e.val === val) || ESTADOS[0];

  const setJugadorEstado = (id, estado) => {
    const probando = (data.probando || []).map(p => p.id !== id ? p : { ...p, estadoPrueba: estado });
    onSave({ ...data, probando });
  };

  const open = (p = null) => {
    setEditing(p);
    setName(p ? p.name : "");
    setDorsal(p ? (p.dorsal || "") : "");
    setPositions(p ? (p.positions || []) : []);
    setPosicionPrincipal(p ? (p.posicionPrincipal || "") : "");
    setTelefono(p ? (p.telefono || "") : "");
    setDni(p ? (p.dni || "") : "");
    setFechaNacimiento(p ? (p.fechaNacimiento || "") : "");
    setFechaPrueba(p ? (p.fechaPrueba || new Date().toISOString().split("T")[0]) : new Date().toISOString().split("T")[0]);
    setEstadoPrueba(p ? (p.estadoPrueba || "pendiente") : "pendiente");
    setNotas(p ? (p.notas || "") : "");
    setShowForm(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const probando = [...(data.probando || [])];
    const playerData = { name, dorsal, positions, posicionPrincipal, telefono, dni, fechaNacimiento, fechaPrueba, estadoPrueba, notas };
    if (editing) {
      const idx = probando.findIndex(p => p.id === editing.id);
      probando[idx] = { ...editing, ...playerData };
    } else {
      probando.push({ id: Date.now(), ...playerData });
    }
    onSave({ ...data, probando });
    setShowForm(false);
  };

  const del = (id) => {
    if (!window.confirm("¿Eliminar jugador en prueba?")) return;
    onSave({ ...data, probando: (data.probando || []).filter(p => p.id !== id) });
  };

  const pasarAPlantilla = (p) => {
    if (!window.confirm(`¿Pasar a ${p.name} a la plantilla oficial?`)) return;
    const players = [...(data.players || [])];
    players.push({ id: Date.now(), name: p.name, dorsal: p.dorsal, positions: p.positions, posicionPrincipal: p.posicionPrincipal, telefono: p.telefono, dni: p.dni });
    const probando = (data.probando || []).filter(x => x.id !== p.id);
    onSave({ ...data, players, probando });
  };

  const togglePos = (pos) => {
    setPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };

  const filtered = (data.probando || []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const POSICIONES_ORDEN = ["Portero","Defensa","Mediocentro","Delantero","Sin posición"];
  const posLabel = { Portero: "Porteros", Defensa: "Defensas", Mediocentro: "Centrocampistas", Delantero: "Delanteros", "Sin posición": "Sin posición" };

  const grouped = POSICIONES_ORDEN.map(pos => ({
    pos,
    players: filtered.filter(p => getPosGroup(p) === pos)
      .sort((a,b) => (a.fechaPrueba || "").localeCompare(b.fechaPrueba || ""))
  })).filter(g => g.players.length > 0);

  const totales = {
    total: (data.probando || []).length,
    pendiente: (data.probando || []).filter(p => (p.estadoPrueba||"pendiente") === "pendiente").length,
    aceptado: (data.probando || []).filter(p => p.estadoPrueba === "aceptado").length,
    rechazado: (data.probando || []).filter(p => p.estadoPrueba === "rechazado").length,
    seguimiento: (data.probando || []).filter(p => p.estadoPrueba === "seguimiento").length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Jugadores Probando — {team}</h2>
          <p className="text-zinc-500 text-xs mt-0.5">Jugadores externos en periodo de prueba</p>
        </div>
        <Btn onClick={() => open()}>+ Añadir jugador</Btn>
      </div>

      {/* Resumen de estados */}
      {totales.total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-zinc-800/60 rounded-lg p-3 text-center border border-zinc-700/50">
            <div className="text-lg font-black text-white">{totales.pendiente}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Pendiente</div>
          </div>
          <div className="bg-blue-900/20 rounded-lg p-3 text-center border border-blue-800/40">
            <div className="text-lg font-black text-blue-300">{totales.seguimiento}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Seguimiento</div>
          </div>
          <div className="bg-green-900/20 rounded-lg p-3 text-center border border-green-800/40">
            <div className="text-lg font-black text-green-300">{totales.aceptado}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Aceptado</div>
          </div>
          <div className="bg-red-900/20 rounded-lg p-3 text-center border border-red-800/40">
            <div className="text-lg font-black text-red-300">{totales.rechazado}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Rechazado</div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card className="border-blue-900/50">
          <h3 className="text-sm font-bold text-zinc-300 mb-4">{editing ? "Editar jugador en prueba" : "Nuevo jugador en prueba"}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input label="Nombre" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Dorsal (opcional)" type="number" value={dorsal} onChange={e => setDorsal(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input label="Teléfono" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />
            <Input label="DNI" value={dni} onChange={e => setDni(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input label="Fecha de nacimiento" type="date" value={fechaNacimiento} onChange={e => setFechaNacimiento(e.target.value)} />
            <Input label="Fecha de prueba" type="date" value={fechaPrueba} onChange={e => setFechaPrueba(e.target.value)} />
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Estado</label>
              <div className="flex flex-wrap gap-1">
                {ESTADOS.map(e => (
                  <button key={e.val} onClick={() => setEstadoPrueba(e.val)}
                    className={`text-xs px-2 py-1 rounded border transition-all ${estadoPrueba === e.val ? e.color : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}
                  >{e.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Posición principal</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {["Portero","Defensa","Mediocentro","Delantero"].map(pos => {
                const c = posColorMap[pos];
                return (
                  <button key={pos} onClick={() => { setPosicionPrincipal(pos); setPositions(prev => prev.includes(pos) ? prev : [pos, ...prev.filter(p=>p!==pos)]); }}
                    className={`text-xs px-3 py-1.5 rounded border transition-all font-medium ${posicionPrincipal===pos ? `${c.bg} ${c.border} ${c.text}` : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                  >{pos}</button>
                );
              })}
            </div>
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Posiciones alternativas</label>
            <div className="flex flex-wrap gap-1">
              {POSITIONS.map(pos => (
                <button key={pos} onClick={() => togglePos(pos)}
                  className={`text-xs px-2 py-1 rounded border transition-all ${positions.includes(pos) ? "bg-zinc-600 border-zinc-400 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                >{pos}</button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <Textarea label="Notas / Valoración" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones sobre el jugador..." rows={3} />
          </div>
          <div className="flex gap-2">
            <Btn onClick={save}>Guardar</Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      {/* Search */}
      <Input placeholder="🔍 Buscar jugador por nombre..." value={search} onChange={e => setSearch(e.target.value)} />

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm">{search ? `No hay jugadores con "${search}"` : "No hay jugadores en prueba todavía."}</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ pos, players }) => {
            const c = posColorMap[pos] || posColorMap["Sin posición"];
            return (
              <div key={pos}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`}></div>
                  <span className={`text-xs font-bold uppercase tracking-widest ${c.text}`}>
                    {posLabel[pos] || pos} ({players.length})
                  </span>
                </div>
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800">
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Nombre</th>
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider hidden sm:table-cell">Posición</th>
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider hidden sm:table-cell">Fecha prueba</th>
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Estado</th>
                        <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider hidden md:table-cell">Teléfono</th>
                        <th className="text-right px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p, idx) => {
                        const estado = getEstadoInfo(p.estadoPrueba || "pendiente");
                        return (
                          <tr key={p.id}
                            className={`border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/40 ${idx % 2 === 0 ? "bg-zinc-900/30" : "bg-zinc-900/60"}`}
                          >
                            <td className="px-3 py-3">
                              <div>
                                <span className="text-white font-semibold">{p.name}</span>
                                {p.dorsal && <span className={`ml-2 text-xs font-bold ${c.text}`}>#{p.dorsal}</span>}
                                {p.notas && (
                                  <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-[160px]">{p.notas}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell">
                              {p.posicionPrincipal
                                ? <span className={`text-xs px-2 py-1 rounded-full border font-medium ${c.bg} ${c.border} ${c.text}`}>{p.posicionPrincipal}</span>
                                : <span className="text-zinc-600 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell">
                              <span className="text-zinc-400 text-xs">{p.fechaPrueba || "—"}</span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1">
                                {ESTADOS.map(e => (
                                  <button key={e.val}
                                    onClick={() => setJugadorEstado(p.id, e.val)}
                                    className={`text-xs px-2 py-0.5 rounded border transition-all ${
                                      (p.estadoPrueba || "pendiente") === e.val
                                        ? e.color
                                        : "bg-transparent border-zinc-700/50 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400"
                                    }`}
                                  >{e.label}</button>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <span className="text-zinc-300 text-sm font-mono">{p.telefono || <span className="text-zinc-600">—</span>}</span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex gap-1 justify-end">
                                <Btn small variant="ghost" onClick={() => pasarAPlantilla(p)} title="Pasar a plantilla oficial">✅</Btn>
                                <Btn small variant="secondary" onClick={() => open(p)} title="Editar">✏️</Btn>
                                <Btn small variant="danger" onClick={() => del(p.id)} title="Eliminar">🗑️</Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {grouped.length === 0 && filtered.length > 0 && (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase">Nombre</th>
                    <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase">Fecha prueba</th>
                    <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase">Estado</th>
                    <th className="text-right px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, idx) => {
                    const estado = getEstadoInfo(p.estadoPrueba || "pendiente");
                    return (
                      <tr key={p.id} className={`border-b border-zinc-800/60 hover:bg-zinc-800/40 ${idx%2===0?"bg-zinc-900/30":"bg-zinc-900/60"}`}>
                        <td className="px-3 py-3"><span className="text-white font-semibold">{p.name}</span></td>
                        <td className="px-3 py-3"><span className="text-zinc-400 text-xs">{p.fechaPrueba || "—"}</span></td>
                        <td className="px-3 py-3"><span className={`text-xs px-2 py-0.5 rounded border font-medium ${estado.color}`}>{estado.label}</span></td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 justify-end">
                            <Btn small variant="ghost" onClick={() => pasarAPlantilla(p)} title="Pasar a plantilla">✅</Btn>
                            <Btn small variant="secondary" onClick={() => open(p)}>✏️</Btn>
                            <Btn small variant="danger" onClick={() => del(p.id)}>🗑️</Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function App() {
  const [authState, setAuthState] = useState("login"); // login | app
  const [role, setRole] = useState(null); // coordinator | trainer
  const [teamAccess, setTeamAccess] = useState(null);
  const [password, setPassword] = useState("");
  const [teamPasswords, setTeamPasswords] = useState({});
  const [globalTasks, setGlobalTasks] = useState([]);
  const [coordProfile, setCoordProfile] = useState("");
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [teamInput, setTeamInput] = useState("Coordinador");
  const [loginError, setLoginError] = useState("");

  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);

  const [activeTeam, setActiveTeam] = useState(null);
  const [activeSection, setActiveSection] = useState("plantilla");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [informesPlayer, setInformesPlayer] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setInformesPlayer(e.detail);
      setActiveSection("informes");
    };
    window.addEventListener("openInformes", handler);
    return () => window.removeEventListener("openInformes", handler);
  }, []);

  const isCoord = role === "coordinator";

  const sections = [
    ...(isCoord ? [{ id: "resumen", label: "Resumen", icon: "📊" }] : []),
    ...(isCoord ? [{ id: "entrenadores", label: "Entrenadores", icon: "🧑‍🏫" }] : []),
    ...(isCoord ? [{ id: "gestion", label: "Ajustes", icon: "⚙️" }] : []),
    ...(isCoord ? [{ id: "mejoresrivales", label: "Mejores Rivales", icon: "⭐" }] : []),
    { id: "plantilla", label: "Plantilla", icon: "👥" },
    { id: "entrenamientos", label: "Entrenamientos", icon: "🏃" },
    { id: "tareas", label: "Tareas", icon: "🗂" },
    { id: "partidos", label: "Partidos", icon: "⚽" },
    { id: "clasificacion", label: "Clasificaciones", icon: "🏆" },
    { id: "asistencia", label: "Asistencia", icon: "📋" },
    { id: "tacticas", label: "Tácticas", icon: "🎬" },
  ];

  useEffect(() => {
    Promise.all([loadData(), loadSeasons()]).then(([d, s]) => {
      // load passwords
      try { const raw = localStorage.getItem("cdmag_passwords"); if(raw) setTeamPasswords(JSON.parse(raw)); } catch(e) {}
      // globalTasks se carga de Firebase via loadData
      const dbData = d || initState();
      setDb(dbData);
      if (dbData.__globalTasks) setGlobalTasks(dbData.__globalTasks);
      setSeasons(s || []);
      setLoading(false);
    });
  }, []);

  const TEAM_PASSWORDS = {
    "Escoleta": "KFW",
    "Prebenjamín": "ZBN",
    "Benjamín C": "TXR",
    "Benjamín B": "PLH",
    "Benjamín A": "DJV",
    "Alevín B": "WCQ",
    "Alevín A": "NYS",
    "Transición": "HQV",
    "Infantil B": "RGK",
    "Infantil A": "BTP",
    "Cadete": "XMJ",
    "Juvenil": "FVL",
  };

  const login = () => {
    if (teamInput === "Coordinador" && password === "MGD") {
      setRole("coordinator");
      setTeamAccess(null);
      setActiveTeam(TEAMS[0]);
      setActiveSection("resumen");
      setShowProfilePicker(true);
    } else if (teamInput !== "Coordinador" && ({...TEAM_PASSWORDS, ...teamPasswords})[teamInput] === password) {
      setRole("trainer");
      setTeamAccess(teamInput);
      setActiveTeam(teamInput);
      setAuthState("app");
    } else {
      setLoginError("Contraseña incorrecta.");
    }
  };

  const updateTeamData = async (team, newData) => {
    if (window._setSaving) window._setSaving(true);
    let freshDb;
    try {
      freshDb = await loadData();
      if (freshDb) setDb(freshDb);
    } catch(e) {
      freshDb = db;
    }
    const cleanTeam = (d) => ({
      ...d,
      trainings: (d.trainings || []).map(t => ({
        ...t,
        tasks: (t.tasks || []).map(task => ({
          ...task,
          pizarra: (task.pizarra || []).filter(el => el != null && el.type).map(el => (
            el.type === "drawing"
              ? { id: el.id, type: el.type, path: el.path, color: el.color, size: el.size }
              : { id: el.id, type: el.type, x: el.x, y: el.y, x2: el.x2, y2: el.y2, color: el.color || (el.type||"").replace("player_","") || "red", num: el.num ?? el.number, material: el.material }
          ))
        }))
      })),
      tasks: (d.tasks || []).map(task => ({
        ...task,
        pizarra: (task.pizarra || []).filter(el => el != null && el.type).map(el => (
          el.type === "drawing"
            ? { id: el.id, type: el.type, path: el.path, color: el.color, size: el.size }
            : { id: el.id, type: el.type, x: el.x, y: el.y, x2: el.x2, y2: el.y2, color: el.color || (el.type||"").replace("player_","") || "red", num: el.num ?? el.number, material: el.material }
        ))
      }))
    });
    const newDb = { ...(freshDb || db), [team]: cleanTeam(newData) };
    setDb(newDb);
    await saveData(newDb);
    setTimeout(() => { if (window._setSaving) window._setSaving(false); }, 2000);
  };

  const saveGlobalTasks = async (tasks) => {
    setGlobalTasks(tasks);
    const newDb = { ...db, __globalTasks: tasks };
    setDb(newDb);
    await saveData(newDb);
  };

  const savePasswords = async (newPwds) => {
    setTeamPasswords(newPwds);
    localStorage.setItem("cdmag_passwords", JSON.stringify(newPwds));
  };

  const archiveSeason = async () => {
    const fresh = initState();
    TEAMS.forEach(t => {
      fresh[t].players = db[t]?.players || [];
      fresh[t].coaches = db[t]?.coaches || [];
      fresh[t].tasks = db[t]?.tasks || [];
    });
    setDb(fresh);
    await saveData(fresh);
    const updated = await loadSeasons();
    setSeasons(updated || []);
  };

  const restoreSeason = async (seasonData) => {
    setDb(seasonData);
    await saveData(seasonData);
  };

  const availableTeams = isCoord ? TEAMS : [teamAccess];

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-zinc-400 text-sm animate-pulse">Cargando...</div>
    </div>
  );

  if (showProfilePicker) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-700 mb-4"><span className="text-2xl">⚽</span></div>
          <h1 className="text-xl font-black text-white">¿Quién eres?</h1>
          <p className="text-zinc-500 text-sm mt-1">Selecciona tu perfil de coordinador</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {COORDINATORS.map(name => (
            <button key={name} onClick={() => { setCoordProfile(name); setShowProfilePicker(false); setAuthState("app"); }}
              className="bg-zinc-800 hover:bg-red-900/60 border border-zinc-700 hover:border-red-700 rounded-xl p-4 text-white font-semibold text-sm transition-all">
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (authState === "login") return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-700 mb-4 shadow-lg shadow-red-900/50">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">CD La Magdalena</h1>
          <p className="text-zinc-500 text-sm mt-1">Panel de gestión deportiva</p>
        </div>

        <Card className="border-zinc-700">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Rol / Equipo</label>
              <select
                value={teamInput}
                onChange={e => setTeamInput(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full"
              >
                {["Coordinador", ...TEAMS].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setLoginError(""); }}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="Introduce tu clave"
            />
            {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
            <Btn onClick={login} className="w-full justify-center">Entrar</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  if (showProfilePicker) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-700 mb-4">
            <span className="text-2xl">⚽</span>
          </div>
          <h1 className="text-xl font-black text-white">¿Quién eres?</h1>
          <p className="text-zinc-500 text-sm mt-1">Selecciona tu perfil de coordinador</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {COORDINATORS.map(name => (
            <button key={name} onClick={() => { setCoordProfile(name); setShowProfilePicker(false); setAuthState("app"); }}
              className="bg-zinc-800 hover:bg-red-900/60 border border-zinc-700 hover:border-red-700 rounded-xl p-4 text-white font-semibold text-sm transition-all">
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const teamData = db[activeTeam] || { players: [], trainings: [], matches: [], attendance: [] };

  return (
    <div className="min-h-screen bg-zinc-950 flex text-zinc-100" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-64" : "w-0 overflow-hidden"} transition-all duration-300 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0`}>
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-red-700 rounded-full flex items-center justify-center text-sm">⚽</div>
            <span className="font-black text-white text-sm">CD La Magdalena</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={isCoord ? "red" : "blue"}>{isCoord ? "Coordinador" : "Entrenador"}</Badge>
          </div>
        </div>

        {/* Team selector */}
        {isCoord && (
          <div className="p-3 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Equipo</p>
            {TEAMS.map(t => (
              <button
                key={t}
                onClick={() => setActiveTeam(t)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-all ${
                  activeTeam === t ? "bg-red-900/40 text-red-300 font-semibold" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >{t}</button>
            ))}
          </div>
        )}
        {!isCoord && (
          <div className="p-3 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Tu equipo</p>
            <p className="text-white font-semibold text-sm">{teamAccess}</p>
          </div>
        )}

        {/* Sections */}
        <nav className="p-3 flex-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Secciones</p>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-all flex items-center gap-2 ${
                activeSection === s.id ? "bg-red-900/40 text-red-300 font-semibold" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-zinc-800">
          <Btn variant="ghost" small className="w-full justify-center" onClick={() => { setAuthState("login"); setPassword(""); }}>
            Cerrar sesión
          </Btn>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-zinc-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-all"
          >☰</button>
          <span className="text-white font-semibold">
            {sections.find(s => s.id === activeSection)?.icon} {sections.find(s => s.id === activeSection)?.label}
            <span className="text-zinc-500 font-normal ml-2">— {activeTeam}</span>
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 md:p-8">
          <div className="max-w-4xl mx-auto">
            {activeSection === "resumen" && isCoord && (
              <ResumenSection db={db} />
            )}
            {activeSection === "entrenadores" && isCoord && (
              <EntrenadoresSection db={db} onSaveTeam={(team, data) => updateTeamData(team, data)} coordProfile={coordProfile} />
            )}
            {activeSection === "mejoresrivales" && isCoord && (
        <MejoresRivalesSection db={db} />
      )}
      {activeSection === "gestion" && isCoord && (
              <GestionSection db={db} onArchive={archiveSeason} onRestore={restoreSeason} passwords={{...TEAM_PASSWORDS, ...teamPasswords}} onSavePasswords={savePasswords} />
            )}
            {activeSection === "plantilla" && (
              <PlantillaSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} seasons={seasons} db={db} />
            )}

            {activeSection === "informes" && informesPlayer && (
              <InformesSection
                player={informesPlayer.player}
                team={informesPlayer.team}
                data={teamData}
                onSave={d => updateTeamData(activeTeam, d)}
                onBack={() => setActiveSection("plantilla")}
              />
            )}
            {activeSection === "entrenamientos" && (
              <EntrenamientosSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} />
            )}
            {activeSection === "tareas" && (
              <TareasSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} globalTasks={globalTasks} onSaveGlobal={saveGlobalTasks} isCoord={isCoord} />
            )}
            {activeSection === "partidos" && (
              <PartidosSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} />
            )}
            {activeSection === "clasificacion" && (
              <ClasificacionSection team={activeTeam} data={teamData} />
            )}
            {activeSection === "asistencia" && (
              <AsistenciaSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} />
            )}
            {activeSection === "tacticas" && (
              <TacticasSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
