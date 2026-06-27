#!/usr/bin/env python3
"""
Patch v3 - Plantilla + Informes + Probando
Ejecutar desde la raiz del repo: python3 patch_v3.py
"""
import os, shutil
from datetime import datetime

FILE = "src/App.jsx"
if not os.path.exists(FILE):
    print("No se encuentra", FILE, "- ejecuta desde la raiz del repo")
    exit(1)

backup = f"{FILE}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
shutil.copy(FILE, backup)
print(f"Backup: {backup}")

with open(FILE, 'r') as f:
    content = f.read()

NEW_PLANTILLA = """// SECTION: Plantilla
// ══════════════════════════════════════════════════════════════════════════════
function PlantillaSection({ team, data, onSave, isCoord, seasons }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [dorsal, setDorsal] = useState("");
  const [positions, setPositions] = useState([]);
  const [posicionPrincipal, setPosicionPrincipal] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dni, setDni] = useState("");
  const [statsPlayer, setStatsPlayer] = useState(null);
  const [attPlayer, setAttPlayer] = useState(null);
  const [search, setSearch] = useState("");

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
    setShowForm(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const players = [...(data.players || [])];
    const playerData = { name, dorsal, positions, posicionPrincipal, ...(isCoord ? { telefono, dni } : {}) };
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
    if (!window.confirm("¿Eliminar jugador?")) return;
    onSave({ ...data, players: data.players.filter(p => p.id !== id) });
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Plantilla — {team}</h2>
        <Btn onClick={() => open()}>+ Añadir jugador</Btn>
      </div>

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
                        {isCoord && <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider hidden lg:table-cell">Teléfono</th>}
                        {isCoord && <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider hidden lg:table-cell">DNI</th>}
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
                              <td className="px-3 py-3 hidden lg:table-cell">
                                <span className="text-zinc-300 text-sm font-mono">{p.telefono || <span className="text-zinc-600">—</span>}</span>
                              </td>
                            )}
                            {isCoord && (
                              <td className="px-3 py-3 hidden lg:table-cell">
                                <span className="text-zinc-300 text-sm font-mono">{p.dni || <span className="text-zinc-600">—</span>}</span>
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

"""
NEW_INFORMES  = """
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
"""
NEW_PROBANDO  = """// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Jugadores Probando
// ══════════════════════════════════════════════════════════════════════════════
function ProbandoSection({ team, data, onSave, isCoord }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [dorsal, setDorsal] = useState("");
  const [positions, setPositions] = useState([]);
  const [posicionPrincipal, setPosicionPrincipal] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dni, setDni] = useState("");
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
    setFechaPrueba(p ? (p.fechaPrueba || new Date().toISOString().split("T")[0]) : new Date().toISOString().split("T")[0]);
    setEstadoPrueba(p ? (p.estadoPrueba || "pendiente") : "pendiente");
    setNotas(p ? (p.notas || "") : "");
    setShowForm(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const probando = [...(data.probando || [])];
    const playerData = { name, dorsal, positions, posicionPrincipal, telefono, dni, fechaPrueba, estadoPrueba, notas };
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

"""

# 1. Reemplazar PlantillaSection
start_idx = content.find("// SECTION: Plantilla")
end_idx   = content.find("// PIZARRA T\u00c1CTICA")
if end_idx == -1: end_idx = content.find("// PIZARRA TACTICA")
pre_start = content.rfind("\n", 0, start_idx - 3) + 1
content = content[:pre_start] + NEW_PLANTILLA + content[end_idx:]
print("PlantillaSection reemplazada")

# 2. Añadir InformesSection + ProbandoSection
EXPORT_MARKER = "export default function App() {"
content = content.replace(EXPORT_MARKER, NEW_INFORMES + "\n" + NEW_PROBANDO + "\n" + EXPORT_MARKER, 1)
print("InformesSection y ProbandoSection anadidas")

# 3. Estado informesPlayer
OLD_SIDEBAR = "  const [sidebarOpen, setSidebarOpen] = useState(true);"
NEW_SIDEBAR = """  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [informesPlayer, setInformesPlayer] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setInformesPlayer(e.detail);
      setActiveSection("informes");
    };
    window.addEventListener("openInformes", handler);
    return () => window.removeEventListener("openInformes", handler);
  }, []);"""
content = content.replace(OLD_SIDEBAR, NEW_SIDEBAR, 1)
print("Estado informesPlayer anadido")

# 4. Añadir probando al menú
OLD_SEC = '    { id: "plantilla", label: "Plantilla", icon: "👥" },'
NEW_SEC = '    { id: "plantilla", label: "Plantilla", icon: "👥" },\n    { id: "probando", label: "Probando", icon: "🔍" },'
content = content.replace(OLD_SEC, NEW_SEC, 1)
print("Seccion Probando anadida al menu")

# 5. Renders
OLD_RENDER = '{activeSection === "plantilla" && (\n              <PlantillaSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} seasons={seasons} />\n            )}'
NEW_RENDER = """{activeSection === "plantilla" && (
              <PlantillaSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} seasons={seasons} />
            )}
            {activeSection === "probando" && (
              <ProbandoSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} />
            )}
            {activeSection === "informes" && informesPlayer && (
              <InformesSection
                player={informesPlayer.player}
                team={informesPlayer.team}
                data={teamData}
                onSave={d => updateTeamData(activeTeam, d)}
                onBack={() => setActiveSection("plantilla")}
              />
            )}"""
content = content.replace(OLD_RENDER, NEW_RENDER, 1)
print("Renders anadidos")

with open(FILE, 'w') as f:
    f.write(content)

print("")
print("Patch v3 completado. Ejecuta: npm run dev")
