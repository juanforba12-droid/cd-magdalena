import { loadData, saveData, loadSeasons, saveSeasons } from "./firebase";
import { useState, useEffect, useRef } from "react";
import * as React from "react";

// ── Initial state ────────────────────────────────────────────────────────────
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
const Btn = ({ children, onClick, variant = "primary", small, className = "" }) => {
  const base = "font-bold rounded transition-all duration-150 cursor-pointer border-0 ";
  const sizes = small ? "px-3 py-1 text-xs" : "px-5 py-2 text-sm";
  const variants = {
    primary: "bg-red-600 hover:bg-red-500 text-white",
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

const Card = ({ children, className = "" }) => (
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

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Plantilla
// ══════════════════════════════════════════════════════════════════════════════
function PlantillaSection({ team, data, onSave, isCoord, seasons }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [dorsal, setDorsal] = useState("");
  const [positions, setPositions] = useState([]);
  const [statsPlayer, setStatsPlayer] = useState(null);
  const [notesPlayer, setNotesPlayer] = useState(null);
  const [reportTitle, setReportTitle] = useState("");
  const [reportText, setReportText] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [editingReport, setEditingReport] = useState(null);

  const getPlayerMatchHistory = (playerId) => {
    return (data.matches || [])
      .filter(m => m.convocatoria?.find(c => c.playerId === playerId && c.nota !== "" && c.nota !== undefined && c.nota !== null))
      .map(m => {
        const c = m.convocatoria.find(c => c.playerId === playerId);
        return { rival: m.rival, fecha: m.fecha, nota: parseFloat(c.nota), minutos: c.minutos, goles: c.goles, asistencias: c.asistencias, status: c.status };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  };

  const statusLabel = { titular: "Titular", suplente: "Suplente", no_conv: "No conv." };
  const statusColor = { titular: "green", suplente: "blue", no_conv: "zinc" };

  const [search, setSearch] = useState("");

  const openNotes = (p) => {
    setNotesPlayer(p);
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
    setNotesPlayer(players.find(p => p.id === notesPlayer.id));
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
    { val: "duda", label: "Duda", color: "bg-orange-900/40 border-orange-700 text-orange-300" },
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
    setShowForm(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const players = [...(data.players || [])];
    if (editing) {
      const idx = players.findIndex(p => p.id === editing.id);
      players[idx] = { ...editing, name, dorsal, positions };
    } else {
      players.push({ id: Date.now(), name, dorsal, positions });
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Plantilla — {team}</h2>
        <Btn onClick={() => open()}>+ Añadir jugador</Btn>
      </div>

      {showForm && (
        <Card className="border-red-900/50">
          <h3 className="text-sm font-bold text-zinc-300 mb-4">{editing ? "Editar jugador" : "Nuevo jugador"}</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Input label="Nombre" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Dorsal" type="number" value={dorsal} onChange={e => setDorsal(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Posiciones</label>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  onClick={() => togglePos(pos)}
                  className={`text-xs px-2 py-1 rounded border transition-all ${
                    positions.includes(pos)
                      ? "bg-red-700 border-red-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(data.players || []).filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
          <Card key={p.id} className={`flex justify-between items-start border ${statusStyle(p.status || "disponible")}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {p.dorsal && <span className="text-red-500 font-bold text-lg">#{p.dorsal}</span>}
                <span className="text-white font-semibold">{p.name}</span>
                {p.status && p.status !== "disponible" && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusStyle(p.status)}`}>
                    {PLAYER_STATUSES.find(s => s.val === p.status)?.label}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(p.positions || []).map(pos => <Badge key={pos}>{pos}</Badge>)}
              </div>
              <div className="flex gap-1 flex-wrap">
                {PLAYER_STATUSES.map(s => (
                  <button key={s.val} onClick={() => setPlayerStatus(p.id, s.val)}
                    className={`text-xs px-2 py-0.5 rounded border transition-all ${
                      (p.status || "disponible") === s.val ? s.color : "bg-transparent border-zinc-700 text-zinc-600 hover:border-zinc-500"
                    }`}
                  >{s.label}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-1 ml-2 shrink-0">
              <Btn small variant="ghost" onClick={() => setStatsPlayer(p)}>📈</Btn>
              <Btn small variant="ghost" onClick={() => openNotes(p)} title="Informes del jugador">
                {(p.reports || []).length > 0 ? `📋 ${(p.reports||[]).length}` : "📋"}
              </Btn>
              <Btn small variant="secondary" onClick={() => open(p)}>✏️</Btn>
              <Btn small variant="danger" onClick={() => del(p.id)}>🗑️</Btn>
            </div>
          </Card>
        ))}
        {(data.players || []).filter(p => p.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
          <p className="text-zinc-500 text-sm col-span-2">{search ? `No hay jugadores con "${search}"` : "No hay jugadores en la plantilla."}</p>
        )}
      </div>

      {/* Reports modal */}
      {notesPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-auto" onClick={() => setNotesPlayer(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg my-4" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold text-lg">📋 Informes</h3>
                <p className="text-zinc-400 text-sm">{notesPlayer.name}</p>
              </div>
              <Btn small variant="secondary" onClick={() => setNotesPlayer(null)}>✕</Btn>
            </div>

            {/* New / edit report form */}
            <div className="p-5 border-b border-zinc-800 space-y-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">{editingReport ? "Editar informe" : "Nuevo informe"}</p>
              <div className="space-y-3">
                <Input label="Fecha" type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
                <Input label="Título (opcional)" value={reportTitle} onChange={e => setReportTitle(e.target.value)} />
              </div>
              <Textarea value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Escribe el informe aquí..." rows={4} />
              <div className="flex gap-2">
                <Btn onClick={saveReport}>{editingReport ? "Actualizar" : "Añadir informe"}</Btn>
                {editingReport && <Btn variant="secondary" onClick={() => { setEditingReport(null); setReportTitle(""); setReportText(""); setReportDate(new Date().toISOString().split("T")[0]); }}>Cancelar</Btn>}
              </div>
            </div>

            {/* Reports list */}
            <div className="p-5 space-y-3 max-h-80 overflow-auto">
              {(notesPlayer.reports || []).length === 0 && <p className="text-zinc-500 text-sm">No hay informes todavía.</p>}
              {(notesPlayer.reports || []).map(r => (
                <div key={r.id} className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-red-400 text-xs font-bold">{r.fecha}</span>
                      {r.title && <span className="text-white text-sm font-semibold ml-2">{r.title}</span>}
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Btn small variant="secondary" onClick={() => openEditReport(r)}>✏️</Btn>
                      <Btn small variant="danger" onClick={() => delReport(notesPlayer.id, r.id)}>🗑️ Borrar</Btn>
                    </div>
                  </div>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats modal */}
      {statsPlayer && (() => {
        const history = getPlayerMatchHistory(statsPlayer.id);
        const avg = history.length ? (history.reduce((s, h) => s + h.nota, 0) / history.length).toFixed(2) : null;
        const totalGoles = history.reduce((s, h) => s + (h.goles || 0), 0);
        const totalAsistencias = history.reduce((s, h) => s + (h.asistencias || 0), 0);
        const totalMinutos = history.reduce((s, h) => s + (h.minutos || 0), 0);
        const titulares = history.filter(h => h.status === "titular").length;
        const suplentes = history.filter(h => h.status === "suplente").length;
        const noConv = history.filter(h => h.status === "no_conv").length;

        // Cross-season stats
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

              {/* Cross-season evolution */}
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
                  {/* Season totals */}
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

                  {/* Match by match */}
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

// ══════════════════════════════════════════════════════════════════════════════
// PIZARRA TÁCTICA
// ══════════════════════════════════════════════════════════════════════════════
const PLAYER_COLORS = ["red","yellow","blue","green"];
const PLAYER_COLOR_STYLES = { red:"bg-red-600 border-red-400", yellow:"bg-yellow-500 border-yellow-300", blue:"bg-blue-600 border-blue-400", green:"bg-green-600 border-green-400" };

const MATERIALS = [
  { id:"cono", label:"Cono", svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-orange-400"><path d="M12 2L4 20h16L12 2z"/><ellipse cx="12" cy="20" rx="8" ry="2" fill="currentColor" opacity="0.4"/></svg> },
  { id:"chino", label:"Chino", svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-300"><path d="M12 2L5 21h14L12 2z"/><circle cx="12" cy="21" r="2.5"/></svg> },
  { id:"porteria_grande", label:"Portería G", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 text-white"><rect x="2" y="5" width="20" height="12" rx="0.5"/><line x1="2" y1="17" x2="2" y2="21"/><line x1="22" y1="17" x2="22" y2="21"/><line x1="2" y1="21" x2="22" y2="21" strokeDasharray="2 2"/></svg> },
  { id:"porteria_pequeña", label:"Portería P", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 text-zinc-300"><rect x="5" y="8" width="14" height="9" rx="0.5"/><line x1="5" y1="17" x2="5" y2="20"/><line x1="19" y1="17" x2="19" y2="20"/><line x1="5" y1="20" x2="19" y2="20" strokeDasharray="2 2"/></svg> },
  { id:"escalera", label:"Escalera", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-amber-400"><line x1="4" y1="4" x2="4" y2="20"/><line x1="20" y1="4" x2="20" y2="20"/><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="4" y1="19" x2="20" y2="19"/></svg> },
  { id:"pesa", label:"Pesa", svg: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-zinc-400"><rect x="1" y="9" width="4" height="6" rx="1"/><rect x="19" y="9" width="4" height="6" rx="1"/><rect x="6" y="7" width="4" height="10" rx="1"/><rect x="14" y="7" width="4" height="10" rx="1"/><rect x="10" y="10.5" width="4" height="3" rx="0.5"/></svg> },
  { id:"pica", label:"Pica", svg: <svg viewBox="0 0 24 24" className="w-5 h-5 text-pink-400"><rect x="11" y="4" width="2" height="17" rx="1" fill="currentColor"/><polygon points="12,2 10,6 14,6" fill="currentColor"/><ellipse cx="12" cy="21" rx="3" ry="1.5" fill="currentColor" opacity="0.6"/></svg> },
  { id:"aro", label:"Aro", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-5 h-5 text-cyan-400"><circle cx="12" cy="12" r="8"/></svg> },
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
      <line x1="2" y1="32.5" x2="98" y2="32.5" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <circle cx="50" cy="32.5" r="12" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <circle cx="50" cy="32.5" r="0.8" fill="white" opacity="0.6"/>
      <rect x="28" y="2" width="44" height="18" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="36" y="2" width="28" height="8" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="42" y="0" width="16" height="2" fill="none" stroke="white" strokeWidth="0.7" opacity="0.8"/>
      <circle cx="50" cy="14" r="0.8" fill="white" opacity="0.6"/>
      <rect x="28" y="45" width="44" height="18" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="36" y="55" width="28" height="8" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <rect x="42" y="63" width="16" height="2" fill="none" stroke="white" strokeWidth="0.7" opacity="0.8"/>
      <circle cx="50" cy="51" r="0.8" fill="white" opacity="0.6"/>
      <path d="M2 5 A3 3 0 0 1 5 2" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <path d="M95 2 A3 3 0 0 1 98 5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <path d="M98 60 A3 3 0 0 1 95 63" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      <path d="M5 63 A3 3 0 0 1 2 60" fill="none" stroke="white" strokeWidth="0.5" opacity="0.6"/>
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

function Pizarra({ value, onChange }) {
  const [tool, setTool] = useState("player_red");
  const [playerNum, setPlayerNum] = useState(1);
  const [fieldType, setFieldType] = useState("full");
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingItem, setEditingItem] = useState(null);
  const fieldRef = useRef(null);
  const items = value || [];

  const addItem = (e) => {
    if (dragging !== null) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    if (tool === "erase") return;
    const isPlayer = tool.startsWith("player_");
    const newItem = { id: Date.now(), x, y, type: tool, ...(isPlayer ? { num: playerNum } : {}) };
    if (isPlayer) setPlayerNum(n => n + 1);
    onChange([...items, newItem]);
  };

  const startDrag = (e, id) => {
    e.stopPropagation();
    const rect = fieldRef.current.getBoundingClientRect();
    const item = items.find(i => i.id === id);
    setDragOffset({
      x: e.clientX - rect.left - (item.x / 100) * rect.width,
      y: e.clientY - rect.top - (item.y / 100) * rect.height,
    });
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

  const renderItem = (item, idx) => { if (!item || typeof item !== 'object') return null;
    const isPlayer = item.type.startsWith("player_");
    const color = isPlayer ? item.type.replace("player_", "") : null;
    const mat = !isPlayer ? MATERIALS.find(m => m.id === item.type) : null;
    return (
      <div
        key={item.id}
        className="absolute transform -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ left:`${item.x}%`, top:`${item.y}%`, cursor: tool==="erase"?"crosshair":"grab", zIndex: dragging===item.id?10:1 }}
        onMouseDown={e => { if(tool==="erase"){e.stopPropagation();removeItem(item.id);}else startDrag(e,item.id); }}
        onDoubleClick={e => { e.stopPropagation(); if(isPlayer) setEditingItem({id:item.id,num:item.num??""}); }}
      >
        {isPlayer ? (
          editingItem?.id === item.id ? (
            <input autoFocus type="number" defaultValue={editingItem.num}
              className="w-7 h-7 rounded-full text-center font-bold border-2 bg-zinc-900 text-white border-white outline-none"
              style={{fontSize:10}}
              onBlur={e => saveEditNum(item.id, e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") saveEditNum(item.id,e.target.value); if(e.key==="Escape") setEditingItem(null); }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-white font-bold shadow-lg ${PLAYER_COLOR_STYLES[color]}`} style={{fontSize:10}} title="Doble clic para editar número">
              {item.num ?? ""}
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
          <button onClick={() => setTool("erase")}
            className={`px-3 py-1 rounded text-xs border transition-all ${tool==="erase"?"bg-red-700 border-red-500 text-white":"bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >🗑 Borrar</button>
          <button onClick={() => { onChange([]); setPlayerNum(1); }}
            className="px-3 py-1 rounded text-xs border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-red-700 hover:text-red-400 transition-all"
          >Limpiar</button>
        </div>
      </div>
      <p className="text-xs text-zinc-600">Haz clic para añadir · Arrastra para mover · Doble clic en jugador para editar número</p>
      {/* Field */}
      <div ref={fieldRef} className="relative w-full rounded-xl overflow-hidden select-none"
        style={{ paddingBottom:"65%", background:"#1a6b2e", cursor:"crosshair" }}
        onClick={addItem} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        <FieldMarkings type={fieldType} />
        <div className="absolute inset-0">{items.map(renderItem)}</div>
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
  const [pizarra, setPizarra] = useState((task?.pizarra || []).filter(el => el != null).map(el => ({ type: el.type || 'player', x: el.x || 0, y: el.y || 0, color: el.color || 'red', number: el.number || 1, material: el.material || '' })));

  const handleSave = (toLib = false) => {
    if (!nombre.trim()) return;
    const t = { id: task?.id || Date.now(), nombre, minutos, descripcion, pizarra };
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
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">Pizarra táctica</label>
            <Pizarra value={pizarra} onChange={setPizarra} />
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
function TareasSection({ team, data, onSave }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Biblioteca de tareas — {team}</h2>
        <Btn onClick={() => { setEditing(null); setShowEditor(true); }}>+ Nueva tarea</Btn>
      </div>
      <p className="text-zinc-500 text-sm">Aquí guardas tareas reutilizables que puedes añadir a cualquier entrenamiento.</p>

      <div className="space-y-3">
        {tasks.map(t => (
          <Card key={t.id} className="hover:border-zinc-600 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1 cursor-pointer" onClick={() => setPreview({ ...t, pizarra: (t.pizarra || []).filter(el => el != null) })}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold">{t.nombre}</span>
                  <Badge color="blue">⏱ {t.minutos} min</Badge>
                </div>
                {t.descripcion && <p className="text-zinc-400 text-sm line-clamp-2">{t.descripcion}</p>}
                {t.pizarra?.length > 0 && <p className="text-zinc-600 text-xs mt-1">🎨 Pizarra con {t.pizarra.length} elementos</p>}
              </div>
              <div className="flex gap-1 ml-3 shrink-0">
                <Btn small variant="secondary" onClick={() => { openEdit(t); }}>✏️</Btn>
                <Btn small variant="danger" onClick={() => delTask(t.id)}>🗑️</Btn>
              </div>
            </div>
          </Card>
        ))}
        {tasks.length === 0 && <p className="text-zinc-500 text-sm">No hay tareas en la biblioteca todavía.</p>}
      </div>

      {showEditor && (
        <TaskEditorModal
          task={editing}
          onSave={(t) => saveTask(t)}
          onClose={() => { setShowEditor(false); setEditing(null); }}
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
    onSave(newData);
    setShowTaskEditor(false);
    setEditingTask(null);
    // update taskTraining reference
    setTaskTraining(trainings.find(t => t.id === taskTraining.id));
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
    onSave({ ...data, trainings });
    setTaskTraining(trainings.find(t => t.id === taskTraining.id));
  };

  const printTraining = (t) => {
    const PLAYER_COLOR_HEX = { red:"#dc2626", yellow:"#eab308", blue:"#2563eb", green:"#16a34a" };
    const W = 500, H = 325;

    const renderFieldSVG = (items, fieldType) => {
      const markings = fieldType === "blank" ? "" : fieldType === "half" ? `
        <rect x="10" y="10" width="480" height="305" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <line x1="10" y1="162" x2="490" y2="162" stroke="white" stroke-width="2" opacity="0.6"/>
        <circle cx="250" cy="162" r="60" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="140" y="10" width="220" height="90" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="180" y="10" width="140" height="40" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="140" y="225" width="220" height="90" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="180" y="275" width="140" height="40" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
      ` : `
        <rect x="10" y="10" width="480" height="305" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <line x1="250" y1="10" x2="250" y2="315" stroke="white" stroke-width="2" opacity="0.6"/>
        <circle cx="250" cy="162" r="45" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="10" y="90" width="70" height="145" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="10" y="115" width="30" height="85" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="420" y="90" width="70" height="145" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
        <rect x="460" y="115" width="30" height="85" fill="none" stroke="white" stroke-width="2" opacity="0.6"/>
      `;
      const itemsSVG = (items || []).filter(item => item != null).map(item => {
        const cx = (item.x / 100) * W;
        const cy = (item.y / 100) * H;
        if (item.type.startsWith("player_")) {
          const color = item.type.replace("player_", "");
          return `<circle cx="${cx}" cy="${cy}" r="14" fill="${PLAYER_COLOR_HEX[color]}" stroke="white" stroke-width="1.5"/><text x="${cx}" y="${cy+4}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${item.num ?? ""}</text>`;
        }
        const icons = {cono:"🔶",chino:"🔺",porteria_grande:"⬛","porteria_pequeña":"▪",escalera:"🪜",pesa:"🏋",pica:"🚩",aro:"⭕"};
        return `<text x="${cx}" y="${cy+5}" text-anchor="middle" font-size="18">${icons[item.type]||"●"}</text>`;
      }).join("");
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#1a6b2e;border-radius:8px;display:block;margin:8px auto">${markings}${itemsSVG}</svg>`;
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
              <Btn small variant="secondary" onClick={() => { setTaskTraining(null); setShowTaskEditor(false); }}>✕</Btn>
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
    setView("form");
  };

  const saveMatch = () => {
    if (!rival) return;
    const resultado = golesLocal !== "" && golesVisitante !== "" ? `${golesLocal}-${golesVisitante}` : "";
    const matches = [...(data.matches || [])];
    if (editing) {
      const idx = matches.findIndex(m => m.id === editing.id);
      matches[idx] = { ...editing, rival, lugar, fecha, resultado };
    } else {
      const players = data.players || [];
      const convocatoria = players.map(p => ({
        playerId: p.id, playerName: p.name,
        status: "no_conv", minutos: 0, goles: 0, asistencias: 0, nota: ""
      }));
      matches.push({ id: Date.now(), rival, lugar, fecha, resultado, convocatoria });
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
                        <button key={opt.val}
                          onClick={() => setCoachAttRecord(sessionId, c.id, opt.val, coachAttMatch.fecha)}
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
                    <Badge color={s.tipo === "Partido" ? "red" : "blue"}>{s.tipo}</Badge>
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
        {players.map(p => {
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

  const ranked = players.map(p => ({
    ...p,
    ...getPlayerMatchStats(p.id),
    att: getPlayerAttendance(p.id),
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
function GestionSection({ db, onArchive, onRestore }) {
  const [seasons, setSeasons] = useState([]);
  const [seasonName, setSeasonName] = useState("");
  const [viewingSeason, setViewingSeason] = useState(null);
  const [viewingTeam, setViewingTeam] = useState(TEAMS[0]);
  const [confirming, setConfirming] = useState(false);
  const [confirmingRestore, setConfirmingRestore] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">⚙️ Gestión de temporadas</h2>

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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Entrenadores (coordinadores only)
// ══════════════════════════════════════════════════════════════════════════════
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

  const saveValuation = (matchId, coachId, field, value) => {
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

  const getCoachHistory = (coachId) => {
    return matches
      .filter(m => m.coachValuations?.find(v => v.coachId === coachId && v.nota !== "" && v.nota !== undefined))
      .map(m => {
        const v = m.coachValuations.find(v => v.coachId === coachId);
        return { rival: m.rival, fecha: m.fecha, nota: parseFloat(v.nota), comentario: v.comentario || "", coordinador: v.coordinador || "" };
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

      {/* Add coach - always visible */}
      <Card>
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
      </Card>

      {/* Valoraciones tab */}
      {tab === "valoraciones" && matches.length > 0 && coaches.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Valoraciones por partido</p>
          {matches.map(m => (
            <Card key={m.id}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-white font-semibold">vs {m.rival}</span>
                <span className="text-zinc-400 text-xs">📅 {m.fecha}</span>
                {m.resultado && <Badge color="green">{m.resultado}</Badge>}
              </div>
              <div className="space-y-3">
                {coaches.map(c => {
                  const val = (m.coachValuations || []).find(v => v.coachId === c.id) || {};
                  return (
                    <div key={c.id} className="bg-zinc-800 rounded-lg p-3 space-y-2">
                      <span className="text-zinc-300 text-sm font-semibold">{c.name}</span>
                      <Input label="Tu nombre (coordinador)" 
                        value={val.coordinador || coordProfile || ""}
                        onChange={e => saveValuation(m.id, c.id, "coordinador", e.target.value)}
                        placeholder="¿Quién hace esta valoración?"
                      />
                      <Input label="Nota (0-10)" type="number" step="0.01" min="0" max="10"
                        value={val.nota || ""}
                        onChange={e => saveValuation(m.id, c.id, "nota", e.target.value)}
                      />
                      <Textarea label="Observación"
                        value={val.comentario || ""}
                        onChange={e => saveValuation(m.id, c.id, "comentario", e.target.value)}
                        placeholder="Escribe tu observación sobre el entrenador..."
                        rows={3}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
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


export default function App() {
  const [authState, setAuthState] = useState("login"); // login | app
  const [role, setRole] = useState(null); // coordinator | trainer
  const [teamAccess, setTeamAccess] = useState(null);
  const [password, setPassword] = useState("");
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
    ...(isCoord ? [{ id: "gestion", label: "Gestión", icon: "⚙️" }] : []),
    { id: "plantilla", label: "Plantilla", icon: "👥" },
    { id: "entrenamientos", label: "Entrenamientos", icon: "🏃" },
    { id: "tareas", label: "Tareas", icon: "🗂" },
    { id: "partidos", label: "Partidos", icon: "⚽" },
    { id: "clasificacion", label: "Clasificaciones", icon: "🏆" },
    { id: "asistencia", label: "Asistencia", icon: "📋" },
  ];

  useEffect(() => {
    Promise.all([loadData(), loadSeasons()]).then(([d, s]) => {
      setDb(d || initState());
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
    } else if (teamInput !== "Coordinador" && TEAM_PASSWORDS[teamInput] === password) {
      setRole("trainer");
      setTeamAccess(teamInput);
      setActiveTeam(teamInput);
      setAuthState("app");
    } else {
      setLoginError("Contraseña incorrecta.");
    }
  };

  const updateTeamData = async (team, newData) => {
    const cleanTeam = (d) => ({
      ...d,
      trainings: (d.trainings || []).map(t => ({
        ...t,
        tasks: (t.tasks || []).map(task => ({
          ...task,
          pizarra: (task.pizarra || []).map(el => ({
            type: el.type, x: el.x, y: el.y, color: el.color, number: el.number, material: el.material
          }))
        }))
      })),
      tasks: (d.tasks || []).map(task => ({
        ...task,
        pizarra: (task.pizarra || []).map(el => ({
          type: el.type, x: el.x, y: el.y, color: el.color, number: el.number, material: el.material
        }))
      }))
    });
    const newDb = { ...db, [team]: cleanTeam(newData) };
    setDb(newDb);
    await saveData(newDb);
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
            {activeSection === "gestion" && isCoord && (
              <GestionSection db={db} onArchive={archiveSeason} onRestore={restoreSeason} />
            )}
            {activeSection === "plantilla" && (
              <PlantillaSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} seasons={seasons} />
            )}
            {activeSection === "entrenamientos" && (
              <EntrenamientosSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} />
            )}
            {activeSection === "tareas" && (
              <TareasSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} />
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
          </div>
        </div>
      </div>
    </div>
  );
}
