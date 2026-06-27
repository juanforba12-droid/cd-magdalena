import { loadData, saveData, loadSeasons, saveSeasons, subscribeToData } from "./amicsFirebase";
import { useState, useEffect, useRef } from "react";
import * as React from "react";

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e) { console.error("Render error:", e); }
  render() { return this.state.hasError ? <div style={{color:'white',padding:20}}>Error al renderizar. Recarga la página.</div> : this.props.children; }
}

// ── Constantes Amics Castelló ──────────────────────────────────────────────────
const TEAMS = [
  // Cantera real del club
  "Baby",
  "Prebenjamín",
  "Benjamín A", "Benjamín B",
  "Alevín A", "Alevín B", "Alevín C",
  "Alevín Verde", "Alevín Blanco",
  "Infantil A", "Infantil B", "Infantil C",
  "Infantil Verde", "Infantil Blanco", "Infantil Azul",
  "Cadete A", "Cadete B", "Cadete C",
  "Cadete Verde", "Cadete Blanco", "Cadete Rojo", "Cadete Azul",
  "Junior A", "Junior B", "Junior C",
  "Senior",
];

// Colores oficiales Amics: verde titular, blanco reserva
const CLUB_COLOR_PRIMARY = "green";   // verde
const CLUB_COLOR_HEX = "#16a34a";

const COORDINATORS = ["Director Deportivo", "Coord. Cantera", "Coord. Prebenjamín", "Coord. Benjamín", "Coord. Alevín", "Coord. Infantil", "Coord. Cadete", "Coord. Junior"];

// Posiciones reales del baloncesto (FEB)
const POSITIONS = [
  // Exteriores
  "Base (1)",
  "Escolta (2)",
  "Alero (3)",
  // Interiores
  "Ala-Pívot (4)",
  "Pívot (5)",
  // Mixtas/modernas
  "Base-Escolta",
  "Alero-Escolta",
  "Ala-Pívot-Alero",
  "Pívot-Ala",
];

// Estadísticas avanzadas de baloncesto disponibles en un partido
const MATCH_STATS_FIELDS = [
  { key: "minutos", label: "Min", tipo: "number" },
  { key: "puntos", label: "Pts", tipo: "number" },
  { key: "asistencias", label: "Ast", tipo: "number" },
  { key: "rebotes", label: "Reb", tipo: "number" },
  { key: "rebotesOf", label: "R.Of", tipo: "number" },
  { key: "tapones", label: "Tap", tipo: "number" },
  { key: "robos", label: "Rob", tipo: "number" },
  { key: "perdidas", label: "Perd", tipo: "number" },
  { key: "faltas", label: "Falt", tipo: "number" },
  { key: "tl", label: "TL %", tipo: "number" },
  { key: "nota", label: "Nota", tipo: "decimal" },
];

function initState() {
  const teams = {};
  TEAMS.forEach(t => {
    teams[t] = { players: [], trainings: [], matches: [], attendance: [], tasks: [], coaches: [] };
  });
  return teams;
}

// ── Tiny UI components ────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant = "primary", small, className = "" }) => {
  const base = "font-bold rounded transition-all duration-150 cursor-pointer border-0 ";
  const sizes = small ? "px-3 py-1 text-xs" : "px-5 py-2 text-sm";
  const variants = {
    primary: "bg-green-700 hover:bg-green-600 text-white",
    secondary: "bg-zinc-700 hover:bg-zinc-600 text-zinc-100",
    danger: "bg-zinc-800 hover:bg-red-800 text-red-400 border border-red-900",
    ghost: "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white",
  };
  return <button className={`${base}${sizes} ${variants[variant]} ${className}`} onClick={onClick}>{children}</button>;
};

const Input = ({ label, ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs text-zinc-400 uppercase tracking-wider">{label}</label>}
    <input
      {...props}
      className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-green-600 w-full"
    />
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs text-zinc-400 uppercase tracking-wider">{label}</label>}
    <textarea
      {...props}
      className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-green-600 w-full resize-none"
      rows={4}
    />
  </div>
);

const Card = ({ children, className = "", onClick }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 ${className}`} onClick={onClick}>{children}</div>
);

const Badge = ({ children, color = "zinc" }) => {
  const colors = {
    zinc: "bg-zinc-800 text-zinc-300",
    red: "bg-red-900/60 text-red-300",
    green: "bg-green-900/60 text-green-300",
    yellow: "bg-yellow-900/60 text-yellow-300",
    blue: "bg-blue-900/60 text-blue-300",
    orange: "bg-green-900/60 text-green-300",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color]}`}>{children}</span>;
};

// ── Attendance mini-bar chart ──────────────────────────────────────────────────
function AttendanceChart({ present, late, absent }) {
  const total = present + late + absent || 1;
  const bars = [
    { label: "Asistió", val: present, color: "bg-green-500" },
    { label: "Tarde", val: late, color: "bg-yellow-500" },
    { label: "No asistió", val: absent, color: "bg-green-600" },
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

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Plantilla
// ══════════════════════════════════════════════════════════════════════════════
function PlantillaSection({ team, data, onSave, isCoord, seasons }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [dorsal, setDorsal] = useState("");
  const [positions, setPositions] = useState([]);
  const [posicionPrincipal, setPosicionPrincipal] = useState("");
  const [statsPlayer, setStatsPlayer] = useState(null);
  const [notesPlayer, setNotesPlayer] = useState(null);
  const [showAllReports, setShowAllReports] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportText, setReportText] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [editingReport, setEditingReport] = useState(null);
  const [search, setSearch] = useState("");

  const getPlayerMatchHistory = (playerId) => {
    return (data.matches || [])
      .filter(m => m.convocatoria?.find(c => c.playerId === playerId && c.nota !== "" && c.nota !== undefined && c.nota !== null))
      .map(m => {
        const c = m.convocatoria.find(c => c.playerId === playerId);
        return { rival: m.rival, fecha: m.fecha, nota: parseFloat(c.nota), minutos: c.minutos, puntos: c.puntos, asistencias: c.asistencias, rebotes: c.rebotes, status: c.status };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  };

  const statusLabel = { titular: "Titular", suplente: "Suplente", no_conv: "No conv." };
  const statusColor = { titular: "green", suplente: "blue", no_conv: "zinc" };

  const openNotes = (p) => {
    // Leer siempre el jugador fresco de data para tener sus reports actualizados
    const freshPlayer = (data.players || []).find(x => x.id === p.id) || p;
    setNotesPlayer(freshPlayer);
    setReportTitle("");
    setReportText("");
    setReportDate(new Date().toISOString().split("T")[0]);
    setEditingReport(null);
  };

  const saveReport = () => {
    if (!reportText.trim()) return;
    const players = (data.players || []).map(p => {
      if (p.id !== notesPlayer.id) return p;
      const reports = p.reports || [];
      if (editingReport) {
        return { ...p, reports: reports.map(r => r.id === editingReport.id ? { ...r, title: reportTitle, text: reportText, fecha: reportDate } : r) };
      }
      return { ...p, reports: [{ id: Date.now(), title: reportTitle, text: reportText, fecha: reportDate }, ...reports] };
    });
    onSave({ ...data, players });
    setNotesPlayer(players.find(p => p.id === notesPlayer.id) || notesPlayer);
    setReportTitle(""); setReportText(""); setEditingReport(null);
    setReportDate(new Date().toISOString().split("T")[0]);
  };

  const delReport = (playerId, reportId) => {
    const players = (data.players || []).map(p =>
      p.id !== playerId ? p : { ...p, reports: (p.reports || []).filter(r => r.id !== reportId) }
    );
    onSave({ ...data, players });
    setNotesPlayer(players.find(p => p.id === playerId));
  };

  const setPlayerStatus = (playerId, status) => {
    const players = (data.players || []).map(p =>
      p.id !== playerId ? p : { ...p, status }
    );
    onSave({ ...data, players });
  };

  const PLAYER_STATUSES = [
    { val: "disponible", label: "Disponible", color: "bg-green-900/40 border-green-700 text-green-300" },
    { val: "lesionado", label: "Lesionado", color: "bg-red-900/40 border-red-700 text-red-300" },
    { val: "sancionado", label: "Sancionado", color: "bg-yellow-900/40 border-yellow-700 text-yellow-300" },
    { val: "duda", label: "Duda", color: "bg-green-900/40 border-green-700 text-green-300" },
  ];

  const statusStyle = (s) => {
    const found = PLAYER_STATUSES.find(x => x.val === s);
    return found ? found.color : "bg-zinc-800 border-zinc-700 text-zinc-400";
  };

  const openEditReport = (r) => {
    setEditingReport(r);
    setReportTitle(r.title || "");
    setReportText(r.text);
    setReportDate(r.fecha);
  };

  const open = (p = null) => {
    setEditing(p);
    setName(p ? p.name : "");
    setDorsal(p ? p.dorsal : "");
    setPositions(p ? p.positions : []);
    setPosicionPrincipal(p ? (p.posicionPrincipal || (p.positions || [])[0] || "") : "");
    setShowForm(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const players = [...(data.players || [])];
    if (editing) {
      const idx = players.findIndex(p => p.id === editing.id);
      players[idx] = { ...editing, name, dorsal, positions, posicionPrincipal, reports: editing.reports || [] };
    } else {
      players.push({ id: Date.now(), name, dorsal, positions, posicionPrincipal });
    }
    onSave({ ...data, players });
    setShowForm(false);
  };

  const del = (id) => {
    if (!window.confirm("¿Eliminar jugador?")) return;
    onSave({ ...data, players: data.players.filter(p => p.id !== id) });
  };

  const togglePos = (pos) => {
    setPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };

  // Modal de estadísticas
  if (statsPlayer) {
    const history = getPlayerMatchHistory(statsPlayer.id);
    const totalPuntos = history.reduce((s, h) => s + (h.puntos || 0), 0);
    const totalAsist = history.reduce((s, h) => s + (h.asistencias || 0), 0);
    const totalRebotes = history.reduce((s, h) => s + (h.rebotes || 0), 0);
    const totalTapones = history.reduce((s, h) => s + (h.tapones || 0), 0);
    const totalRobos = history.reduce((s, h) => s + (h.robos || 0), 0);
    const totalMin = history.reduce((s, h) => s + (h.minutos || 0), 0);
    const avgNota = history.length ? (history.reduce((s, h) => s + (parseFloat(h.nota) || 0), 0) / history.filter(h=>h.nota).length).toFixed(1) : "-";
    const eficiencia = totalPuntos + totalRebotes + totalAsist + totalTapones + totalRobos;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={() => setStatsPlayer(null)}>← Volver</Btn>
          <h2 className="text-xl font-bold text-white">📊 {statsPlayer.name}</h2>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {[["Puntos", totalPuntos, "text-green-400"], ["Asistencias", totalAsist, "text-blue-400"], ["Rebotes", totalRebotes, "text-yellow-400"], ["Tapones", totalTapones, "text-purple-400"], ["Robos", totalRobos, "text-red-400"], ["Minutos", totalMin, "text-zinc-300"], ["Eficiencia", eficiencia, "text-green-300"], ["Nota media", avgNota, "text-yellow-300"]].map(([label, val, cls]) => (
            <Card key={label} className="text-center">
              <div className={`text-2xl font-black ${cls}`}>{val}</div>
              <div className="text-xs text-zinc-500 mt-1">{label}</div>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-zinc-500 text-sm">Sin partidos valorados todavía.</p>}
          {history.map((h, i) => (
            <Card key={i} className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <div className="text-white font-semibold">vs {h.rival}</div>
                <div className="text-xs text-zinc-400">{h.fecha}</div>
              </div>
              <div className="flex gap-2 text-xs flex-wrap">
                <span className="text-green-400 font-bold">{h.puntos || 0}pts</span>
                <span className="text-blue-400">{h.asistencias || 0}ast</span>
                <span className="text-yellow-400">{h.rebotes || 0}reb</span>
                <span className="text-purple-400">{h.tapones || 0}tap</span>
                <span className="text-red-400">{h.robos || 0}rob</span>
                <span className="text-zinc-400">{h.minutos || 0}min</span>
                {h.nota !== "" && h.nota !== undefined && <Badge color="green">Nota: {h.nota}</Badge>}
                <Badge color={statusColor[h.status] || "zinc"}>{statusLabel[h.status] || h.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Modal de informes/notas
  if (notesPlayer) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={() => setNotesPlayer(null)}>← Volver</Btn>
          <h2 className="text-xl font-bold text-white">📝 {notesPlayer.name}</h2>
        </div>
        <Card className="border-green-900/50">
          <h3 className="text-sm font-bold text-zinc-300 mb-3">{editingReport ? "Editar informe" : "Nuevo informe"}</h3>
          <div className="space-y-3">
            <Input label="Título (opcional)" value={reportTitle} onChange={e => setReportTitle(e.target.value)} />
            <Input label="Fecha" type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
            <Textarea label="Contenido" value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Observaciones sobre el jugador..." />
          </div>
          <div className="flex gap-2 mt-3">
            <Btn onClick={saveReport}>Guardar</Btn>
            {editingReport && <Btn variant="secondary" onClick={() => { setEditingReport(null); setReportTitle(""); setReportText(""); }}>Cancelar edición</Btn>}
          </div>
        </Card>
        <div className="space-y-2">
          {((data.players||[]).find(p=>p.id===notesPlayer.id)?.reports || []).length === 0 && <p className="text-zinc-500 text-sm">Sin informes todavía.</p>}
          {((data.players||[]).find(p=>p.id===notesPlayer.id)?.reports || []).map(r => (
            <Card key={r.id}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  {r.title && <div className="text-white font-semibold">{r.title}</div>}
                  <div className="text-xs text-zinc-400">{r.fecha}</div>
                </div>
                <div className="flex gap-1">
                  <Btn small variant="secondary" onClick={() => openEditReport(r)}>✏️</Btn>
                  <Btn small variant="danger" onClick={() => delReport(notesPlayer.id, r.id)}>🗑️</Btn>
                </div>
              </div>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{r.text}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Plantilla — {team}</h2>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => setShowAllReports(!showAllReports)}>📋 Informes</Btn>
          <Btn onClick={() => open()}>+ Añadir jugador</Btn>
        </div>
      </div>
      {showAllReports && (
        <Card className="border-zinc-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-zinc-300">📋 Todos los informes</h3>
            <Btn small variant="secondary" onClick={() => setShowAllReports(false)}>← Volver a plantilla</Btn>
          </div>
          {(data.players || []).every(p => (p.reports || []).length === 0) && <p className="text-zinc-500 text-sm">No hay informes todavía.</p>}
          {(data.players || []).flatMap(p => (p.reports || []).map(r => ({ ...r, playerName: p.name, playerId: p.id }))).sort((a,b) => (b.fecha||"").localeCompare(a.fecha||"")).map(r => (
            <div key={r.id} className="border-b border-zinc-800 py-3 last:border-0">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-green-400 text-xs font-bold uppercase">{r.playerName}</span>
                  {r.title && <p className="text-white font-semibold text-sm mt-0.5">{r.title}</p>}
                  <p className="text-zinc-400 text-xs">{r.fecha}</p>
                  {r.text && <p className="text-zinc-300 text-sm mt-1 whitespace-pre-wrap">{r.text}</p>}
                </div>
                <Btn small variant="danger" onClick={() => {
                  const players = (data.players || []).map(p =>
                    p.id !== r.playerId ? p : { ...p, reports: (p.reports || []).filter(x => x.id !== r.id) }
                  );
                  onSave({ ...data, players });
                }}>🗑️</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}

      {showForm && (
        <Card className="border-green-900/50">
          <h3 className="text-sm font-bold text-zinc-300 mb-4">{editing ? "Editar jugador" : "Nuevo jugador"}</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Input label="Nombre" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Dorsal" type="number" value={dorsal} onChange={e => setDorsal(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Posición principal</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {["Base (1)", "Escolta (2)", "Alero (3)", "Ala-Pívot (4)", "Pívot (5)"].map(pos => (
                <button key={pos} onClick={() => { setPosicionPrincipal(pos); setPositions(prev => prev.includes(pos) ? prev : [pos, ...prev.filter(p => p !== pos)]); }}
                  className={`text-xs px-3 py-1.5 rounded border transition-all font-medium ${posicionPrincipal === pos ? "bg-green-700 border-green-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                >{pos}</button>
              ))}
            </div>
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Posiciones secundarias</label>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  onClick={() => togglePos(pos)}
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

      <Input placeholder="🔍 Buscar jugador por nombre..." value={search} onChange={e => setSearch(e.target.value)} />

      {(() => {
        const POSICIONES_ORDEN = ["Base (1)", "Escolta (2)", "Alero (3)", "Ala-Pívot (4)", "Pívot (5)", "Base-Escolta", "Alero-Escolta", "Ala-Pívot-Alero", "Pívot-Ala", "Sin posición"];
        const filtered = (data.players || []).filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
        const getPrincipal = (p) => p.posicionPrincipal || (p.positions || [])[0] || "Sin posición";
        const getPosGroup = (p) => {
          const pp = getPrincipal(p);
          if (POSITIONS.includes(pp)) return pp;
          return "Sin posición";
        };
        const posColor = {
          "Base (1)": "text-green-400",
          "Escolta (2)": "text-blue-400",
          "Alero (3)": "text-yellow-400",
          "Ala-Pívot (4)": "text-purple-400",
          "Pívot (5)": "text-red-400",
          "Base-Escolta": "text-teal-400",
          "Alero-Escolta": "text-cyan-400",
          "Ala-Pívot-Alero": "text-indigo-400",
          "Pívot-Ala": "text-orange-400",
          "Sin posición": "text-zinc-400"
        };
        if (filtered.length === 0) return <p className="text-zinc-500 text-sm">{search ? `No hay jugadores con "${search}"` : "No hay jugadores en la plantilla."}</p>;
        return (
          <div className="space-y-5">
            {POSICIONES_ORDEN.map(pos => {
              const grupo = filtered.filter(p => getPosGroup(p) === pos)
                .sort((a, b) => (parseInt(a.dorsal) || 999) - (parseInt(b.dorsal) || 999));
              if (grupo.length === 0) return null;
              return (
                <div key={pos} className="space-y-2">
                  <p className={`text-xs uppercase tracking-wider font-bold ${posColor[pos] || "text-zinc-400"}`}>{pos.replace(/ \(\d\)/, "")} ({grupo.length})</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {grupo.map(p => (
                      <Card key={p.id} className={`flex justify-between items-start border ${statusStyle(p.status || "disponible")}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {p.dorsal && <span className="text-green-500 font-bold text-lg">#{p.dorsal}</span>}
                            <span className="text-white font-semibold">{p.name}</span>
                            <Badge color="zinc">{getPrincipal(p)}</Badge>
                          </div>
                          {/* Estado */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {PLAYER_STATUSES.map(s => (
                              <button key={s.val} onClick={() => setPlayerStatus(p.id, s.val)}
                                className={`text-xs px-2 py-0.5 rounded border transition-all ${(p.status || "disponible") === s.val ? s.color : "bg-transparent border-zinc-700 text-zinc-600"}`}
                              >{s.label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                          <Btn small variant="ghost" onClick={() => setStatsPlayer(p)}>📊 Stats</Btn>
                          <Btn small variant="ghost" onClick={() => openNotes(p)}>📝 Notas</Btn>
                          <Btn small variant="secondary" onClick={() => open(p)}>✏️ Editar</Btn>
                          <Btn small variant="danger" onClick={() => del(p.id)}>🗑️ Borrar</Btn>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PIZARRA (cancha de baloncesto)
// ══════════════════════════════════════════════════════════════════════════════
const PLAYER_COLORS = ["red", "yellow", "blue", "green"];
const PLAYER_COLOR_STYLES = { red: "bg-red-600 border-red-400", yellow: "bg-yellow-500 border-yellow-300", blue: "bg-blue-600 border-blue-400", green: "bg-green-600 border-green-400" };
const PLAYER_COLOR_HEX2 = { red: "#dc2626", yellow: "#eab308", blue: "#2563eb", green: "#16a34a" };

const MATERIALS = [
  { id: "cono", label: "Cono 🟠", svg: <svg viewBox="0 0 24 24" fill="#f97316" className="w-5 h-5"><path d="M12 2L4 20h16L12 2z"/><ellipse cx="12" cy="20" rx="8" ry="2" fill="#f97316" opacity="0.4"/></svg> },
  { id: "cono_azul", label: "Cono 🔵", svg: <svg viewBox="0 0 24 24" fill="#2563eb" className="w-5 h-5"><path d="M12 2L4 20h16L12 2z"/><ellipse cx="12" cy="20" rx="8" ry="2" fill="#2563eb" opacity="0.4"/></svg> },
  { id: "aro", label: "Aro 🔵", svg: <svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="3" className="w-5 h-5"><circle cx="12" cy="12" r="8"/></svg> },
  { id: "aro_rojo", label: "Aro 🔴", svg: <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" className="w-5 h-5"><circle cx="12" cy="12" r="8"/></svg> },
  { id: "aro_amarillo", label: "Aro 🟡", svg: <svg viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="3" className="w-5 h-5"><circle cx="12" cy="12" r="8"/></svg> },
  { id: "flecha", label: "Flecha", svg: <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5"><line x1="4" y1="20" x2="20" y2="4"/><polyline points="10,4 20,4 20,14"/></svg> },
  { id: "balon", label: "Balón", svg: <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><circle cx="12" cy="12" r="9" fill="#f97316" stroke="#c2410c" strokeWidth="1"/><path d="M12 3 A9 9 0 0 1 12 21" fill="none" stroke="#c2410c" strokeWidth="1.5"/><path d="M3 12 A9 9 0 0 1 21 12" fill="none" stroke="#c2410c" strokeWidth="1.5"/><path d="M5 7 Q12 10 19 7" fill="none" stroke="#c2410c" strokeWidth="1"/><path d="M5 17 Q12 14 19 17" fill="none" stroke="#c2410c" strokeWidth="1"/></svg> },
  { id: "pesa", label: "Pesa", svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-zinc-400"><rect x="1" y="9" width="4" height="6" rx="1"/><rect x="19" y="9" width="4" height="6" rx="1"/><rect x="6" y="7" width="4" height="10" rx="1"/><rect x="14" y="7" width="4" height="10" rx="1"/><rect x="10" y="10.5" width="4" height="3" rx="0.5"/></svg> },
  { id: "escalera", label: "Escalera", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-amber-400"><line x1="4" y1="4" x2="4" y2="20"/><line x1="20" y1="4" x2="20" y2="20"/><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="4" y1="19" x2="20" y2="19"/></svg> },
  { id: "canasta", label: "Canasta 🏀", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-white"><rect x="1" y="10" width="6" height="4" rx="0.5"/><line x1="7" y1="12" x2="11" y2="12"/><circle cx="14" cy="12" r="3"/><line x1="14" y1="15" x2="14" y2="21"/><line x1="10" y1="21" x2="18" y2="21"/></svg> },
  { id: "canasta", label: "Canasta", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-white"><rect x="2" y="11" width="5" height="3" rx="0.5"/><line x1="7" y1="12.5" x2="11" y2="12.5" strokeWidth="1.5"/><circle cx="13" cy="12.5" r="2.5"/><line x1="13" y1="15" x2="13" y2="20" strokeWidth="1.5"/><line x1="10" y1="20" x2="16" y2="20" strokeWidth="1.5"/></svg> },
];

const FIELD_TYPES = [
  { id: "full", label: "🏀 Cancha completa" },
  { id: "half", label: "½ Media cancha" },
  { id: "blank", label: "⬛ Libre" },
];

function FieldMarkings({ type }) {
  if (type === "blank") return null;
  if (type === "half") return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 55 55" preserveAspectRatio="none">
      {/* Fondo */}
      <rect x="0" y="0" width="55" height="55" fill="#b05a14"/>
      {/* Borde */}
      <rect x="1" y="1" width="53" height="53" fill="none" stroke="white" strokeWidth="0.7" opacity="0.95"/>
      {/* Línea de fondo (lado del aro) */}
      <line x1="1" y1="1" x2="1" y2="54" stroke="white" strokeWidth="1" opacity="1"/>
      {/* Zona pintada */}
      <rect x="1" y="14" width="19" height="27" fill="rgba(255,255,255,0.07)" stroke="white" strokeWidth="0.6" opacity="0.95"/>
      {/* Semicírculo tiros libres hacia dentro */}
      <path d="M20 14 A13.5 13.5 0 0 1 20 41" fill="none" stroke="white" strokeWidth="0.6" opacity="0.9"/>
      {/* Semicírculo tiros libres hacia fuera punteado */}
      <path d="M20 14 A13.5 13.5 0 0 0 20 41" fill="none" stroke="white" strokeWidth="0.6" strokeDasharray="1.5 1.5" opacity="0.7"/>
      {/* Tablero */}
      <rect x="0" y="23.5" width="2.5" height="8" fill="none" stroke="white" strokeWidth="0.9" opacity="1"/>
      {/* Poste */}
      <line x1="2.5" y1="27.5" x2="5.5" y2="27.5" stroke="white" strokeWidth="0.5" opacity="0.9"/>
      {/* Aro */}
      <circle cx="7.5" cy="27.5" r="2.2" fill="none" stroke="white" strokeWidth="0.7" opacity="1"/>
      {/* Línea 3 puntos */}
      <line x1="1" y1="6" x2="15" y2="6" stroke="white" strokeWidth="0.6" opacity="0.9"/>
      <line x1="1" y1="49" x2="15" y2="49" stroke="white" strokeWidth="0.6" opacity="0.9"/>
      <path d="M15 6 A10 10 0 0 1 15 49" fill="none" stroke="white" strokeWidth="0.6" opacity="0.9"/>
      {/* Semicírculo central lado abierto */}
      <path d="M54 18.5 A9 9 0 0 1 54 36.5" fill="none" stroke="white" strokeWidth="0.6" opacity="0.7"/>
    </svg>
  );
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 55" preserveAspectRatio="none">
      <rect x="0" y="0" width="100" height="55" fill="#b05a14"/>
      <rect x="1" y="1" width="98" height="53" fill="none" stroke="white" strokeWidth="0.7" opacity="0.95"/>
      <line x1="50" y1="1" x2="50" y2="54" stroke="white" strokeWidth="0.6" opacity="0.9"/>
      <circle cx="50" cy="27.5" r="9" fill="none" stroke="white" strokeWidth="0.6" opacity="0.9"/>
      <circle cx="50" cy="27.5" r="0.5" fill="white" opacity="0.9"/>
      {/* Zona pintada izquierda FIBA: 4.9m ancho x 5.8m largo */}
      <rect x="1" y="18.7" width="15.6" height="17.6" fill="rgba(255,255,255,0.07)" stroke="white" strokeWidth="0.65" opacity="0.95"/>
      <path d="M16.6 18.7 A6.43 6.43 0 0 1 16.6 36.3" fill="none" stroke="white" strokeWidth="0.65" opacity="0.9"/>
      <path d="M16.6 18.7 A6.43 6.43 0 0 0 16.6 36.3" fill="none" stroke="white" strokeWidth="0.55" strokeDasharray="1 1" opacity="0.65"/>
      {/* Tablero izquierdo */}
      <line x1="1" y1="24" x2="1" y2="31" stroke="white" strokeWidth="2.5" opacity="1"/>
      {/* Poste aro izquierdo */}
      <line x1="1" y1="27.5" x2="5.6" y2="27.5" stroke="white" strokeWidth="0.5" opacity="0.8"/>
      {/* Aro izquierdo */}
      <circle cx="5.6" cy="27.5" r="1.6" fill="none" stroke="white" strokeWidth="0.75" opacity="1"/>
      {/* Arco sin carga 1.25m punteado */}
      <path d="M5.6 26 A1.6 1.6 0 0 1 5.6 29" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="0.5 0.5" opacity="0.85"/>
      {/* 3 puntos izquierda: rectas cortas + arco grande */}
      <line x1="1" y1="5.5" x2="5.6" y2="5.5" stroke="white" strokeWidth="0.65" opacity="0.9"/>
      <line x1="1" y1="49.5" x2="5.6" y2="49.5" stroke="white" strokeWidth="0.65" opacity="0.9"/>
      <path d="M5.6 5.5 A12 12 0 0 1 5.6 49.5" fill="none" stroke="white" strokeWidth="0.65" opacity="0.9"/>
      {/* Zona pintada derecha FIBA */}
      <rect x="83.4" y="18.7" width="15.6" height="17.6" fill="rgba(255,255,255,0.07)" stroke="white" strokeWidth="0.65" opacity="0.95"/>
      <path d="M83.4 18.7 A6.43 6.43 0 0 0 83.4 36.3" fill="none" stroke="white" strokeWidth="0.65" opacity="0.9"/>
      <path d="M83.4 18.7 A6.43 6.43 0 0 1 83.4 36.3" fill="none" stroke="white" strokeWidth="0.55" strokeDasharray="1 1" opacity="0.65"/>
      {/* Tablero derecho */}
      <line x1="99" y1="24" x2="99" y2="31" stroke="white" strokeWidth="2.5" opacity="1"/>
      {/* Poste aro derecho */}
      <line x1="99" y1="27.5" x2="94.4" y2="27.5" stroke="white" strokeWidth="0.5" opacity="0.8"/>
      {/* Aro derecho */}
      <circle cx="94.4" cy="27.5" r="1.6" fill="none" stroke="white" strokeWidth="0.75" opacity="1"/>
      {/* Arco sin carga derecho punteado */}
      <path d="M94.4 26 A1.6 1.6 0 0 0 94.4 29" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="0.5 0.5" opacity="0.85"/>
      {/* 3 puntos derecha */}
      <line x1="99" y1="5.5" x2="94.4" y2="5.5" stroke="white" strokeWidth="0.65" opacity="0.9"/>
      <line x1="99" y1="49.5" x2="94.4" y2="49.5" stroke="white" strokeWidth="0.65" opacity="0.9"/>
      <path d="M94.4 5.5 A12 12 0 0 0 94.4 49.5" fill="none" stroke="white" strokeWidth="0.65" opacity="0.9"/>
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
  const [pencilMode, setPencilMode] = useState("draw");
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
      e.preventDefault(); e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      if (pencilModeRef.current === "erase") { erasingRef.current = true; return; }
      drawingRef.current = true;
      currentPathRef.current = [{ x, y }];
      setDrawing(true); setCurrentPath([{ x, y }]);
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
        onChange(prev => (prev || []).flatMap(i => {
          if (i.type !== "drawing") return [i];
          const segments = []; let current = [];
          for (const p of i.path) {
            const near = Math.abs(p.x - x) < RADIUS && Math.abs(p.y - y) < RADIUS;
            if (near) { if (current.length > 1) segments.push({ ...i, id: Date.now() + Math.random(), path: current }); current = []; }
            else current.push(p);
          }
          if (current.length > 1) segments.push({ ...i, id: Date.now() + Math.random(), path: current });
          return segments;
        }));
        return;
      }
      if (!drawingRef.current) return;
      currentPathRef.current = [...currentPathRef.current, { x, y }];
      setCurrentPath([...currentPathRef.current]);
    };
    const handleUp = () => {
      erasingRef.current = false;
      if (toolRef.current === "pencil" && drawingRef.current && currentPathRef.current.length > 1) {
        const newItem = { id: Date.now(), type: "drawing", path: [...currentPathRef.current], color: pencilColorRef.current, size: pencilSizeRef.current };
        onChange(prev => [...(prev || []), newItem]);
      }
      drawingRef.current = false; currentPathRef.current = [];
      setDrawing(false); setCurrentPath([]);
    };
    el.addEventListener("mousedown", handleDown);
    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseup", handleUp);
    el.addEventListener("touchstart", handleDown, { passive: false });
    el.addEventListener("touchmove", handleMove, { passive: false });
    el.addEventListener("touchend", handleUp);
    return () => {
      el.removeEventListener("mousedown", handleDown); el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseup", handleUp); el.removeEventListener("touchstart", handleDown);
      el.removeEventListener("touchmove", handleMove); el.removeEventListener("touchend", handleUp);
    };
  }, []);

  const PENCIL_COLORS = [{ color: "#ef4444", label: "Rojo" }, { color: "#3b82f6", label: "Azul" }, { color: "#f97316", label: "Naranja" }, { color: "#22c55e", label: "Verde" }, { color: "#ffffff", label: "Blanco" }];
  const PENCIL_SIZES = [{ size: 1.5, label: "Fino" }, { size: 3, label: "Medio" }, { size: 5, label: "Grueso" }];
  const items = (value || []).filter(i => i != null && typeof i === 'object' && typeof i.type === 'string' && (i.type !== 'drawing' || (Array.isArray(i.path) && i.path.length > 0)));

  const getCoords = (e) => {
    if (e.touches && e.touches[0]) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    return { clientX: e.clientX, clientY: e.clientY };
  };
  const addItem = (e) => {
    if (dragging !== null) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const { clientX, clientY } = getCoords(e);
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y2temp = ((clientY - rect.top) / rect.height) * 100;
    if (tool === "flecha") {
      if (!arrowStart) { setArrowStart({ x, y: y2temp }); return; }
      onChange([...items, { id: Date.now(), type: "flecha", x: arrowStart.x, y: arrowStart.y, x2: x, y2: y2temp }]);
      setArrowStart(null); return;
    }
    const y = ((clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    if (["erase", "move", "pencil"].includes(tool)) return;
    const isPlayer = tool.startsWith("player_");
    const newItem = { id: Date.now(), x, y, type: tool, ...(isPlayer ? { num: playerNum } : {}) };
    if (isPlayer) setPlayerNum(n => n + 1);
    onChange([...items, newItem]);
  };

  const startDrag = (e, id) => {
    e.stopPropagation(); if (e.preventDefault) e.preventDefault();
    const rect = fieldRef.current.getBoundingClientRect();
    const item = items.find(i => i.id === id);
    setDragOffset({ x: e.clientX - rect.left - (item.x / 100) * rect.width, y: e.clientY - rect.top - (item.y / 100) * rect.height });
    setDragging(id);
  };

  const onMouseMove = (e) => {
    if (dragging === null) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100));
    onChange(items.map(i => i.id === dragging ? { ...i, x, y } : i));
  };

  const onMouseUp = () => setDragging(null);
  const removeItem = (id) => onChange(items.filter(i => i.id !== id));
  const saveEditNum = (id, num) => { onChange(items.map(i => i.id === id ? { ...i, num } : i)); setEditingItem(null); };

  const renderItem = (item) => {
    if (!item || typeof item !== 'object' || !item.type || typeof item.type !== 'string') return null;
    if (item.type === "flecha") {
      if (item.x2 == null || item.y2 == null) return null;
      return (
        <svg key={item.id} className="absolute inset-0 w-full h-full" style={{ zIndex: 5, pointerEvents: tool === "erase" ? "auto" : "none" }}>
          <defs><marker id={`arr-${item.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="white"/></marker></defs>
          <line x1={`${item.x}%`} y1={`${item.y}%`} x2={`${item.x2}%`} y2={`${item.y2}%`} stroke="white" strokeWidth="8" strokeOpacity="0" onMouseDown={e => { e.stopPropagation(); if (tool === "erase") removeItem(item.id); }} style={{ cursor: tool === "erase" ? "crosshair" : "default" }}/>
          <line x1={`${item.x}%`} y1={`${item.y}%`} x2={`${item.x2}%`} y2={`${item.y2}%`} stroke="white" strokeWidth="2.5" markerEnd={`url(#arr-${item.id})`} style={{ pointerEvents: "none" }}/>
        </svg>
      );
    }
    const isPlayer = item.type.startsWith("player_");
    const color = isPlayer ? item.type.replace("player_", "") : null;
    const mat = !isPlayer ? MATERIALS.find(m => m.id === item.type) : null;
    return (
      <div key={item.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ left: `${item.x}%`, top: `${item.y}%`, cursor: tool === "erase" ? "crosshair" : "grab", zIndex: dragging === item.id ? 10 : 1 }}
        onMouseDown={e => { if (tool === "erase") { e.stopPropagation(); removeItem(item.id); } else startDrag(e, item.id); }}
        onTouchStart={e => { e.stopPropagation(); if (tool === "erase") { removeItem(item.id); } else { const t = e.touches[0]; startDrag({ clientX: t.clientX, clientY: t.clientY, stopPropagation: () => e.stopPropagation(), preventDefault: () => e.preventDefault() }, item.id); } }}
        onDoubleClick={e => { e.stopPropagation(); if (isPlayer) setEditingItem({ id: item.id, num: item.num ?? "" }); }}
      >
        {isPlayer ? (
          (editingItem?.id === item.id) ? (
            <input autoFocus type="number" defaultValue={editingItem?.num ?? ""}
              className="w-7 h-7 rounded-full text-center font-bold border-2 bg-zinc-900 text-white border-white outline-none"
              style={{ fontSize: 10 }}
              onBlur={e => saveEditNum(item.id, e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveEditNum(item.id, e.target.value); if (e.key === "Escape") setEditingItem(null); }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-white font-bold shadow-lg" style={{ backgroundColor: PLAYER_COLOR_HEX2[color] || "#16a34a", borderColor: PLAYER_COLOR_HEX2[color] || "#16a34a", fontSize: 10 }}>
              {item.num != null ? item.num : ""}
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
      <div className="flex gap-1 flex-wrap">
        {FIELD_TYPES.map(f => (
          <button key={f.id} onClick={() => setFieldType(f.id)}
            className={`text-xs px-3 py-1 rounded border transition-all ${fieldType === f.id ? "bg-zinc-600 border-zinc-400 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >{f.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 items-center flex-wrap">
          <span className="text-xs text-zinc-500 mr-1">Jugadores:</span>
          {PLAYER_COLORS.map(c => (
            <button key={c} onClick={() => setTool(`player_${c}`)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${PLAYER_COLOR_STYLES[c]} ${tool === `player_${c}` ? "scale-125 ring-2 ring-white" : "opacity-70"}`}
            />
          ))}
          {tool.startsWith("player_") && (
            <div className="flex items-center gap-1 ml-1">
              <span className="text-xs text-zinc-500">#</span>
              <input type="number" value={playerNum} onChange={e => setPlayerNum(Number(e.target.value))}
                className="w-12 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white text-xs text-center focus:outline-none focus:border-green-600"
              />
            </div>
          )}
        </div>
        <div className="flex gap-1 items-center flex-wrap">
          <span className="text-xs text-zinc-500 mr-1">Material:</span>
          {MATERIALS.map(m => (
            <button key={m.id} onClick={() => setTool(m.id)} title={m.label}
              className={`w-8 h-8 rounded flex items-center justify-center border transition-all ${tool === m.id ? "border-white bg-zinc-700 scale-110" : "border-zinc-700 bg-zinc-800 opacity-70 hover:opacity-100"}`}
            >{m.svg}</button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTool("move")} className={`px-2 py-1 rounded text-xs border transition-all ${tool === "move" ? "bg-blue-700 border-blue-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>✋ Mover</button>
          <button onClick={() => { setTool("pencil"); setPencilMode("draw"); pencilModeRef.current = "draw"; }} className={`px-2 py-1 rounded text-xs border transition-all ${tool === "pencil" ? "bg-purple-700 border-purple-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>✏️ Lápiz</button>
          <button onClick={() => setTool("erase")} className={`px-3 py-1 rounded text-xs border transition-all ${tool === "erase" ? "bg-green-700 border-green-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>🗑 Borrar</button>
        </div>
        {tool === "pencil" && (
          <div className="flex items-center gap-2 flex-wrap">
            {PENCIL_COLORS.map(c => (
              <button key={c.color} onClick={() => setPencilColor(c.color)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${pencilColor === c.color ? "border-white scale-125" : "border-zinc-600"}`}
                style={{ backgroundColor: c.color }} title={c.label}/>
            ))}
            <div className="w-px h-4 bg-zinc-600"/>
            {PENCIL_SIZES.map(s => (
              <button key={s.size} onClick={() => setPencilSize(s.size)}
                className={`px-2 py-0.5 rounded text-xs border transition-all ${pencilSize === s.size ? "bg-purple-700 border-purple-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
              >{s.label}</button>
            ))}
            <button onClick={() => { setPencilMode("erase"); pencilModeRef.current = "erase"; }}
              className={`px-2 py-0.5 rounded text-xs border transition-all ml-2 ${pencilMode === "erase" ? "bg-green-700 border-green-500 text-white" : "bg-zinc-800 border-zinc-600 text-zinc-300"}`}
            >🧹 Goma</button>
          </div>
        )}
        <button onClick={() => { onChange([]); setPlayerNum(1); }}
          className="px-3 py-1 rounded text-xs border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-green-700 hover:text-green-400 transition-all"
        >Limpiar</button>
      </div>
      <p className="text-xs text-zinc-600">Haz clic para añadir · Arrastra para mover · Doble clic en jugador para editar número</p>
      <div ref={fieldRef} className="relative w-full rounded-xl overflow-hidden select-none"
        style={{ paddingBottom: "65%", background: "#b05a14", cursor: tool === "pencil" ? "crosshair" : tool === "erase" ? "cell" : "crosshair" }}
        onClick={(e) => { if (tool === "pencil") return; addItem(e); }}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => { setDragging(null); onMouseUp(); }}
        onMouseDown={(e) => { if (tool === "pencil") { /* handled by useEffect */ } if (tool === "erase") erasingRef.current = true; }}
        onTouchMove={e => { e.preventDefault(); onMouseMove(e.touches[0]); }} onTouchEnd={onMouseUp}
      >
        <FieldMarkings type={fieldType} />
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }} viewBox="0 0 100 100" preserveAspectRatio="none">
          {items.filter(i => i.type === "drawing").map(item => (
            <polyline key={item.id} points={item.path.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={item.color || "#fff"} strokeWidth={item.size || 2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
          ))}
          {drawing && currentPath.length > 1 && (
            <polyline points={currentPath.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={pencilColor} strokeWidth={pencilSize} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
          )}
        </svg>
        <div className="absolute inset-0">{items.filter(i => i.type !== "drawing").map(renderItem)}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TASK EDITOR MODAL
// ══════════════════════════════════════════════════════════════════════════════
const TASK_CATEGORIES = [
  { id: "tecnico", label: "🏀 Técnico", color: "green" },
  { id: "tactico", label: "♟️ Táctico", color: "blue" },
  { id: "fisico", label: "💪 Físico", color: "yellow" },
  { id: "especifico", label: "🎯 Específico por posición", color: "zinc" },
  { id: "estrategico", label: "📋 Estratégico", color: "blue" },
  { id: "globalizado", label: "🔄 Globalizado / Juego real", color: "green" },
  { id: "psicologico", label: "🧠 Psicológico", color: "zinc" },
  { id: "contraataque", label: "⚡ Contraataque", color: "yellow" },
  { id: "defensa_zona", label: "🛡 Defensa zona", color: "red" },
  { id: "bloqueo", label: "🤝 Bloqueo directo / P&R", color: "green" },
  { id: "tiro", label: "🎯 Tiro", color: "zinc" },
  { id: "poste", label: "📍 Juego de poste", color: "blue" },
  { id: "calentamiento", label: "🏃 Calentamiento", color: "zinc" },
];

// Niveles de dificultad para ejercicios
const DIFICULTAD_OPTS = [
  { id: "baja", label: "Baja" },
  { id: "media", label: "Media" },
  { id: "alta", label: "Alta" },
  { id: "maxima", label: "Máxima" },
];

// Grupos de edad de referencia FEB
const EDAD_OPTS = [
  { id: "sub8", label: "Sub-8 (Baby)" },
  { id: "sub10", label: "Sub-10 (Prebenjamín)" },
  { id: "sub12", label: "Sub-12 (Benjamín)" },
  { id: "sub14", label: "Sub-14 (Alevín)" },
  { id: "sub16", label: "Sub-16 (Infantil)" },
  { id: "sub18", label: "Sub-18 (Cadete/Junior)" },
  { id: "senior", label: "Senior" },
];

function TaskEditorModal({ task, onSave, onClose, saveToLibrary }) {
  const [nombre, setNombre] = useState(task?.nombre || "");
  const [minutos, setMinutos] = useState(task?.minutos || 10);
  const [desc, setDesc] = useState(task?.desc || "");
  const [categoria, setCategoria] = useState(task?.categoria || "tecnico");
  const [pizarra, setPizarra] = useState((task?.pizarra || []).filter(el => el != null).map((el, idx) => {
    if (!el || typeof el !== 'object' || !el.type) return null;
    if (!el.id) return { ...el, id: Date.now() + idx };
    return el;
  }).filter(Boolean));
  const [fieldType, setFieldType] = useState(task?.fieldType || "full");

  const handleSave = () => {
    if (!nombre.trim()) return;
    const t = { id: task?.id || Date.now(), nombre, minutos, desc, categoria, pizarra: pizarra.filter(el => el != null && el.type), fieldType };
    onSave(t);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-2xl my-4">
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-white font-bold text-lg">{task?.id ? "Editar ejercicio" : "Nuevo ejercicio"}</h3>
          <Btn small variant="secondary" onClick={onClose}>✕</Btn>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre del ejercicio" value={nombre} onChange={e => setNombre(e.target.value)} />
            <Input label="Duración (min)" type="number" value={minutos} onChange={e => setMinutos(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {TASK_CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCategoria(c.id)}
                  className={`text-xs px-3 py-1.5 rounded border transition-all ${categoria === c.id ? "bg-green-700 border-green-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
                >{c.label}</button>
              ))}
            </div>
          </div>
          <Textarea label="Descripción / Instrucciones" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe el ejercicio..." />
          <div>
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Pizarra táctica</label>
            <Pizarra value={pizarra} onChange={setPizarra} fieldType={fieldType} onFieldTypeChange={setFieldType} />
          </div>
        </div>
        <div className="p-5 border-t border-zinc-800 flex gap-2 flex-wrap">
          <Btn onClick={handleSave}>Guardar ejercicio</Btn>
          {saveToLibrary && <Btn variant="secondary" onClick={() => saveToLibrary({ id: task?.id || Date.now(), nombre, minutos, desc, categoria, pizarra: pizarra.filter(el => el != null && el.type), fieldType })}>💾 Guardar en biblioteca</Btn>}
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Tareas / Ejercicios
// ══════════════════════════════════════════════════════════════════════════════
function TareasSection({ team, data, onSave, globalTasks, onSaveGlobal, isCoord }) {
  const [editing, setEditing] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [libTab, setLibTab] = useState("equipo");
  const [viewingTask, setViewingTask] = useState(null);

  const openEdit = (t) => { setEditing({ ...t, pizarra: (t.pizarra || []).filter(el => el != null) }); setShowEditor(true); };
  const openNew = () => { setEditing(null); setShowEditor(true); };

  const tasks = data.tasks || [];

  const saveTask = (t) => {
    const existing = tasks.findIndex(x => x.id === t.id);
    const updated = existing >= 0 ? tasks.map(x => x.id === t.id ? t : x) : [...tasks, t];
    onSave({ ...data, tasks: updated });
    setShowEditor(false);
  };

  const delTask = (id) => {
    if (!window.confirm("¿Eliminar ejercicio?")) return;
    onSave({ ...data, tasks: tasks.filter(t => t.id !== id) });
  };

  const saveToLibrary = (t) => {
    const existing = (globalTasks || []).findIndex(x => x.id === t.id);
    const updated = existing >= 0 ? globalTasks.map(x => x.id === t.id ? t : x) : [...(globalTasks || []), t];
    onSaveGlobal(updated);
  };

  const addFromLibrary = (t) => {
    const newTask = { ...t, id: Date.now() };
    onSave({ ...data, tasks: [...tasks, newTask] });
  };

  const activeTasks = libTab === "equipo" ? (tasks || []).filter(t => t != null) : (globalTasks || []).filter(t => t != null);

  return (
    <div className="space-y-4">
      {showEditor && (
        <TaskEditorModal
          task={editing}
          onSave={saveTask}
          onClose={() => setShowEditor(false)}
          saveToLibrary={isCoord ? saveToLibrary : null}
        />
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Ejercicios — {team}</h2>
        <Btn onClick={openNew}>+ Nuevo ejercicio</Btn>
      </div>
      <div className="flex gap-2">
        {["equipo", "biblioteca"].map(tab => (
          <button key={tab} onClick={() => setLibTab(tab)}
            className={`px-3 py-1.5 rounded text-sm border transition-all ${libTab === tab ? "bg-green-700 border-green-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >{tab === "equipo" ? "📋 Mi equipo" : "📚 Biblioteca"}</button>
        ))}
      </div>
      <div className="space-y-3">
        {activeTasks.length === 0 && <p className="text-zinc-500 text-sm">No hay ejercicios todavía.</p>}
        {activeTasks.map(t => {
          const cat = TASK_CATEGORIES.find(c => c.id === t.categoria);
          return (
            <Card key={t.id} className="hover:border-zinc-600 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-white font-semibold">{t.nombre}</span>
                    {cat && <Badge color={cat.color}>{cat.label}</Badge>}
                    <Badge color="zinc">⏱ {t.minutos} min</Badge>
                  </div>
                  {t.desc && <p className="text-zinc-400 text-sm">{t.desc}</p>}
                </div>
                <div className="flex gap-1 ml-3 shrink-0">
                  {libTab === "biblioteca" && <Btn small variant="secondary" onClick={() => addFromLibrary(t)}>➕ Añadir</Btn>}
                  <Btn small variant="ghost" onClick={() => setViewingTask(viewingTask?.id === t.id ? null : t)}>👁</Btn>
                  <Btn small variant="secondary" onClick={() => openEdit(t)}>✏️</Btn>
                  {libTab === "equipo" && <Btn small variant="danger" onClick={() => delTask(t.id)}>🗑️</Btn>}
                </div>
                {viewingTask?.id === t.id && (
                  <div className="mt-3 border-t border-zinc-700 pt-3">
                    {t.desc && <p className="text-zinc-300 text-sm mb-3 whitespace-pre-wrap">{t.desc}</p>}
                    {t.pizarra && t.pizarra.length > 0 && (
                      <div className="pointer-events-none opacity-90">
                        <Pizarra value={t.pizarra} onChange={() => {}} fieldType={t.fieldType || "full"} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Entrenamientos
// ══════════════════════════════════════════════════════════════════════════════
function EntrenamientosSection({ team, data, onSave, isCoord, globalTasks = [] }) {
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [taskEditor, setTaskEditor] = useState(null);

  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [lugar, setLugar] = useState("");
  const [desc, setDesc] = useState("");
  const [duracion, setDuracion] = useState(90);

  const coachAttStatusOpts = [
    { val: "present", label: "Asistió", color: "green" },
    { val: "late", label: "Tarde", color: "yellow" },
    { val: "absent", label: "No asistió", color: "red" },
  ];

  const setCoachAttRecord = (sessionId, coachId, status, sessionFecha) => {
    const coachAtt = [...(data.coachAttendance || [])].filter(a => !(a.sessionId === sessionId && a.coachId === coachId));
    coachAtt.push({ sessionId, coachId, status, fecha: sessionFecha });
    onSave({ ...data, coachAttendance: coachAtt });
  };

  const delCoachAttRecord = (sessionId, coachId) => {
    const coachAtt = (data.coachAttendance || []).filter(a => !(a.sessionId === sessionId && a.coachId === coachId));
    onSave({ ...data, coachAttendance: coachAtt });
  };

  const coachAttBtnClass = (recStatus, val, color) => {
    if (recStatus === val) {
      if (color === "green") return "bg-green-800 border-green-600 text-green-200";
      if (color === "yellow") return "bg-yellow-800 border-yellow-600 text-yellow-200";
      return "bg-red-800 border-red-600 text-red-200";
    }
    return "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500";
  };

  const openForm = (s = null) => {
    setEditing(s);
    setFecha(s ? s.fecha : "");
    setHora(s ? s.hora : "");
    setLugar(s ? s.lugar : "");
    setDesc(s ? s.desc : "");
    setDuracion(s ? (s.duracion || 90) : 90);
    setView("form");
  };

  const saveSession = () => {
    if (!fecha) return;
    const trainings = [...(data.trainings || [])];
    if (editing) {
      const idx = trainings.findIndex(t => t.id === editing.id);
      trainings[idx] = { ...editing, fecha, hora, lugar, desc, duracion };
    } else {
      trainings.push({ id: Date.now(), fecha, hora, lugar, desc, duracion, tasks: [] });
    }
    onSave({ ...data, trainings: trainings.sort((a, b) => b.fecha.localeCompare(a.fecha)) });
    setView("list");
  };

  const delSession = (id) => {
    if (!window.confirm("¿Eliminar sesión?")) return;
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

  const [attSession, setAttSession] = useState(null);
  const [coachAttSession, setCoachAttSession] = useState(null);
  const [detailSession, setDetailSession] = useState(null);
  const [showLibPicker, setShowLibPicker] = useState(false);

  const printTraining = (t) => {
    const totalMin = (t.tasks || []).reduce((s, x) => s + (x.minutos || 0), 0);
    const tasksHTML = (t.tasks || []).map((task, i) => `
      <div style="page-break-inside:avoid;margin-bottom:24px;border:1px solid #ddd;border-radius:8px;overflow:hidden">
        <div style="background:#166534;color:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;font-size:15px">#${i + 1} — ${task.nombre}</span>
          <span style="background:#15803d;color:white;padding:3px 12px;border-radius:12px;font-size:12px">⏱ ${task.minutos} min</span>
        </div>
        ${task.desc ? `<div style="padding:12px 16px;font-size:13px;color:#333;white-space:pre-wrap;border-bottom:1px solid #eee">${task.desc}</div>` : ""}
        ${(task.pizarra?.length > 0) ? (() => {
          const W = 500, H = 300;
          const isHalf = task.fieldType === "half";
          const isBlank = task.fieldType === "blank";
          const fullLines = `
            <rect x="10" y="10" width="480" height="280" fill="none" stroke="white" stroke-width="2" opacity="0.9"/>
            <line x1="250" y1="10" x2="250" y2="290" stroke="white" stroke-width="1.5" opacity="0.8"/>
            <circle cx="250" cy="150" r="45" fill="none" stroke="white" stroke-width="1.5" opacity="0.8"/>
            <rect x="10" y="101" width="104" height="98" fill="rgba(255,255,255,0.05)" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <path d="M114 101 A36 36 0 0 1 114 199" fill="none" stroke="white" stroke-width="1.5" opacity="0.8"/>
            <path d="M114 101 A36 36 0 0 0 114 199" fill="none" stroke="white" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.6"/>
            <line x1="10" y1="125" x2="10" y2="175" stroke="white" stroke-width="5" opacity="1"/>
            <line x1="10" y1="150" x2="38" y2="150" stroke="white" stroke-width="1.5" opacity="0.8"/>
            <circle cx="38" cy="150" r="9" fill="none" stroke="white" stroke-width="2" opacity="1"/>
            <path d="M38 138 A12 12 0 0 1 38 162" fill="none" stroke="white" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>
            <line x1="10" y1="20" x2="38" y2="20" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <line x1="10" y1="280" x2="38" y2="280" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <path d="M38 20 A96 96 0 0 1 38 280" fill="none" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <rect x="386" y="101" width="104" height="98" fill="rgba(255,255,255,0.05)" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <path d="M386 101 A36 36 0 0 0 386 199" fill="none" stroke="white" stroke-width="1.5" opacity="0.8"/>
            <path d="M386 101 A36 36 0 0 1 386 199" fill="none" stroke="white" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.6"/>
            <line x1="490" y1="125" x2="490" y2="175" stroke="white" stroke-width="5" opacity="1"/>
            <line x1="490" y1="150" x2="462" y2="150" stroke="white" stroke-width="1.5" opacity="0.8"/>
            <circle cx="462" cy="150" r="9" fill="none" stroke="white" stroke-width="2" opacity="1"/>
            <path d="M462 138 A12 12 0 0 0 462 162" fill="none" stroke="white" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>
            <line x1="490" y1="20" x2="462" y2="20" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <line x1="490" y1="280" x2="462" y2="280" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <path d="M462 20 A96 96 0 0 0 462 280" fill="none" stroke="white" stroke-width="1.5" opacity="0.9"/>
          `;
          const halfLines = `
            <rect x="10" y="10" width="480" height="280" fill="none" stroke="white" stroke-width="2" opacity="0.9"/>
            <rect x="10" y="101" width="104" height="98" fill="rgba(255,255,255,0.05)" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <path d="M114 101 A36 36 0 0 1 114 199" fill="none" stroke="white" stroke-width="1.5" opacity="0.8"/>
            <path d="M114 101 A36 36 0 0 0 114 199" fill="none" stroke="white" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.6"/>
            <line x1="10" y1="125" x2="10" y2="175" stroke="white" stroke-width="5" opacity="1"/>
            <line x1="10" y1="150" x2="38" y2="150" stroke="white" stroke-width="1.5" opacity="0.8"/>
            <circle cx="38" cy="150" r="9" fill="none" stroke="white" stroke-width="2" opacity="1"/>
            <path d="M38 138 A12 12 0 0 1 38 162" fill="none" stroke="white" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>
            <line x1="10" y1="20" x2="38" y2="20" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <line x1="10" y1="280" x2="38" y2="280" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <path d="M38 20 A96 96 0 0 1 38 280" fill="none" stroke="white" stroke-width="1.5" opacity="0.9"/>
            <path d="M490 130 A20 20 0 0 1 490 170" fill="none" stroke="white" stroke-width="1.5" opacity="0.6"/>
          `;
          const bg = `<rect width="${W}" height="${H}" fill="#b05a14"/>${isBlank ? "" : isHalf ? halfLines : fullLines}`;
          const PHEX = { red:"#dc2626", yellow:"#eab308", blue:"#2563eb", green:"#16a34a" };
          const drawingsSVG = (task.pizarra||[]).filter(i=>i&&i.type==="drawing"&&Array.isArray(i.path)&&i.path.length>0).map(item=>{
            const pts = item.path.map(p=>`${(p.x/100)*W},${(p.y/100)*H}`).join(" ");
            return `<polyline points="${pts}" fill="none" stroke="${item.color||"#fff"}" stroke-width="${item.size||2}" stroke-linecap="round" stroke-linejoin="round"/>`;
          }).join("");
          const itemsSVG = (task.pizarra||[]).filter(i=>i&&i.type&&i.type!=="drawing").map(item=>{
            if(item.type==="flecha"){const fx1=(item.x||0)/100*W,fy1=(item.y||0)/100*H,fx2=(item.x2||0)/100*W,fy2=(item.y2||0)/100*H,aid=`a${Math.round(fx1)}${Math.round(fy1)}`;return `<defs><marker id="${aid}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="white"/></marker></defs><line x1="${fx1}" y1="${fy1}" x2="${fx2}" y2="${fy2}" stroke="white" stroke-width="2.5" marker-end="url(#${aid})"/>`;}
            const cx=(item.x/100)*W,cy=(item.y/100)*H;
            if(item.type.startsWith("player_")){const c=item.type.replace("player_","");return `<circle cx="${cx}" cy="${cy}" r="14" fill="${PHEX[c]||"#dc2626"}" stroke="white" stroke-width="1.5"/><text x="${cx}" y="${cy+4}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${item.num??""}</text>`;}
            if(item.type==="cono")return `<polygon points="${cx},${cy-10} ${cx-6},${cy+6} ${cx+6},${cy+6}" fill="#f97316"/>`;
            if(item.type==="cono_azul")return `<polygon points="${cx},${cy-10} ${cx-6},${cy+6} ${cx+6},${cy+6}" fill="#2563eb"/>`;
            if(item.type==="aro")return `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#22d3ee" stroke-width="2.5"/>`;
            if(item.type==="aro_rojo")return `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#dc2626" stroke-width="2.5"/>`;
            if(item.type==="aro_amarillo")return `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#eab308" stroke-width="2.5"/>`;
            if(item.type==="balon")return `<circle cx="${cx}" cy="${cy}" r="12" fill="#f97316" stroke="#c2410c" stroke-width="1.5"/><path d="M${cx} ${cy-12} A12 12 0 0 1 ${cx} ${cy+12}" fill="none" stroke="#c2410c" stroke-width="1.5"/><path d="M${cx-12} ${cy} A12 12 0 0 1 ${cx+12} ${cy}" fill="none" stroke="#c2410c" stroke-width="1.5"/><path d="M${cx-10} ${cy-6} Q${cx} ${cy-3} ${cx+10} ${cy-6}" fill="none" stroke="#c2410c" stroke-width="1"/><path d="M${cx-10} ${cy+6} Q${cx} ${cy+3} ${cx+10} ${cy+6}" fill="none" stroke="#c2410c" stroke-width="1"/>`;
            if(item.type==="escalera")return `<rect x="${cx-10}" y="${cy-13}" width="20" height="26" fill="none" stroke="#f59e0b" stroke-width="2"/><line x1="${cx-10}" y1="${cy-5}" x2="${cx+10}" y2="${cy-5}" stroke="#f59e0b" stroke-width="1.5"/><line x1="${cx-10}" y1="${cy+3}" x2="${cx+10}" y2="${cy+3}" stroke="#f59e0b" stroke-width="1.5"/>`;
            if(item.type==="canasta")return `<rect x="${cx-20}" y="${cy-7}" width="20" height="10" fill="none" stroke="white" stroke-width="1.8"/><line x1="${cx}" y1="${cy-2}" x2="${cx+12}" y2="${cy-2}" stroke="white" stroke-width="1.8"/><circle cx="${cx+19}" cy="${cy-2}" r="9" fill="none" stroke="white" stroke-width="2"/><line x1="${cx+19}" y1="${cy+7}" x2="${cx+19}" y2="${cy+20}" stroke="white" stroke-width="1.8"/><line x1="${cx+10}" y1="${cy+20}" x2="${cx+28}" y2="${cy+20}" stroke="white" stroke-width="1.8"/>`;
            if(item.type==="pesa")return `<circle cx="${cx-8}" cy="${cy}" r="5" fill="none" stroke="#a78bfa" stroke-width="2"/><circle cx="${cx+8}" cy="${cy}" r="5" fill="none" stroke="#a78bfa" stroke-width="2"/><line x1="${cx-8}" y1="${cy}" x2="${cx+8}" y2="${cy}" stroke="#a78bfa" stroke-width="3"/>`;
            return `<circle cx="${cx}" cy="${cy}" r="8" fill="#888"/>`;
          }).join("");
          return `<div style="padding:12px 16px;background:#f0f0f0"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="border-radius:8px;display:block;margin:0 auto">${bg}${drawingsSVG}${itemsSVG}</svg></div>`;
        })() : `<div style="padding:10px 16px;font-size:12px;color:#999;font-style:italic">Sin pizarra</div>`}
      </div>
    `).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Entrenamiento ${t.fecha}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; max-width: 820px; margin: 0 auto; color: #111; }
      h1 { font-size: 22px; margin: 0 0 6px; }
      .club { font-size: 13px; color: #888; margin-bottom: 4px; }
      .meta { display:flex; gap:16px; font-size:13px; color:#555; margin-bottom:20px; padding-bottom:12px; border-bottom:2px solid #16a34a; }
      .section-title { font-size:16px; font-weight:700; color:#166534; margin-bottom:14px; padding-bottom:4px; border-bottom:1px solid #ddd; }
      @media print { body { padding:16px; } }
    </style></head><body>
    <div class="club">Amics Castelló — ${team}</div>
    <h1>🏀 Entrenamiento del ${t.fecha}${t.hora ? " · " + t.hora : ""}${t.lugar ? " · " + t.lugar : ""}</h1>
    <div class="meta">
      <span>🗂 ${(t.tasks || []).length} ejercicios</span>
      <span>⏱ ${totalMin} min${t.duracion ? " / " + t.duracion + " min" : ""}</span>
    </div>
    ${t.desc ? `<div style="background:#f8f8f8;border-left:4px solid #16a34a;padding:12px 16px;margin-bottom:24px;font-size:13px">${t.desc}</div>` : ""}
    <div class="section-title">Ejercicios</div>
    ${(t.tasks || []).length > 0 ? tasksHTML : "<p style='color:#999;font-style:italic'>Sin ejercicios.</p>"}
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  if (view === "form") return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Btn variant="ghost" onClick={() => setView("list")}>← Volver</Btn>
        <h2 className="text-xl font-bold text-white">{editing ? "Editar sesión" : "Nueva sesión"}</h2>
      </div>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          <Input label="Hora" type="time" value={hora} onChange={e => setHora(e.target.value)} />
          <Input label="Lugar" value={lugar} onChange={e => setLugar(e.target.value)} />
          <Input label="Duración sesión (min)" type="number" value={duracion} onChange={e => setDuracion(Number(e.target.value))} />
        </div>
        <div className="mt-3">
          <Textarea label="Notas / Descripción" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <div className="flex gap-2 mt-4">
          <Btn onClick={saveSession}>Guardar sesión</Btn>
          <Btn variant="secondary" onClick={() => setView("list")}>Cancelar</Btn>
        </div>
      </Card>
    </div>
  );

  if (detailSession) {
    const session = (data.trainings || []).find(t => t.id === detailSession.id) || detailSession;
    const sessionTasks = session.tasks || [];
    return (
      <div className="space-y-4">
        {taskEditor && (
          <TaskEditorModal
            task={taskEditor}
            onSave={(t) => {
              const existing = sessionTasks.findIndex(x => x.id === t.id);
              const updated = existing >= 0 ? sessionTasks.map(x => x.id === t.id ? t : x) : [...sessionTasks, t];
              const trainings = (data.trainings || []).map(tr => tr.id === session.id ? { ...tr, tasks: updated } : tr);
              onSave({ ...data, trainings });
              setDetailSession({ ...session, tasks: updated });
              setTaskEditor(null);
            }}
            onClose={() => setTaskEditor(null)}
          />
        )}
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={() => setDetailSession(null)}>← Volver</Btn>
          <h2 className="text-xl font-bold text-white">🏀 {session.fecha} {session.hora && `· ${session.hora}`}</h2>
        </div>
        {session.desc && <Card><p className="text-zinc-300 text-sm">{session.desc}</p></Card>}
        <div className="flex justify-between items-center">
          <p className="text-sm font-semibold text-zinc-300">Ejercicios de la sesión</p>
          <div className="flex gap-2">
            <Btn small variant="secondary" onClick={() => setShowLibPicker(!showLibPicker)}>📚 Desde biblioteca</Btn>
            <Btn small onClick={() => { setShowLibPicker(false); setTaskEditor({}); }}>+ Nuevo ejercicio</Btn>
          </div>
        </div>
        {showLibPicker && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-2">
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Selecciona de la biblioteca</p>
            {(globalTasks || []).length === 0 && <p className="text-zinc-500 text-sm">La biblioteca está vacía.</p>}
            {(globalTasks || []).map(t => {
              const cat = TASK_CATEGORIES.find(c => c.id === t.categoria);
              return (
                <div key={t.id} className="flex items-center gap-3 bg-zinc-900 rounded-lg px-3 py-2">
                  <div className="flex-1">
                    <span className="text-white text-sm font-semibold">{t.nombre}</span>
                    <span className="text-zinc-500 text-xs ml-2">⏱ {t.minutos} min</span>
                  </div>
                  <Btn small onClick={() => {
                    const newTask = { ...t, id: Date.now() };
                    const updated = [...sessionTasks, newTask];
                    const trainings = (data.trainings || []).map(tr => tr.id === session.id ? { ...tr, tasks: updated } : tr);
                    onSave({ ...data, trainings });
                    setDetailSession({ ...session, tasks: updated });
                    setShowLibPicker(false);
                  }}>➕ Añadir</Btn>
                </div>
              );
            })}
          </div>
        )}
        {sessionTasks.length === 0 && <p className="text-zinc-500 text-sm">Sin ejercicios en esta sesión.</p>}
        {sessionTasks.map((t, idx) => {
          const cat = TASK_CATEGORIES.find(c => c.id === t.categoria);
          return (
            <Card key={t.id}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex gap-2 flex-wrap mb-1">
                    <span className="text-zinc-500 font-bold text-sm">#{idx + 1}</span>
                    <span className="text-white font-semibold">{t.nombre}</span>
                    {cat && <Badge color={cat.color}>{cat.label}</Badge>}
                    <Badge color="zinc">⏱ {t.minutos} min</Badge>
                  </div>
                  {t.desc && <p className="text-zinc-400 text-sm">{t.desc}</p>}
                </div>
                <div className="flex gap-1">
                  <Btn small variant="ghost" onClick={() => {
                    const i = sessionTasks.findIndex(x => x.id === t.id);
                    if (i === 0) return;
                    const updated = [...sessionTasks];
                    [updated[i-1], updated[i]] = [updated[i], updated[i-1]];
                    const trainings = (data.trainings||[]).map(tr => tr.id === session.id ? {...tr, tasks: updated} : tr);
                    onSave({...data, trainings});
                    setDetailSession({...session, tasks: updated});
                  }}>↑</Btn>
                  <Btn small variant="ghost" onClick={() => {
                    const i = sessionTasks.findIndex(x => x.id === t.id);
                    if (i === sessionTasks.length - 1) return;
                    const updated = [...sessionTasks];
                    [updated[i+1], updated[i]] = [updated[i], updated[i+1]];
                    const trainings = (data.trainings||[]).map(tr => tr.id === session.id ? {...tr, tasks: updated} : tr);
                    onSave({...data, trainings});
                    setDetailSession({...session, tasks: updated});
                  }}>↓</Btn>
                  <Btn small variant="secondary" onClick={() => setTaskEditor(t)}>✏️</Btn>
                  <Btn small variant="danger" onClick={() => {
                    const updated = sessionTasks.filter(x => x.id !== t.id);
                    const trainings = (data.trainings || []).map(tr => tr.id === session.id ? { ...tr, tasks: updated } : tr);
                    onSave({ ...data, trainings });
                    setDetailSession({ ...session, tasks: updated });
                  }}>🗑️</Btn>
                </div>
              </div>
              {t.pizarra && t.pizarra.length > 0 && (
                <div className="mt-3 pointer-events-none opacity-80">
                  <Pizarra value={t.pizarra} onChange={() => {}} fieldType={t.fieldType || "full"} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Entrenamientos — {team}</h2>
        <Btn onClick={() => openForm()}>+ Nueva sesión</Btn>
      </div>
      <div className="space-y-3">
        {(data.trainings || []).length === 0 && <p className="text-zinc-500 text-sm">No hay sesiones registradas.</p>}
        {(data.trainings || []).map(s => (
          <Card key={s.id} className="hover:border-zinc-600 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-white font-semibold">🏀 {s.fecha}</span>
                  {s.hora && <Badge color="zinc">⏰ {s.hora}</Badge>}
                  {s.lugar && <span className="text-zinc-400 text-sm">📍 {s.lugar}</span>}
                </div>
                {s.desc && <p className="text-zinc-500 text-sm truncate max-w-xs">{s.desc}</p>}
                {(s.tasks || []).length > 0 && (() => {
                  const sess = (data.trainings||[]).find(x=>x.id===s.id)||s;
                  const totalMin = (sess.tasks||[]).reduce((a,t)=>a+(t.minutos||0),0);
                  const pct = sess.duracion ? Math.min(100, Math.round((totalMin/sess.duracion)*100)) : null;
                  const pctColor = pct >= 100 ? "bg-green-500" : pct >= 75 ? "bg-yellow-500" : "bg-blue-500";
                  return (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">🗂 {s.tasks.length} ejercicio{s.tasks.length !== 1 ? "s" : ""} · {totalMin} min</span>
                        {pct !== null && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${pct>=100?"bg-green-900 text-green-300":pct>=75?"bg-yellow-900 text-yellow-300":"bg-blue-900 text-blue-300"}`}>{pct}%</span>}
                        {pct >= 100 && <span className="text-xs text-green-400">✅ Sesión completa</span>}
                      </div>
                      {pct !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">{totalMin} min</span>
                          <div className="flex-1 bg-zinc-800 rounded-full h-2">
                            <div className={`${pctColor} h-2 rounded-full transition-all`} style={{width: Math.min(100,pct)+"%"}}/>
                          </div>
                          <span className="text-xs text-zinc-500">{sess.duracion} min</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-1 ml-3" onClick={e => e.stopPropagation()}>
                <Btn small variant="primary" onClick={() => setDetailSession(s)}>📋 Ver sesión</Btn>
                <Btn small variant="secondary" onClick={() => { const t = (data.trainings||[]).find(x=>x.id===s.id)||s; printTraining(t); }}>🖨️ PDF</Btn>
                <Btn small variant="secondary" onClick={() => setAttSession(s)}>👥 Jugadores</Btn>
                {(data.coaches || []).length > 0 && isCoord && <Btn small variant="secondary" onClick={() => setCoachAttSession(s)}>🧑‍🏫</Btn>}
                <Btn small variant="secondary" onClick={() => openForm(s)}>✏️</Btn>
                <Btn small variant="danger" onClick={() => delSession(s.id)}>🗑️</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Asistencia modal */}
      {attSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setAttSession(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">Asistencia jugadores</h3>
                <p className="text-zinc-400 text-sm">{attSession.fecha} · {attSession.lugar}</p>
              </div>
              <Btn small variant="secondary" onClick={() => setAttSession(null)}>✕</Btn>
            </div>
            <div className="p-5 space-y-2">
              {(data.players || []).length === 0 && <p className="text-zinc-500 text-sm">No hay jugadores en la plantilla.</p>}
              {(data.players || []).map(p => {
                const sessionId = `t_${attSession.id}`;
                const rec = (data.attendance || []).find(a => a.sessionId === sessionId && a.playerId === p.id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-white text-sm font-semibold flex-1">{p.name}</span>
                    <div className="flex gap-1">
                      {statusOpts.map(opt => (
                        <button key={opt.val} onClick={() => setAttRecord(sessionId, p.id, p.name, opt.val, attSession.fecha)}
                          className={`text-xs px-2 py-1 rounded border transition-all ${statusBtnClass(rec?.status, opt.val, opt.color)}`}
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
      {coachAttSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setCoachAttSession(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">🧑‍🏫 Entrenadores</h3>
                <p className="text-zinc-400 text-sm">{coachAttSession.fecha}</p>
              </div>
              <Btn small variant="secondary" onClick={() => setCoachAttSession(null)}>✕</Btn>
            </div>
            <div className="p-5 space-y-2">
              {(data.coaches || []).map(c => {
                const sessionId = `t_${coachAttSession.id}`;
                const rec = (data.coachAttendance || []).find(a => a.sessionId === sessionId && a.coachId === c.id);
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-white text-sm font-semibold flex-1">{c.name}</span>
                    <div className="flex gap-1">
                      {coachAttStatusOpts.map(opt => (
                        <button key={opt.val} onClick={() => setCoachAttRecord(sessionId, c.id, opt.val, coachAttSession.fecha)}
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Partidos
// ══════════════════════════════════════════════════════════════════════════════
function PartidosSection({ team, data, onSave, isCoord }) {
  const [view, setView] = useState("list");
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

  const [rival, setRival] = useState("");
  const [lugar, setLugar] = useState("");
  const [fecha, setFecha] = useState("");
  const [puntosLocal, setPuntosLocal] = useState("");
  const [puntosVisitante, setPuntosVisitante] = useState("");
  const [rivales, setRivales] = useState([{ num: "", nombre: "" }, { num: "", nombre: "" }]);

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
      setPuntosLocal(parts[0]?.trim() || "");
      setPuntosVisitante(parts[1]?.trim() || "");
    } else { setPuntosLocal(""); setPuntosVisitante(""); }
    setRivales(m?.mejoresRivales || [{ num: "", nombre: "" }, { num: "", nombre: "" }]);
    setView("form");
  };

  const saveMatch = () => {
    if (!rival) return;
    const resultado = puntosLocal !== "" && puntosVisitante !== "" ? `${puntosLocal}-${puntosVisitante}` : "";
    const matches = [...(data.matches || [])];
    if (editing) {
      const idx = matches.findIndex(m => m.id === editing.id);
      matches[idx] = { ...editing, rival, lugar, fecha, resultado, mejoresRivales: rivales };
    } else {
      const players = data.players || [];
      const convocatoria = players.map(p => ({
        playerId: p.id, playerName: p.name,
        status: "no_conv", minutos: 0, puntos: 0, asistencias: 0, rebotes: 0, rebotesOf: 0, tapones: 0, robos: 0, perdidas: 0, faltas: 0, nota: ""
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
      return { ...m, convocatoria: m.convocatoria.map(c => c.playerId === playerId ? { ...c, [field]: value } : c) };
    });
    const updated = matches.find(m => m.id === matchId);
    setActiveMatch(updated);
    onSave({ ...data, matches });
  };

  useEffect(() => {
    const matches = data.matches || [];
    const players = data.players || [];
    let changed = false;
    const newMatches = matches.map(m => {
      const conv = m.convocatoria || [];
      const newEntries = players
        .filter(p => !conv.find(c => c.playerId === p.id))
        .map(p => ({ playerId: p.id, playerName: p.name, status: "no_conv", minutos: 0, puntos: 0, asistencias: 0, rebotes: 0, rebotesOf: 0, tapones: 0, robos: 0, perdidas: 0, faltas: 0, nota: "" }));
      if (newEntries.length) { changed = true; return { ...m, convocatoria: [...conv, ...newEntries] }; }
      return m;
    });
    if (changed) onSave({ ...data, matches: newMatches });
  }, [data.players?.length]);

  const statusColor = { titular: "green", suplente: "blue", no_conv: "zinc" };
  const statusLabel = { titular: "Titular", suplente: "Suplente", no_conv: "No conv." };

  const parseResult = (r) => {
    if (!r) return null;
    const p = r.split("-").map(n => parseInt(n.trim()));
    return (p.length === 2 && !p.some(isNaN)) ? p : null;
  };

  const getResultBadge = (resultado) => {
    const parts = parseResult(resultado);
    if (!parts) return <Badge color="zinc">Sin resultado</Badge>;
    const [pf, pc] = parts;
    if (pf > pc) return <Badge color="green">Victoria</Badge>;
    if (pf < pc) return <Badge color="red">Derrota</Badge>;
    return <Badge color="yellow">Empate</Badge>;
  };

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
              <input type="number" min="0" value={puntosLocal} onChange={e => setPuntosLocal(e.target.value)} placeholder="0"
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-green-600 w-full text-center font-bold text-lg"
              />
              <span className="text-white font-black text-xl shrink-0">—</span>
              <input type="number" min="0" value={puntosVisitante} onChange={e => setPuntosVisitante(e.target.value)} placeholder="0"
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-green-600 w-full text-center font-bold text-lg"
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
          {[0, 1].map(i => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-zinc-400 text-sm w-4">{i + 1}.</span>
              <input type="number" min="1" max="99" placeholder="Nº" value={rivales[i]?.num || ""} onChange={e => setRivales(prev => prev.map((x, j) => j === i ? { ...x, num: e.target.value } : x))} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-zinc-100 text-sm focus:outline-none focus:border-green-600 w-16 text-center"/>
              <input type="text" placeholder="Nombre y apellidos" value={rivales[i]?.nombre || ""} onChange={e => setRivales(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-green-600 flex-1"/>
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
          {match.resultado && <Badge color={getResultBadge(match.resultado).props.color}>{match.resultado}</Badge>}
        </div>
        <Card>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>📅 {match.fecha}</span>
            <span>📍 {match.lugar}</span>
            {match.resultado && <span className="text-white font-bold">🏀 {match.resultado}</span>}
            {match.capitan && (() => { const cap = (match.convocatoria || []).find(c => c.playerId === match.capitan); return cap ? <span className="text-yellow-400">⭐ {cap.playerName}</span> : null; })()}
          </div>
        </Card>
        <div className="space-y-2">
          {(match.convocatoria || []).map(c => (
            <Card key={c.playerId} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white font-semibold flex-1">{c.playerName}</span>
                {["titular", "suplente", "no_conv"].map(s => (
                  <button key={s} onClick={() => updateConv(match.id, c.playerId, "status", s)}
                    className={`text-xs px-2 py-1 rounded border transition-all ${c.status === s
                      ? s === "titular" ? "bg-green-800 border-green-600 text-green-200"
                      : s === "suplente" ? "bg-blue-800 border-blue-600 text-blue-200"
                      : "bg-zinc-700 border-zinc-500 text-zinc-300"
                      : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}
                  >{statusLabel[s]}</button>
                ))}
                <button onClick={() => {
                  const matches2 = (data.matches || []).map(m2 => m2.id !== match.id ? m2 : { ...m2, capitan: m2.capitan === c.playerId ? null : c.playerId });
                  const upd = matches2.find(m2 => m2.id === match.id);
                  setActiveMatch(upd);
                  onSave({ ...data, matches: matches2 });
                }}
                  className={`text-xs px-2 py-1 rounded border transition-all ${match.capitan === c.playerId ? "bg-yellow-700 border-yellow-500 text-yellow-200" : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}
                >⭐ Capitán</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Input label="Min" type="number" value={c.minutos} onChange={e => updateConv(match.id, c.playerId, "minutos", Number(e.target.value))} />
                <Input label="Pts" type="number" value={c.puntos} onChange={e => updateConv(match.id, c.playerId, "puntos", Number(e.target.value))} />
                <Input label="Ast" type="number" value={c.asistencias} onChange={e => updateConv(match.id, c.playerId, "asistencias", Number(e.target.value))} />
                <Input label="Reb" type="number" value={c.rebotes} onChange={e => updateConv(match.id, c.playerId, "rebotes", Number(e.target.value))} />
                <Input label="Reb.Of" type="number" value={c.rebotesOf || 0} onChange={e => updateConv(match.id, c.playerId, "rebotesOf", Number(e.target.value))} />
                <Input label="Tap" type="number" value={c.tapones || 0} onChange={e => updateConv(match.id, c.playerId, "tapones", Number(e.target.value))} />
                <Input label="Rob" type="number" value={c.robos || 0} onChange={e => updateConv(match.id, c.playerId, "robos", Number(e.target.value))} />
                <Input label="Perd" type="number" value={c.perdidas || 0} onChange={e => updateConv(match.id, c.playerId, "perdidas", Number(e.target.value))} />
                <Input label="Falt" type="number" value={c.faltas || 0} onChange={e => updateConv(match.id, c.playerId, "faltas", Number(e.target.value))} />
                <Input label="Nota (0-10)" type="number" step="0.5" min="0" max="10" value={c.nota} onChange={e => updateConv(match.id, c.playerId, "nota", e.target.value)} />
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

      {/* Season summary */}
      {(data.matches || []).length > 0 && (() => {
        const stats = (data.matches || []).reduce((acc, m) => {
          const p = parseResult(m.resultado);
          if (!p) return acc;
          const [pf, pc] = p;
          acc.pj++; acc.pf += pf; acc.pc += pc;
          if (pf > pc) { acc.v++; acc.pts += 2; }
          else if (pf === pc) { acc.e++; acc.pts += 1; }
          else acc.d++;
          return acc;
        }, { pj: 0, v: 0, e: 0, d: 0, pf: 0, pc: 0, pts: 0 });
        return (
          <Card className="border-zinc-700">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Resumen de temporada</p>
            <div className="grid grid-cols-4 gap-2 text-center mb-3">
              <div><div className="text-2xl font-black text-white">{stats.pts}</div><div className="text-xs text-zinc-500">Puntos</div></div>
              <div><div className="text-2xl font-black text-green-400">{stats.v}</div><div className="text-xs text-zinc-500">V</div></div>
              <div><div className="text-2xl font-black text-yellow-400">{stats.e}</div><div className="text-xs text-zinc-500">E</div></div>
              <div><div className="text-2xl font-black text-red-400">{stats.d}</div><div className="text-xs text-zinc-500">D</div></div>
            </div>
            <div className="flex justify-between text-xs text-zinc-400 border-t border-zinc-800 pt-2">
              <span>PJ: {stats.pj}</span>
              <span>PF: {stats.pf}</span>
              <span>PC: {stats.pc}</span>
              <span>DIF: {stats.pf - stats.pc > 0 ? "+" : ""}{stats.pf - stats.pc}</span>
            </div>
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-white font-bold">vs {m.rival}</span>
                  {m.resultado && <><span className="text-white font-black text-lg">{m.resultado}</span>{getResultBadge(m.resultado)}</>}
                  {!m.resultado && <Badge color="zinc">Sin resultado</Badge>}
                </div>
                <div className="flex gap-3 text-xs text-zinc-400">
                  <span>📅 {m.fecha}</span>
                  {m.lugar && <span>📍 {m.lugar}</span>}
                </div>
              </div>
              <div className="flex gap-1 ml-3" onClick={e => e.stopPropagation()}>
                <Btn small variant="primary" onClick={() => openDetail(m)}>⭐ Valorar</Btn>
                <Btn small variant="secondary" onClick={() => setAttMatch(m)}>📋 Asistencia</Btn>
                {(data.coaches || []).length > 0 && isCoord && <Btn small variant="secondary" onClick={() => setCoachAttMatch(m)}>🧑‍🏫 Entrenadores</Btn>}
                <Btn small variant="secondary" onClick={() => openForm(m)}>✏️ Editar</Btn>
                <Btn small variant="danger" onClick={() => delMatch(m.id)}>🗑️ Borrar</Btn>
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
              <div><h3 className="text-white font-bold text-lg">Asistencia</h3><p className="text-zinc-400 text-sm">{attMatch.fecha} — vs {attMatch.rival}</p></div>
              <Btn small variant="secondary" onClick={() => setAttMatch(null)}>✕</Btn>
            </div>
            <div className="p-5 space-y-2">
              {(data.players || []).map(p => {
                const sessionId = `m_${attMatch.id}`;
                const rec = (data.attendance || []).find(a => a.sessionId === sessionId && a.playerId === p.id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-white text-sm font-semibold flex-1">{p.name}</span>
                    <div className="flex gap-1">
                      {attStatusOpts.map(opt => (
                        <button key={opt.val} onClick={() => setAttRecord(`m_${attMatch.id}`, p.id, p.name, opt.val, attMatch.fecha)}
                          className={`text-xs px-2 py-1 rounded border transition-all ${attStatusBtnClass(rec?.status, opt.val, opt.color)}`}
                        >{opt.label}</button>
                      ))}
                      {rec && <Btn small variant="danger" onClick={() => delAttRecord(`m_${attMatch.id}`, p.id)}>✕</Btn>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {coachAttMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setCoachAttMatch(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div><h3 className="text-white font-bold text-lg">🧑‍🏫 Entrenadores</h3><p className="text-zinc-400 text-sm">{coachAttMatch.fecha} — vs {coachAttMatch.rival}</p></div>
              <Btn small variant="secondary" onClick={() => setCoachAttMatch(null)}>✕</Btn>
            </div>
            <div className="p-5 space-y-2">
              {(data.coaches || []).length === 0 && <p className="text-zinc-500 text-sm">No hay entrenadores registrados.</p>}
              {(data.coaches || []).map(c => {
                const sessionId = `m_${coachAttMatch.id}`;
                const rec = (data.coachAttendance || []).find(a => a.sessionId === sessionId && a.coachId === c.id);
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 bg-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-white text-sm font-semibold flex-1">{c.name}</span>
                    <div className="flex gap-1">
                      {coachAttStatusOpts.map(opt => (
                        <button key={opt.val} onClick={() => setCoachAttRecord(sessionId, c.id, opt.val, coachAttMatch.fecha)}
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
        <Card>
          <div className="flex gap-6 mb-3">
            <div className="text-center"><div className="text-2xl font-black text-green-400">{stats.present}</div><div className="text-xs text-zinc-500">Asistió</div></div>
            <div className="text-center"><div className="text-2xl font-black text-yellow-400">{stats.late}</div><div className="text-xs text-zinc-500">Tarde</div></div>
            <div className="text-center"><div className="text-2xl font-black text-red-400">{stats.absent}</div><div className="text-xs text-zinc-500">No asistió</div></div>
          </div>
          <AttendanceChart {...stats} />
        </Card>
        <Input label="Buscar sesión por fecha" value={searchDate} onChange={e => setSearchDate(e.target.value)} placeholder="2024-10" />
        <div className="space-y-2">
          {filteredSessions.map(s => {
            const rec = (data.attendance || []).find(a => a.sessionId === s.id && a.playerId === p.id);
            return (
              <Card key={s.id} className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">{s.fecha}</span>
                    <Badge color={s.tipo === "Partido" ? "orange" : "blue"}>{s.tipo === "Partido" ? "🏀 Partido" : "🏃 Entrenamiento"}</Badge>
                    <span className="text-zinc-400 text-xs truncate">{s.desc}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {statusOpts.map(opt => (
                    <button key={opt.val} onClick={() => setRecord(s.id, p.id, p.name, opt.val)}
                      className={`text-xs px-2 py-1 rounded border transition-all ${statusBtnClass(rec?.status, opt.val, opt.color)}`}
                    >{opt.label}</button>
                  ))}
                  {rec && <Btn small variant="danger" onClick={() => delRecord(s.id, p.id)}>✕</Btn>}
                </div>
              </Card>
            );
          })}
          {filteredSessions.length === 0 && <p className="text-zinc-500 text-sm">No hay sesiones registradas.</p>}
        </div>
      </div>
    );
  }

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
            <Card key={p.id} className="hover:border-zinc-600 transition-colors cursor-pointer" onClick={() => setActivePlayer(p)}>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <span className="text-white font-semibold">{p.name}</span>
                  {total > 0 && <div className="mt-2"><AttendanceChart {...stats} /></div>}
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
// SECTION: Clasificaciones (estadísticas de baloncesto)
// ══════════════════════════════════════════════════════════════════════════════
function ClasificacionSection({ team, data }) {
  const [tab, setTab] = useState("puntos");

  const players = data.players || [];
  const matches = data.matches || [];
  const attendance = data.attendance || [];

  const TABS = [
    { id: "puntos", label: "🏀 Anotadores" },
    { id: "asistencias", label: "🎯 Asistencias" },
    { id: "rebotes", label: "💪 Rebotes" },
    { id: "tapones", label: "🚫 Tapones" },
    { id: "robos", label: "✋ Robos" },
    { id: "minutos", label: "⏱ Minutos" },
    { id: "partidos", label: "📋 Partidos" },
    { id: "eficiencia", label: "⭐ Eficiencia" },
  ];

  const getPlayerMatchStats = (playerId) => {
    let puntos = 0, asistencias = 0, rebotes = 0, rebotesOf = 0, tapones = 0, robos = 0, perdidas = 0, faltas = 0, minutos = 0, titular = 0, suplente = 0, noConv = 0;
    matches.forEach(m => {
      const c = (m.convocatoria || []).find(c => c.playerId === playerId);
      if (!c) return;
      puntos += c.puntos || 0;
      asistencias += c.asistencias || 0;
      rebotes += c.rebotes || 0;
      rebotesOf += c.rebotesOf || 0;
      tapones += c.tapones || 0;
      robos += c.robos || 0;
      perdidas += c.perdidas || 0;
      faltas += c.faltas || 0;
      minutos += c.minutos || 0;
      if (c.status === "titular") titular++;
      else if (c.status === "suplente") suplente++;
      else noConv++;
    });
    const partidos = titular + suplente;
    // Fórmula de eficiencia sencilla: pts + reb + ast + tap + rob - perd - falt
    const eficiencia = puntos + rebotes + asistencias + tapones + robos - perdidas - faltas;
    return { puntos, asistencias, rebotes, rebotesOf, tapones, robos, perdidas, faltas, minutos, titular, suplente, noConv, partidos, eficiencia };
  };

  const ranked = players.map(p => ({ ...p, ...getPlayerMatchStats(p.id) }));
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
    if (tab === "puntos") {
      const sorted = [...ranked].sort((a, b) => b.puntos - a.puntos).filter(p => p.puntos > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin puntos registrados todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.puntos} pts`} sub={p.partidos > 0 ? `${(p.puntos/p.partidos).toFixed(1)} pts/partido` : ""} />);
    }
    if (tab === "asistencias") {
      const sorted = [...ranked].sort((a, b) => b.asistencias - a.asistencias).filter(p => p.asistencias > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin asistencias registradas todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.asistencias} ast`} sub={p.partidos > 0 ? `${(p.asistencias/p.partidos).toFixed(1)} ast/partido` : ""} />);
    }
    if (tab === "rebotes") {
      const sorted = [...ranked].sort((a, b) => b.rebotes - a.rebotes).filter(p => p.rebotes > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin rebotes registrados todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.rebotes} reb`} sub={p.rebotesOf > 0 ? `${p.rebotesOf} of.` : ""} />);
    }
    if (tab === "tapones") {
      const sorted = [...ranked].sort((a, b) => b.tapones - a.tapones).filter(p => p.tapones > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin tapones registrados todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.tapones} tap`} />);
    }
    if (tab === "robos") {
      const sorted = [...ranked].sort((a, b) => b.robos - a.robos).filter(p => p.robos > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin robos registrados todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.robos} rob`} />);
    }
    if (tab === "minutos") {
      const sorted = [...ranked].sort((a, b) => b.minutos - a.minutos).filter(p => p.minutos > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin minutos registrados todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.minutos} min`} sub={p.partidos > 0 ? `${Math.round(p.minutos/p.partidos)} min/partido` : ""} />);
    }
    if (tab === "partidos") {
      const sorted = [...ranked].sort((a, b) => b.partidos - a.partidos).filter(p => p.partidos > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin partidos registrados todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.partidos} partidos`} sub={`${p.titular} tit. · ${p.suplente} sup.`} />);
    }
    if (tab === "eficiencia") {
      const sorted = [...ranked].sort((a, b) => b.eficiencia - a.eficiencia).filter(p => p.partidos > 0);
      if (!sorted.length) return <p className="text-zinc-500 text-sm">Sin datos todavía.</p>;
      return sorted.map((p, i) => <Row key={p.id} i={i} name={p.name} main={`${p.eficiencia} ef.`} sub={`${p.puntos}p · ${p.rebotes}r · ${p.asistencias}a · ${p.tapones}t`} />);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Clasificaciones — {team}</h2>
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-sm border transition-all ${tab === t.id ? "bg-green-700 border-green-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
          >{t.label}</button>
        ))}
      </div>
      <div className="space-y-2">{renderTab()}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Mejores Rivales
// ══════════════════════════════════════════════════════════════════════════════
function MejoresRivalesSection({ db }) {
  const [filterTeam, setFilterTeam] = useState("all");
  const allRivales = [];
  Object.keys(db).forEach(team => {
    const matches = db[team]?.matches || [];
    matches.forEach(m => {
      (m.mejoresRivales || []).filter(r => r.nombre).forEach(r => {
        allRivales.push({ ...r, equipo: team, rival: m.rival, fecha: m.fecha, resultado: m.resultado });
      });
    });
  });

  const CATEGORIAS = [
    { id: "Baby",     color: "bg-pink-900 border-pink-700 text-pink-200" },
    { id: "Prebenjamín", color: "bg-orange-900 border-orange-700 text-orange-200" },
    { id: "Benjamín", color: "bg-yellow-900 border-yellow-700 text-yellow-200" },
    { id: "Alevín",   color: "bg-green-900 border-green-700 text-green-200" },
    { id: "Infantil", color: "bg-blue-900 border-blue-700 text-blue-200" },
    { id: "Cadete",   color: "bg-purple-900 border-purple-700 text-purple-200" },
    { id: "Junior",   color: "bg-red-900 border-red-700 text-red-200" },
    { id: "Senior",   color: "bg-zinc-700 border-zinc-500 text-zinc-200" },
  ];

  const teamToCategoria = (team) => {
    const t = team.toLowerCase();
    if (t.includes("baby")) return "Baby";
    if (t.includes("prebenjamín") || t.includes("prebenjamin")) return "Prebenjamín";
    if (t.includes("benjamín") || t.includes("benjamin")) return "Benjamín";
    if (t.includes("alevín") || t.includes("alevin")) return "Alevín";
    if (t.includes("infantil")) return "Infantil";
    if (t.includes("cadete")) return "Cadete";
    if (t.includes("junior")) return "Junior";
    if (t.includes("senior")) return "Senior";
    return "Otros";
  };

  const categoriesWithData = [...new Set(allRivales.map(r => teamToCategoria(r.equipo)))];
  const filtered = filterTeam === "all" ? allRivales : allRivales.filter(r => teamToCategoria(r.equipo) === filterTeam);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">⭐ Mejores Jugadores Rivales</h2>
      <p className="text-zinc-400 text-sm">Jugadores rivales destacados registrados por los entrenadores.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterTeam("all")} className={`px-2 py-1 rounded text-xs border transition-all ${filterTeam === "all" ? "bg-zinc-600 border-zinc-400 text-white" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>Todos</button>
        {CATEGORIAS.filter(c => categoriesWithData.includes(c.id)).map(c => (
          <button key={c.id} onClick={() => setFilterTeam(c.id)} className={`px-2 py-1 rounded text-xs border transition-all ${filterTeam === c.id ? c.color + " font-semibold" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>{c.id}</button>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-zinc-500 text-sm">No hay jugadores rivales registrados todavía.</p>}
      <div className="space-y-2">
        {filtered.map((r, i) => {
          const cat = CATEGORIAS.find(c => teamToCategoria(r.equipo) === c.id) || { color: "bg-zinc-800 border-zinc-700 text-white" };
          return (
            <div key={i} className={`border rounded-xl p-4 flex items-center gap-3 flex-wrap ${cat.color}`}>
              <div className="flex items-center gap-2">
                {r.num && <span className="font-mono text-sm bg-black/20 px-2 py-0.5 rounded">#{r.num}</span>}
                <span className="font-semibold">{r.nombre}</span>
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap text-xs opacity-80">
                <span>{r.equipo}</span><span>vs {r.rival}</span><span>📅 {r.fecha}</span>
                {r.resultado && <span className="bg-black/20 px-1.5 py-0.5 rounded">{r.resultado}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Gestión
// ══════════════════════════════════════════════════════════════════════════════
function GestionSection({ db, onArchive, onRestore, passwords, onSavePasswords }) {
  const [seasons, setSeasons] = useState([]);
  const [viewingSeason, setViewingSeason] = useState(null);
  const [viewingTeam, setViewingTeam] = useState(TEAMS[0]);
  const [editPwds, setEditPwds] = useState(false);
  const [pwdInputs, setPwdInputs] = useState({});
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    loadSeasons().then(s => setSeasons(s || []));
  }, []);

  const doArchive = async () => {
    if (!window.confirm("¿Archivar temporada actual? Los datos de partidos y entrenamientos se guardarán y se empezará nueva temporada.")) return;
    setArchiving(true);
    await onArchive();
    const s = await loadSeasons();
    setSeasons(s || []);
    setArchiving(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">⚙️ Gestión</h2>

      <Card>
        <h3 className="text-white font-semibold mb-2">📦 Archivar temporada</h3>
        <p className="text-zinc-400 text-sm mb-4">Guarda los datos actuales y empieza una nueva temporada. Los jugadores y entrenadores se conservan.</p>
        <Btn onClick={doArchive} variant="secondary">{archiving ? "Archivando..." : "Archivar temporada actual"}</Btn>
      </Card>

      {seasons.length > 0 && (
        <Card>
          <h3 className="text-white font-semibold mb-3">📁 Temporadas archivadas</h3>
          <div className="space-y-2">
            {seasons.map((s, i) => (
              <div key={i} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-4 py-3">
                <span className="text-zinc-300 flex-1">{s.archivedAt ? new Date(s.archivedAt).toLocaleDateString("es-ES") : `Temporada ${i + 1}`}</span>
                <Btn small variant="secondary" onClick={() => setViewingSeason(s)}>👁 Ver</Btn>
                <Btn small variant="ghost" onClick={() => { if (window.confirm("¿Restaurar esta temporada? Los datos actuales se perderán.")) onRestore(s.data); }}>↩ Restaurar</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-white font-semibold mb-2">🔑 Contraseñas de equipos</h3>
        {!editPwds ? (
          <Btn variant="secondary" onClick={() => { setPwdInputs({ ...passwords }); setEditPwds(true); }}>Gestionar contraseñas</Btn>
        ) : (
          <div className="space-y-2">
            {TEAMS.map(t => (
              <div key={t} className="flex items-center gap-3">
                <span className="text-zinc-300 text-sm w-40">{t}</span>
                <input value={pwdInputs[t] || ""} onChange={e => setPwdInputs(p => ({ ...p, [t]: e.target.value }))}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-sm focus:outline-none focus:border-green-600 w-28"
                />
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <Btn onClick={() => { onSavePasswords(pwdInputs); setEditPwds(false); }}>Guardar</Btn>
              <Btn variant="secondary" onClick={() => setEditPwds(false)}>Cancelar</Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Entrenadores
// ══════════════════════════════════════════════════════════════════════════════
function EntrenadoresSection({ db, onSaveTeam, coordProfile }) {
  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const teamData = db[selectedTeam] || { coaches: [] };
  const coaches = teamData.coaches || [];

  const open = (c = null) => {
    setEditing(c);
    setName(c ? c.name : "");
    setRole(c ? c.role : "");
    setShowForm(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const updated = editing
      ? coaches.map(c => c.id === editing.id ? { ...c, name, role } : c)
      : [...coaches, { id: Date.now(), name, role }];
    onSaveTeam(selectedTeam, { ...teamData, coaches: updated });
    setShowForm(false);
  };

  const del = (id) => {
    if (!window.confirm("¿Eliminar entrenador?")) return;
    onSaveTeam(selectedTeam, { ...teamData, coaches: coaches.filter(c => c.id !== id) });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">🧑‍🏫 Entrenadores</h2>
      <div className="flex flex-wrap gap-2">
        {TEAMS.map(t => (
          <button key={t} onClick={() => { setSelectedTeam(t); setShowForm(false); }}
            className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedTeam === t ? "bg-green-700 border-green-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
          >{t}</button>
        ))}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-zinc-400 text-sm">Equipo: <span className="text-white font-semibold">{selectedTeam}</span></p>
        <Btn onClick={() => open()}>+ Añadir entrenador</Btn>
      </div>
      {showForm && (
        <Card className="border-green-900/50">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input label="Nombre" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Rol (ej: Primer entrenador)" value={role} onChange={e => setRole(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Btn onClick={save}>Guardar</Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Btn>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        {coaches.length === 0 && <p className="text-zinc-500 text-sm">No hay entrenadores registrados.</p>}
        {coaches.map(c => (
          <Card key={c.id} className="flex justify-between items-center">
            <div>
              <span className="text-white font-semibold">{c.name}</span>
              {c.role && <span className="text-zinc-400 text-sm ml-2">· {c.role}</span>}
            </div>
            <div className="flex gap-1">
              <Btn small variant="secondary" onClick={() => open(c)}>✏️</Btn>
              <Btn small variant="danger" onClick={() => del(c.id)}>🗑️</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Resumen
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
    const [pf, pc] = parts;
    if (pf > pc) return <Badge color="green">Victoria</Badge>;
    if (pf < pc) return <Badge color="red">Derrota</Badge>;
    return <Badge color="yellow">Empate</Badge>;
  };

  const stats = matches.reduce((acc, m) => {
    const parts = parseResult(m.resultado);
    if (!parts) return acc;
    const [pf, pc] = parts;
    acc.pf += pf; acc.pc += pc;
    if (pf > pc) acc.v++;
    else if (pf < pc) acc.d++;
    else acc.e++;
    return acc;
  }, { v: 0, e: 0, d: 0, pf: 0, pc: 0 });

  const total = stats.v + stats.e + stats.d;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Resumen de partidos</h2>
      <div className="flex flex-wrap gap-2">
        {TEAMS.map(t => (
          <button key={t} onClick={() => setSelectedTeam(t)}
            className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedTeam === t ? "bg-green-700 border-green-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
          >{t}</button>
        ))}
      </div>
      {total > 0 && (
        <Card>
          <div className="flex flex-wrap gap-6 justify-around text-center">
            <div><div className="text-3xl font-black text-white">{total}</div><div className="text-xs text-zinc-500 mt-1">Partidos</div></div>
            <div><div className="text-3xl font-black text-green-400">{stats.v}</div><div className="text-xs text-zinc-500 mt-1">Victorias</div></div>
            <div><div className="text-3xl font-black text-yellow-400">{stats.e}</div><div className="text-xs text-zinc-500 mt-1">Empates</div></div>
            <div><div className="text-3xl font-black text-red-400">{stats.d}</div><div className="text-xs text-zinc-500 mt-1">Derrotas</div></div>
            <div><div className="text-3xl font-black text-green-400">{stats.pf} — {stats.pc}</div><div className="text-xs text-zinc-500 mt-1">PF — PC</div></div>
          </div>
          <div className="mt-4 flex h-3 rounded-full overflow-hidden gap-0.5">
            {stats.v > 0 && <div className="bg-green-500 transition-all" style={{ width: `${(stats.v / total) * 100}%` }} />}
            {stats.e > 0 && <div className="bg-yellow-500 transition-all" style={{ width: `${(stats.e / total) * 100}%` }} />}
            {stats.d > 0 && <div className="bg-red-600 transition-all" style={{ width: `${(stats.d / total) * 100}%` }} />}
          </div>
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span className="text-green-400">{Math.round((stats.v / total) * 100)}% victorias</span>
            <span className="text-red-400">{Math.round((stats.d / total) * 100)}% derrotas</span>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        {matches.length === 0 && <p className="text-zinc-500 text-sm">No hay partidos registrados para {selectedTeam}.</p>}
        {matches.map(m => (
          <Card key={m.id} className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-white font-semibold">vs {m.rival}</span>
                {m.resultado ? <><span className="text-white font-black text-lg">{m.resultado}</span>{getResultBadge(m.resultado)}</> : <Badge color="zinc">Sin resultado</Badge>}
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
// APP PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function AmicsApp() {
  const [authState, setAuthState] = useState("login");
  const [role, setRole] = useState(null);
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

  const isCoord = role === "coordinator";

  const sections = [
    ...(isCoord ? [{ id: "resumen", label: "Resumen", icon: "📊" }] : []),
    ...(isCoord ? [{ id: "entrenadores", label: "Entrenadores", icon: "🧑‍🏫" }] : []),
    ...(isCoord ? [{ id: "gestion", label: "Ajustes", icon: "⚙️" }] : []),
    ...(isCoord ? [{ id: "mejoresrivales", label: "Rivales", icon: "⭐" }] : []),
    { id: "plantilla", label: "Plantilla", icon: "👥" },
    { id: "entrenamientos", label: "Entrenamientos", icon: "🏃" },
    { id: "tareas", label: "Ejercicios", icon: "🗂" },
    { id: "partidos", label: "Partidos", icon: "🏀" },
    { id: "clasificacion", label: "Estadísticas", icon: "📈" },
    { id: "asistencia", label: "Asistencia", icon: "📋" },
  ];

  useEffect(() => {
    Promise.all([loadData(), loadSeasons()]).then(([d, s]) => {
      try { const raw = localStorage.getItem("amics_passwords"); if (raw) setTeamPasswords(JSON.parse(raw)); } catch (e) {}
      const dbData = d || initState();
      setDb(dbData);
      if (dbData.__globalTasks) setGlobalTasks(dbData.__globalTasks);
      setSeasons(s || []);
      setLoading(false);
    });
  }, []);

  const TEAM_PASSWORDS = {
    "Baby":           "BAB",
    "Prebenjamín":    "PRE",
    "Benjamín A":     "BJA",
    "Benjamín B":     "BJB",
    "Alevín A":       "ALA",
    "Alevín B":       "ALB",
    "Alevín C":       "ALC",
    "Alevín Verde":   "ALV",
    "Alevín Blanco":  "ALW",
    "Infantil A":     "INA",
    "Infantil B":     "INB",
    "Infantil C":     "INC",
    "Infantil Verde": "INV",
    "Infantil Blanco":"INW",
    "Infantil Azul":  "INZ",
    "Cadete A":       "CDA",
    "Cadete B":       "CDB",
    "Cadete C":       "CDC",
    "Cadete Verde":   "CDV",
    "Cadete Blanco":  "CDW",
    "Cadete Rojo":    "CDR",
    "Cadete Azul":    "CDZ",
    "Junior A":       "JNA",
    "Junior B":       "JNB",
    "Junior C":       "JNC",
    "Senior":         "SNR",
  };

  const login = () => {
    if (teamInput === "Coordinador" && password === "AMICS") {
      setRole("coordinator");
      setTeamAccess(null);
      setActiveTeam(TEAMS[0]);
      setActiveSection("resumen");
      setShowProfilePicker(true);
    } else if (teamInput !== "Coordinador" && ({ ...TEAM_PASSWORDS, ...teamPasswords })[teamInput] === password) {
      setRole("trainer");
      setTeamAccess(teamInput);
      setActiveTeam(teamInput);
      setAuthState("app");
    } else {
      setLoginError("Contraseña incorrecta.");
    }
  };

  const updateTeamData = async (team, newData) => {
    let freshDb;
    try { freshDb = await loadData(); if (freshDb) setDb(freshDb); } catch (e) { freshDb = db; }
    const cleanTeam = (d) => ({
      ...d,
      trainings: (d.trainings || []).map(t => ({
        ...t,
        tasks: (t.tasks || []).map(task => ({
          ...task,
          pizarra: (task.pizarra || []).filter(el => el != null && el.type).map(el =>
            el.type === "drawing"
              ? { id: el.id, type: el.type, path: el.path, color: el.color, size: el.size }
              : { id: el.id, type: el.type, x: el.x, y: el.y, x2: el.x2, y2: el.y2, color: el.color || "red", num: el.num ?? el.number, material: el.material }
          )
        }))
      })),
      tasks: (d.tasks || []).map(task => ({
        ...task,
        pizarra: (task.pizarra || []).filter(el => el != null && el.type).map(el =>
          el.type === "drawing"
            ? { id: el.id, type: el.type, path: el.path, color: el.color, size: el.size }
            : { id: el.id, type: el.type, x: el.x, y: el.y, x2: el.x2, y2: el.y2, color: el.color || "red", num: el.num ?? el.number, material: el.material }
        )
      }))
    });
    const newDb = { ...(freshDb || db), [team]: cleanTeam(newData) };
    setDb(newDb);
    await saveData(newDb);
  };

  const saveGlobalTasks = async (tasks) => {
    setGlobalTasks(tasks);
    const newDb = { ...db, __globalTasks: tasks };
    setDb(newDb);
    await saveData(newDb);
  };

  const savePasswords = async (newPwds) => {
    setTeamPasswords(newPwds);
    localStorage.setItem("amics_passwords", JSON.stringify(newPwds));
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-700 mb-4"><span className="text-2xl">🏀</span></div>
          <h1 className="text-xl font-black text-white">¿Quién eres?</h1>
          <p className="text-zinc-500 text-sm mt-1">Selecciona tu perfil de coordinador</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {COORDINATORS.map(name => (
            <button key={name} onClick={() => { setCoordProfile(name); setShowProfilePicker(false); setAuthState("app"); }}
              className="bg-zinc-800 hover:bg-green-900/60 border border-zinc-700 hover:border-green-700 rounded-xl p-4 text-white font-semibold text-sm transition-all">
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
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-700 mb-4 shadow-lg shadow-green-900/50">
            <span className="text-3xl">🏀</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Amics Castelló</h1>
          <p className="text-zinc-500 text-sm mt-1">Gestió esportiva de cantera</p>
        </div>
        <Card className="border-zinc-700">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Rol / Equipo</label>
              <select value={teamInput} onChange={e => setTeamInput(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-green-600 w-full">
                {["Coordinador", ...TEAMS].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Contraseña" type="password" value={password}
              onChange={e => { setPassword(e.target.value); setLoginError(""); }}
              onKeyDown={e => e.key === "Enter" && login()} placeholder="Introduce tu clave"
            />
            {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
            <Btn onClick={login} className="w-full justify-center">Entrar</Btn>
          </div>
        </Card>
      </div>
    </div>
  );

  const teamData = db[activeTeam] || { players: [], trainings: [], matches: [], attendance: [] };

  return (
    <div className="min-h-screen bg-zinc-950 flex text-zinc-100" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-64" : "w-0 overflow-hidden"} transition-all duration-300 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0`}>
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center text-sm">🏀</div>
            <span className="font-black text-white text-sm">Amics Castelló</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={isCoord ? "orange" : "blue"}>{isCoord ? `Coord. ${coordProfile}` : "Entrenador"}</Badge>
          </div>
        </div>

        {isCoord && (
          <div className="p-3 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Equipo</p>
            {TEAMS.map(t => (
              <button key={t} onClick={() => setActiveTeam(t)}
                className={`w-full text-left px-3 py-1.5 rounded text-xs transition-all ${activeTeam === t ? "bg-green-900/40 text-green-300 font-semibold" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
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

        <nav className="p-3 flex-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Secciones</p>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-all flex items-center gap-2 ${activeSection === s.id ? "bg-green-900/40 text-green-300 font-semibold" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
            ><span>{s.icon}</span>{s.label}</button>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-800">
          <Btn variant="ghost" small className="w-full justify-center" onClick={() => { setAuthState("login"); setPassword(""); }}>
            Cerrar sesión
          </Btn>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-zinc-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-all">☰</button>
          <span className="text-white font-semibold">
            {sections.find(s => s.id === activeSection)?.icon} {sections.find(s => s.id === activeSection)?.label}
            <span className="text-zinc-500 font-normal ml-2">— {activeTeam}</span>
          </span>
        </div>

        <div className="flex-1 overflow-auto p-5 md:p-8">
          <div className="max-w-4xl mx-auto">
            {activeSection === "resumen" && isCoord && <ResumenSection db={db} />}
            {activeSection === "entrenadores" && isCoord && <EntrenadoresSection db={db} onSaveTeam={(team, data) => updateTeamData(team, data)} coordProfile={coordProfile} />}
            {activeSection === "mejoresrivales" && isCoord && <MejoresRivalesSection db={db} />}
            {activeSection === "gestion" && isCoord && <GestionSection db={db} onArchive={archiveSeason} onRestore={restoreSeason} passwords={{ ...TEAM_PASSWORDS, ...teamPasswords }} onSavePasswords={savePasswords} />}
            {activeSection === "plantilla" && <PlantillaSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} seasons={seasons} />}
            {activeSection === "entrenamientos" && <EntrenamientosSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} globalTasks={globalTasks} />}
            {activeSection === "tareas" && <TareasSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} globalTasks={globalTasks} onSaveGlobal={saveGlobalTasks} isCoord={isCoord} />}
            {activeSection === "partidos" && <PartidosSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} />}
            {activeSection === "clasificacion" && <ClasificacionSection team={activeTeam} data={teamData} />}
            {activeSection === "asistencia" && <AsistenciaSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} />}
          </div>
        </div>
      </div>
    </div>
  );
}
