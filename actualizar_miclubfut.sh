#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ACTUALIZACIÓN COMPLETA MiClubFUT — sesión 11/07/2026
# Ejecutar desde la raíz del repo: bash actualizar_miclubfut.sh
# Se detiene ante el primer error sin subir nada.
# ═══════════════════════════════════════════════════════════════
set -e

echo "═══ [1/15] Entrenamientos: tarjetas compactas + menú ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

anchor_state = 'const [taskTraining, setTaskTraining] = useState(null);'
assert anchor_state in src, "No encontrado: estado taskTraining"
src = src.replace(anchor_state, anchor_state + '\n  const [menuTraining, setMenuTraining] = useState(null);', 1)

old_card = '''            <Card key={t.id}>
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
            </Card>'''
assert old_card in src, "No encontrado: tarjeta de entrenamiento"

new_card = '''            <Card key={t.id} className="cursor-pointer hover:border-zinc-600 transition-colors" onClick={() => setMenuTraining(t)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-red-400 font-bold text-sm">{t.fecha}</span>
                    {t.duracion && <Badge color="zinc">⏱ {t.duracion} min</Badge>}
                    {(t.tasks || []).length > 0 && <Badge color="blue">🗂 {(t.tasks||[]).length}</Badge>}
                    {t.duracion > 0 && (t.tasks||[]).length > 0 && (
                      <Badge color={totalTaskMin > t.duracion ? "red" : totalTaskMin === t.duracion ? "green" : "yellow"}>
                        {Math.round((totalTaskMin / t.duracion) * 100)}%
                      </Badge>
                    )}
                    {recs.length > 0 && (
                      <span className="text-xs">
                        <span className="text-green-400">{present}✓</span> <span className="text-yellow-400">{late}⏱</span> <span className="text-red-400">{absent}✗</span>
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-xs truncate">{t.desc || <span className="text-zinc-600 italic">Sin descripción</span>}</p>
                </div>
                <span className="text-zinc-500 text-xl shrink-0">›</span>
              </div>
            </Card>'''
src = src.replace(old_card, new_card, 1)

anchor_modal = '      {/* Tasks panel modal */}'
assert anchor_modal in src, "No encontrado: comentario Tasks panel modal"

menu_modal = '''      {/* Menú de acciones del entrenamiento */}
      {menuTraining && (() => {
        const t = menuTraining;
        const totalMin = (t.tasks || []).reduce((s, x) => s + (x.minutos || 0), 0);
        return (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-end md:items-center md:justify-center" onClick={() => setMenuTraining(null)}>
            <div className="bg-zinc-900 border-t border-zinc-700 md:border md:rounded-xl rounded-t-2xl w-full md:max-w-md p-5 pb-8 space-y-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto md:hidden" />
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-red-400 font-bold">{t.fecha}</span>
                  {t.duracion && <Badge color="zinc">⏱ {t.duracion} min</Badge>}
                  {(t.tasks || []).length > 0 && <Badge color="blue">🗂 {(t.tasks||[]).length} tareas · {totalMin} min</Badge>}
                </div>
                <p className="text-zinc-300 text-sm whitespace-pre-wrap">{t.desc || <span className="text-zinc-500 italic">Sin descripción</span>}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="secondary" onClick={() => { setMenuTraining(null); setTaskTraining(t); }}>🗂 Tareas</Btn>
                <Btn variant="primary" onClick={() => { setMenuTraining(null); setAttTraining(t); }}>📋 Jugadores</Btn>
                {(data.coaches || []).length > 0 && isCoord && <Btn variant="secondary" onClick={() => { setMenuTraining(null); setCoachAttTraining(t); }}>🧑‍🏫 Entrenadores</Btn>}
                <Btn variant="secondary" onClick={() => { setMenuTraining(null); printTraining(t); }}>🖨️ PDF</Btn>
                <Btn variant="secondary" onClick={() => { setMenuTraining(null); open(t); }}>✏️ Editar</Btn>
                <Btn variant="danger" onClick={() => { setMenuTraining(null); del(t.id); }}>🗑️ Eliminar</Btn>
              </div>
              <Btn variant="ghost" className="w-full justify-center" onClick={() => setMenuTraining(null)}>Cerrar</Btn>
            </div>
          </div>
        );
      })()}

'''
src = src.replace(anchor_modal, menu_modal + anchor_modal, 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [1/15] OK")
PYEOF

echo "═══ [2/15] Partidos: tarjetas compactas + menú ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

anchor_state = 'const [coachAttMatch, setCoachAttMatch] = useState(null);'
assert anchor_state in src, "No encontrado: estado coachAttMatch"
src = src.replace(anchor_state, anchor_state + '\n  const [menuMatch, setMenuMatch] = useState(null);', 1)

old_card = '''          <Card key={m.id} className="hover:border-zinc-600 transition-colors cursor-pointer" onClick={() => openDetail(m)}>
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
          </Card>'''
assert old_card in src, "No encontrado: tarjeta de partido"

new_card = '''          <Card key={m.id} className="hover:border-zinc-600 transition-colors cursor-pointer" onClick={() => setMenuMatch(m)}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-white font-bold block truncate">vs {m.rival}</span>
                <div className="flex gap-3 text-xs text-zinc-400">
                  <span>📅 {m.fecha}</span>
                  {m.lugar && <span className="truncate">📍 {m.lugar}</span>}
                </div>
              </div>
              {m.resultado
                ? <span className="text-white font-black text-2xl shrink-0">{m.resultado}</span>
                : <span className="text-zinc-600 text-xs shrink-0">Sin resultado</span>}
              <span className="text-zinc-500 text-xl shrink-0">›</span>
            </div>
          </Card>'''
src = src.replace(old_card, new_card, 1)

anchor_modal = '''      {/* Attendance modal */}
      {attMatch && ('''
assert anchor_modal in src, "No encontrado: attendance modal de partidos"

menu_modal = '''      {/* Menú de acciones del partido */}
      {menuMatch && (() => {
        const m = menuMatch;
        return (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-end md:items-center md:justify-center" onClick={() => setMenuMatch(null)}>
            <div className="bg-zinc-900 border-t border-zinc-700 md:border md:rounded-xl rounded-t-2xl w-full md:max-w-md p-5 pb-8 space-y-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto md:hidden" />
              <div className="text-center">
                <p className="text-white font-bold text-lg">vs {m.rival}</p>
                {m.resultado && <p className="text-white font-black text-4xl my-1">{m.resultado}</p>}
                <div className="flex gap-3 text-xs text-zinc-400 justify-center flex-wrap">
                  <span>📅 {m.fecha}</span>
                  {m.lugar && <span>📍 {m.lugar}</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="primary" onClick={() => { setMenuMatch(null); openDetail(m); }}>⭐ Valorar</Btn>
                <Btn variant="secondary" onClick={() => { setMenuMatch(null); setAttMatch(m); }}>📋 Jugadores</Btn>
                {(data.coaches || []).length > 0 && isCoord && <Btn variant="secondary" onClick={() => { setMenuMatch(null); setCoachAttMatch(m); }}>🧑‍🏫 Entrenadores</Btn>}
                <Btn variant="secondary" onClick={() => { setMenuMatch(null); openForm(m); }}>✏️ Editar</Btn>
                <Btn variant="danger" onClick={() => { setMenuMatch(null); delMatch(m.id); }}>🗑️ Eliminar</Btn>
              </div>
              <Btn variant="ghost" className="w-full justify-center" onClick={() => setMenuMatch(null)}>Cerrar</Btn>
            </div>
          </div>
        );
      })()}

'''
src = src.replace(anchor_modal, menu_modal + anchor_modal, 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [2/15] OK")
PYEOF

echo "═══ [3/15] Plantilla: lista compacta + ficha de jugador ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

anchor_state = 'const [fichas, setFichas] = useState(null);'
assert anchor_state in src, "No encontrado: estado fichas"
src = src.replace(anchor_state, anchor_state + '\n  const [menuPlayer, setMenuPlayer] = useState(null);', 1)

old_table = '<div className="rounded-xl border border-zinc-800 overflow-hidden">'
assert old_table in src, "No encontrado: contenedor de tabla"
mobile_list = '''<div className="md:hidden space-y-1.5 mb-2">
                  {players.map(p => {
                    const st = PLAYER_STATUSES.find(s => s.val === (p.status || "disponible")) || PLAYER_STATUSES[0];
                    return (
                      <div key={p.id} onClick={() => setMenuPlayer(p)}
                        className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 cursor-pointer active:bg-zinc-800 transition-colors">
                        <span className={`font-black text-base w-9 shrink-0 ${c.text}`}>{p.dorsal ? `#${p.dorsal}` : "—"}</span>
                        <span className="text-white font-semibold flex-1 truncate">{p.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${st.color}`}>{st.label}</span>
                        <span className="text-zinc-500 text-lg shrink-0">›</span>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden md:block rounded-xl border border-zinc-800 overflow-hidden">'''
src = src.replace(old_table, mobile_list, 1)

anchor_modal = '      {fichaVisor && ('
assert anchor_modal in src, "No encontrado: fichaVisor"
player_modal = '''      {/* Ficha del jugador (móvil) */}
      {menuPlayer && (() => {
        const p = (data.players || []).find(x => x.id === menuPlayer.id) || menuPlayer;
        const cM = posColorMap[getPosGroup(p)] || posColorMap["Sin posición"];
        return (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-end md:items-center md:justify-center" onClick={() => setMenuPlayer(null)}>
            <div className="bg-zinc-900 border-t border-zinc-700 md:border md:rounded-xl rounded-t-2xl w-full md:max-w-md p-5 pb-8 space-y-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto md:hidden" />
              <div className="text-center">
                <p className="text-white font-bold text-xl">{p.name} {p.dorsal && <span className={cM.text}>#{p.dorsal}</span>}</p>
                <div className="mt-1.5">
                  {p.posicionPrincipal && <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cM.bg} ${cM.border} ${cM.text}`}>{p.posicionPrincipal}</span>}
                </div>
                {isCoord && p.dni && <p className="text-zinc-500 text-xs mt-2 font-mono">DNI: {p.dni}</p>}
                {isCoord && p.telefono && <p className="text-zinc-500 text-xs font-mono">📞 {p.telefono}</p>}
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Estado</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLAYER_STATUSES.map(s => (
                    <button key={s.val} onClick={() => setPlayerStatus(p.id, s.val)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${(p.status || "disponible") === s.val ? s.color : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="secondary" onClick={() => { setMenuPlayer(null); setStatsPlayer(p); }}>📈 Estadísticas</Btn>
                <Btn variant="secondary" onClick={() => { setMenuPlayer(null); setAttPlayer(p); }}>📋 Asistencia</Btn>
                <Btn variant="secondary" onClick={() => { setMenuPlayer(null); window.dispatchEvent(new CustomEvent("openInformes", { detail: { player: p, team } })); }}>📝 Informes</Btn>
                <Btn variant="secondary" onClick={() => { setMenuPlayer(null); open(p); }}>✏️ Editar</Btn>
                <Btn variant="danger" onClick={() => { setMenuPlayer(null); del(p.id); }}>🗑️ Eliminar</Btn>
              </div>
              <Btn variant="ghost" className="w-full justify-center" onClick={() => setMenuPlayer(null)}>Cerrar</Btn>
            </div>
          </div>
        );
      })()}

''' + anchor_modal
src = src.replace(anchor_modal, player_modal, 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [3/15] OK")
PYEOF

echo "═══ [4/15] Diseño unificado PC + ficha PDF + pulido global ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

old_list = '<div className="md:hidden space-y-1.5 mb-2">'
assert old_list in src, "No encontrado: lista móvil plantilla"
src = src.replace(old_list, '<div className="space-y-1.5 mb-2">', 1)

old_table = '<div className="hidden md:block rounded-xl border border-zinc-800 overflow-hidden">'
assert old_table in src, "No encontrado: tabla desktop plantilla"
src = src.replace(old_table, '<div className="hidden rounded-xl border border-zinc-800 overflow-hidden">', 1)

anchor_estado = '''              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Estado</p>'''
assert anchor_estado in src, "No encontrado: sección Estado en ficha jugador"
ficha_block = '''              {isCoord && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Ficha PDF</p>
                  {fichaUploading[p.id] ? (
                    <span className="text-xs text-zinc-400 animate-pulse">⏳ Guardando...</span>
                  ) : fichas && fichas[String(p.id)] ? (
                    <div className="flex gap-2 flex-wrap">
                      <Btn variant="secondary" onClick={() => {
                        const b64 = fichas[String(p.id)].base64;
                        const byteStr = atob(b64.split(",")[1]);
                        const arr = new Uint8Array(byteStr.length);
                        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
                        const blob = new Blob([arr], { type: "application/pdf" });
                        setMenuPlayer(null);
                        setFichaVisor({ blobUrl: URL.createObjectURL(blob), blob, nombre: fichas[String(p.id)].nombre || "ficha.pdf" });
                      }}>📄 Ver</Btn>
                      <label className="px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 cursor-pointer transition-all">
                        🔄 Reemplazar
                        <input type="file" accept="application/pdf" className="hidden"
                          onChange={e => { if (e.target.files[0]) handleFichaUpload(p, e.target.files[0]); e.target.value = ""; }} />
                      </label>
                      <Btn variant="danger" onClick={() => handleFichaDelete(p)}>🗑️</Btn>
                    </div>
                  ) : (
                    <label className="inline-block px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 cursor-pointer transition-all">
                      ⬆️ Subir PDF
                      <input type="file" accept="application/pdf" className="hidden"
                        onChange={e => { if (e.target.files[0]) handleFichaUpload(p, e.target.files[0]); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
              )}
''' + anchor_estado
src = src.replace(anchor_estado, ficha_block, 1)

old_btn = 'const base = "font-bold rounded transition-all duration-150 border-0 ";'
assert old_btn in src, "No encontrado: base de Btn"
src = src.replace(old_btn, 'const base = "font-semibold rounded-lg transition-all duration-150 border-0 ";', 1)

old_card = 'const Card = ({ children, className = "", onClick }) => (\n  <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 ${className}`}>{children}</div>\n);'
assert old_card in src, "No encontrado: componente Card"
src = src.replace(old_card, 'const Card = ({ children, className = "", onClick }) => (\n  <div onClick={onClick} className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-5 ${className}`}>{children}</div>\n);', 1)

src = src.replace(
  'className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full"',
  'className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full"', 1)
src = src.replace(
  'className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full resize-none"',
  'className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-red-600 w-full resize-none"', 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [4/15] OK")
PYEOF

echo "═══ [5/15] Asistencia: Ranking + Sesiones ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

start_marker = 'function AsistenciaSection({ team, data, onSave, isCoord }) {'
end_marker = 'function TacticasSection({ team, data, onSave }) {'
assert start_marker in src, "No encontrado: inicio AsistenciaSection"
assert end_marker in src, "No encontrado: inicio TacticasSection"
i_start = src.index(start_marker)
i_end = src.index(end_marker)
assert i_start < i_end, "Orden inesperado de componentes"

new_component = '''function AsistenciaSection({ team, data, onSave, isCoord }) {
  const [tab, setTab] = useState("ranking");
  const [activePlayer, setActivePlayer] = useState(null);
  const [sesionEdit, setSesionEdit] = useState(null);

  const players = data.players || [];

  const sessions = [
    ...(data.trainings || []).map(t => ({ id: `t_${t.id}`, rawId: t.id, kind: "training", fecha: t.fecha, tipo: "Entrenamiento", desc: t.desc || "" })),
    ...(data.matches || []).map(m => ({ id: `m_${m.id}`, rawId: m.id, kind: "match", fecha: m.fecha, tipo: "Partido", desc: `vs ${m.rival}` }))
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const setRecord = (sessionId, playerId, playerName, status, fecha) => {
    const att = [...(data.attendance || [])].filter(a => !(a.sessionId === sessionId && a.playerId === playerId));
    att.push({ sessionId, playerId, playerName, status, fecha });
    onSave({ ...data, attendance: att });
  };

  const delRecord = (sessionId, playerId) => {
    const att = (data.attendance || []).filter(a => !(a.sessionId === sessionId && a.playerId === playerId));
    onSave({ ...data, attendance: att });
  };

  const deleteSession = (s) => {
    if (!window.confirm(`¿Eliminar ${s.tipo.toLowerCase()} del ${s.fecha}?\\nSe borrarán también sus registros de asistencia.`)) return;
    const newData = { ...data };
    if (s.kind === "training") newData.trainings = (data.trainings || []).filter(t => t.id !== s.rawId);
    else newData.matches = (data.matches || []).filter(m => m.id !== s.rawId);
    newData.attendance = (data.attendance || []).filter(a => a.sessionId !== s.id);
    newData.coachAttendance = (data.coachAttendance || []).filter(a => a.sessionId !== s.id);
    onSave(newData);
    setSesionEdit(null);
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

  const ranked = players.map(p => {
    const s = getPlayerStats(p.id);
    const total = s.present + s.late + s.absent;
    return { ...p, ...s, total, pct: total ? Math.round(((s.present + s.late) / total) * 100) : 0 };
  }).sort((a, b) => (b.present + b.late) - (a.present + a.late) || a.absent - b.absent);

  const maxTotal = Math.max(1, ...ranked.map(r => r.total));
  const medal = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

  if (activePlayer) {
    const p = activePlayer;
    const stats = getPlayerStats(p.id);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Btn variant="ghost" onClick={() => setActivePlayer(null)}>← Volver</Btn>
          <h2 className="text-xl font-bold text-white">{p.name}</h2>
        </div>
        <Card>
          <AttendanceChart {...stats} />
        </Card>
        <div className="space-y-2">
          {sessions.map(s => {
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
                    <button key={opt.val} onClick={() => setRecord(s.id, p.id, p.name, opt.val, s.fecha)}
                      className={`text-xs px-2 py-1 rounded border transition-all ${statusBtnClass(rec?.status, opt.val, opt.color)}`}>{opt.label}</button>
                  ))}
                  {rec && <Btn small variant="danger" onClick={() => delRecord(s.id, p.id)}>✕</Btn>}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Asistencia — {team}</h2>

      <div className="flex gap-2">
        <button onClick={() => setTab("ranking")}
          className={`px-4 py-2 rounded-lg text-sm border transition-all ${tab === "ranking" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>📊 Ranking</button>
        <button onClick={() => setTab("sesiones")}
          className={`px-4 py-2 rounded-lg text-sm border transition-all ${tab === "sesiones" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>🗓 Sesiones</button>
      </div>

      {tab === "ranking" && (
        <div className="space-y-1.5">
          {ranked.length === 0 && <p className="text-zinc-500 text-sm">No hay jugadores en la plantilla.</p>}
          {ranked.map((p, i) => (
            <div key={p.id} onClick={() => setActivePlayer(p)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 cursor-pointer active:bg-zinc-800 hover:border-zinc-600 transition-colors">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-7 text-center shrink-0">{medal(i)}</span>
                <span className="text-white font-semibold flex-1 truncate text-sm">{p.name}</span>
                <span className={`text-sm font-black shrink-0 ${p.pct >= 75 ? "text-green-400" : p.pct >= 50 ? "text-yellow-400" : "text-red-400"}`}>{p.total > 0 ? p.pct + "%" : "—"}</span>
                <span className="text-zinc-500 text-lg shrink-0">›</span>
              </div>
              {p.total > 0 ? (
                <div className="flex h-2.5 rounded-full overflow-hidden gap-px ml-9" style={{ width: `${Math.max(15, (p.total / maxTotal) * 100 - 10)}%` }}>
                  {p.present > 0 && <div className="bg-green-500" style={{ flex: p.present }} />}
                  {p.late > 0 && <div className="bg-yellow-500" style={{ flex: p.late }} />}
                  {p.absent > 0 && <div className="bg-red-600" style={{ flex: p.absent }} />}
                </div>
              ) : <p className="text-zinc-600 text-xs ml-9">Sin registros</p>}
            </div>
          ))}
          {ranked.length > 0 && (
            <div className="flex gap-4 text-xs text-zinc-500 pt-2 px-1">
              <span><span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-sm mr-1"></span>Asistió</span>
              <span><span className="inline-block w-2.5 h-2.5 bg-yellow-500 rounded-sm mr-1"></span>Tarde</span>
              <span><span className="inline-block w-2.5 h-2.5 bg-red-600 rounded-sm mr-1"></span>Faltó</span>
            </div>
          )}
        </div>
      )}

      {tab === "sesiones" && (
        <div className="space-y-1.5">
          {sessions.length === 0 && <p className="text-zinc-500 text-sm">No hay entrenamientos ni partidos registrados.</p>}
          {sessions.map(s => {
            const recs = (data.attendance || []).filter(a => a.sessionId === s.id);
            const pres = recs.filter(r => r.status === "present").length;
            const tar = recs.filter(r => r.status === "late").length;
            const aus = recs.filter(r => r.status === "absent").length;
            return (
              <div key={s.id} onClick={() => setSesionEdit(s)}
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 cursor-pointer active:bg-zinc-800 hover:border-zinc-600 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">{s.fecha}</span>
                    <Badge color={s.tipo === "Partido" ? "red" : "blue"}>{s.tipo}</Badge>
                  </div>
                  <p className="text-zinc-400 text-xs truncate">{s.desc || "Sin descripción"}</p>
                </div>
                {recs.length > 0
                  ? <span className="text-xs shrink-0"><span className="text-green-400">{pres}✓</span> <span className="text-yellow-400">{tar}⏱</span> <span className="text-red-400">{aus}✗</span></span>
                  : <span className="text-zinc-600 text-xs shrink-0">Sin pasar lista</span>}
                <span className="text-zinc-500 text-lg shrink-0">›</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Hoja de edición de sesión ── */}
      {sesionEdit && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-end md:items-center md:justify-center" onClick={() => setSesionEdit(null)}>
          <div className="bg-zinc-900 border-t border-zinc-700 md:border md:rounded-xl rounded-t-2xl w-full md:max-w-lg p-5 pb-8 space-y-3 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto md:hidden" />
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-white font-bold">{sesionEdit.fecha} <Badge color={sesionEdit.tipo === "Partido" ? "red" : "blue"}>{sesionEdit.tipo}</Badge></p>
                <p className="text-zinc-400 text-xs">{sesionEdit.desc || "Sin descripción"}</p>
              </div>
              <Btn small variant="danger" onClick={() => deleteSession(sesionEdit)}>🗑️ Eliminar sesión</Btn>
            </div>
            <div className="space-y-1.5">
              {players.length === 0 && <p className="text-zinc-500 text-sm">No hay jugadores en la plantilla.</p>}
              {players.map(p => {
                const rec = (data.attendance || []).find(a => a.sessionId === sesionEdit.id && a.playerId === p.id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2.5">
                    <span className="text-white text-sm font-semibold flex-1 min-w-0 truncate">{p.name}</span>
                    <div className="flex gap-1 shrink-0">
                      {statusOpts.map(opt => (
                        <button key={opt.val} onClick={() => setRecord(sesionEdit.id, p.id, p.name, opt.val, sesionEdit.fecha)}
                          className={`text-xs px-2 py-1 rounded border transition-all ${statusBtnClass(rec?.status, opt.val, opt.color)}`}>{opt.label}</button>
                      ))}
                      {rec && <Btn small variant="danger" onClick={() => delRecord(sesionEdit.id, p.id)}>✕</Btn>}
                    </div>
                  </div>
                );
              })}
            </div>
            <Btn variant="ghost" className="w-full justify-center" onClick={() => setSesionEdit(null)}>Cerrar</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Tácticas Animadas
// ══════════════════════════════════════════════════════════════════════════════
'''

src = src[:i_start] + new_component + src[i_end:]

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [5/15] OK")
PYEOF

echo "═══ [6/15] Asistencia: pestaña Evolución (gráfico mensual) ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

anchor_tab = '''        <button onClick={() => setTab("sesiones")}
          className={`px-4 py-2 rounded-lg text-sm border transition-all ${tab === "sesiones" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>🗓 Sesiones</button>'''
assert anchor_tab in src, "No encontrado: botón pestaña sesiones"
src = src.replace(anchor_tab, anchor_tab + '''
        <button onClick={() => setTab("evolucion")}
          className={`px-4 py-2 rounded-lg text-sm border transition-all ${tab === "evolucion" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>📈 Evolución</button>''', 1)

anchor_content = '      {/* ── Hoja de edición de sesión ── */}'
assert anchor_content in src, "No encontrado: hoja de edición de sesión"

evolucion = '''      {/* ── TAB EVOLUCIÓN ── */}
      {tab === "evolucion" && (() => {
        const att = data.attendance || [];
        const meses = [...new Set(att.map(a => (a.fecha || "").slice(0, 7)).filter(m => m.length === 7))].sort();
        if (meses.length === 0) return <p className="text-zinc-500 text-sm">Aún no hay registros de asistencia con fecha.</p>;

        const MESES_ES = { "01":"ene","02":"feb","03":"mar","04":"abr","05":"may","06":"jun","07":"jul","08":"ago","09":"sep","10":"oct","11":"nov","12":"dic" };
        const label = (m) => MESES_ES[m.slice(5)] + " " + m.slice(2, 4);

        const pctMes = (recs, mes) => {
          const r = recs.filter(a => (a.fecha || "").startsWith(mes));
          if (!r.length) return null;
          return Math.round((r.filter(x => x.status === "present" || x.status === "late").length / r.length) * 100);
        };

        const equipoSerie = meses.map(m => pctMes(att, m));
        const top5 = ranked.filter(p => p.total > 0).slice(0, 5);
        const COLORES = ["#f87171", "#60a5fa", "#facc15", "#4ade80", "#c084fc"];
        const series = top5.map((p, i) => ({
          nombre: p.name,
          color: COLORES[i],
          puntos: meses.map(m => pctMes(att.filter(a => a.playerId === p.id), m)),
        }));

        const W = 100, H = 55, PAD = 6;
        const x = (i) => meses.length === 1 ? W / 2 : PAD + (i / (meses.length - 1)) * (W - 2 * PAD);
        const y = (pct) => H - PAD - (pct / 100) * (H - 2 * PAD);
        const toPath = (pts) => pts.map((p, i) => p === null ? null : `${x(i)},${y(p)}`).filter(Boolean).join(" ");

        return (
          <div className="space-y-3">
            <Card>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">% de asistencia por mes</p>
              <svg viewBox={`0 0 ${W} ${H + 8}`} className="w-full">
                {[0, 25, 50, 75, 100].map(g => (
                  <g key={g}>
                    <line x1={PAD} y1={y(g)} x2={W - PAD} y2={y(g)} stroke="#3f3f46" strokeWidth="0.3" />
                    <text x={PAD - 1} y={y(g) + 1} fontSize="2.8" fill="#71717a" textAnchor="end">{g}</text>
                  </g>
                ))}
                {series.map(s => (
                  <polyline key={s.nombre} points={toPath(s.puntos)} fill="none" stroke={s.color} strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
                ))}
                <polyline points={toPath(equipoSerie)} fill="none" stroke="#ffffff" strokeWidth="1.4" strokeDasharray="2 1.2" strokeLinejoin="round" strokeLinecap="round" />
                {meses.map((m, i) => equipoSerie[i] !== null && (
                  <circle key={m} cx={x(i)} cy={y(equipoSerie[i])} r="1.1" fill="#ffffff" />
                ))}
                {meses.map((m, i) => (
                  <text key={m} x={x(i)} y={H + 5} fontSize="2.8" fill="#a1a1aa" textAnchor="middle">{label(m)}</text>
                ))}
              </svg>
            </Card>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs px-1">
              <span className="text-zinc-300"><span className="inline-block w-4 h-0.5 bg-white align-middle mr-1.5" style={{borderTop:"2px dashed white",height:0}}></span>Equipo</span>
              {series.map(s => (
                <span key={s.nombre} className="text-zinc-400"><span className="inline-block w-4 h-1 rounded-full align-middle mr-1.5" style={{ backgroundColor: s.color }}></span>{s.nombre}</span>
              ))}
            </div>
            <p className="text-zinc-600 text-xs px-1">Se muestran los 5 jugadores con más asistencias. La línea blanca discontinua es la media del equipo.</p>
          </div>
        );
      })()}

''' + anchor_content
src = src.replace(anchor_content, evolucion, 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [6/15] OK")
PYEOF

echo "═══ [7/15] Banco de Jugadores: filas compactas + ficha ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

anchor_state = 'const [tab, setTab] = React.useState("todos");'
assert anchor_state in src, "No encontrado: estado tab del banco"
src = src.replace(anchor_state, anchor_state + '\n  const [menuBanco, setMenuBanco] = React.useState(null);', 1)

old_header = '''      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Banco de Jugadores</h2>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={actualizarFechas} disabled={importing}>Actualizar fechas</Btn>
          <Btn variant="secondary" onClick={importarDeEquipos} disabled={importing}>{importing ? "Importando..." : "Importar de equipos"}</Btn>
          <Btn onClick={() => openForm()}>+ Añadir jugador</Btn>
        </div>
      </div>'''
assert old_header in src, "No encontrado: cabecera del banco"
new_header = '''      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Banco de Jugadores</h2>
        <div className="flex gap-2 flex-wrap">
          <Btn small variant="secondary" onClick={actualizarFechas} disabled={importing}>🔄 Fechas</Btn>
          <Btn small variant="secondary" onClick={importarDeEquipos} disabled={importing}>{importing ? "Importando..." : "📥 Importar"}</Btn>
          <Btn small onClick={() => openForm()}>+ Añadir</Btn>
        </div>
      </div>'''
src = src.replace(old_header, new_header, 1)

old_filters = '''        <div className="ml-auto flex gap-2">'''
assert old_filters in src, "No encontrado: filtros del banco"
src = src.replace(old_filters, '''        <div className="w-full md:w-auto md:ml-auto flex gap-2 flex-wrap">''', 1)

old_row = '''        {jugadoresFiltrados.map(j => (
          <div key={j.id} className="flex items-center gap-3 py-2.5 border-b border-zinc-800 last:border-0">
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {j.nombre[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-semibold">{j.nombre}</div>
              <div className="text-zinc-500 text-xs flex gap-3 flex-wrap">
                {j.fechaNac && <span className="text-zinc-300">{calcEdad(j.fechaNac)} años ({new Date(j.fechaNac).getFullYear()})</span>}
                {j.posicion && <span>{j.posicion}</span>}
                {j.telefono && <span>{j.telefono}</span>}
                {j.equipoOrigen && <span className="text-zinc-600">📍 {j.equipoOrigen}</span>}
              </div>
            </div>
            <Badge color={ESTADO_COLOR[j.estado] || "zinc"}>{j.estado}</Badge>
            {onAddToEquipo && <Btn small variant="secondary" onClick={() => onAddToEquipo(j)}>+ Equipo</Btn>}
            <Btn small onClick={() => openForm(j)}>Editar</Btn>
            <Btn small variant="danger" onClick={() => eliminarJugador(j.id)}>Eliminar</Btn>
          </div>
        ))}'''
assert old_row in src, "No encontrado: fila de jugador del banco"
new_row = '''        {jugadoresFiltrados.map(j => (
          <div key={j.id} onClick={() => setMenuBanco(j)}
            className="flex items-center gap-3 py-3 border-b border-zinc-800 last:border-0 cursor-pointer active:bg-zinc-800/50 transition-colors">
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {j.nombre[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-semibold truncate">{j.nombre}</div>
              <div className="text-zinc-500 text-xs truncate">
                {[j.fechaNac ? new Date(j.fechaNac).getFullYear() : null, j.posicion, j.equipoOrigen].filter(Boolean).join(" · ") || "Sin datos"}
              </div>
            </div>
            <Badge color={ESTADO_COLOR[j.estado] || "zinc"}>{j.estado}</Badge>
            <span className="text-zinc-500 text-lg shrink-0">›</span>
          </div>
        ))}'''
src = src.replace(old_row, new_row, 1)

anchor_end = '''      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCION: Gestión de equipos y usuarios del club'''
assert anchor_end in src, "No encontrado: final de BancoJugadoresSection"
banco_modal = '''      </Card>

      {/* Ficha del jugador del banco */}
      {menuBanco && (() => {
        const j = jugadores.find(x => x.id === menuBanco.id) || menuBanco;
        return (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-end md:items-center md:justify-center" onClick={() => setMenuBanco(null)}>
            <div className="bg-zinc-900 border-t border-zinc-700 md:border md:rounded-xl rounded-t-2xl w-full md:max-w-md p-5 pb-8 space-y-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto md:hidden" />
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center text-white text-xl font-bold mx-auto mb-2">
                  {j.nombre[0]?.toUpperCase()}
                </div>
                <p className="text-white font-bold text-lg">{j.nombre}</p>
                <div className="mt-1"><Badge color={ESTADO_COLOR[j.estado] || "zinc"}>{j.estado}</Badge></div>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-4 space-y-1.5 text-sm">
                {j.fechaNac && <p className="text-zinc-300">🎂 {calcEdad(j.fechaNac)} años ({new Date(j.fechaNac).toLocaleDateString("es-ES")})</p>}
                {j.posicion && <p className="text-zinc-300">⚽ {j.posicion}{(j.posicionesSecundarias||[]).length > 0 ? " · " + j.posicionesSecundarias.join(", ") : ""}</p>}
                {j.telefono && <p className="text-zinc-300">📞 {j.telefono}</p>}
                {j.dni && <p className="text-zinc-300 font-mono">🪪 {j.dni}</p>}
                {j.equipoOrigen && <p className="text-zinc-400">📍 {j.equipoOrigen}</p>}
                {j.notas && <p className="text-zinc-400 italic pt-1 border-t border-zinc-700">{j.notas}</p>}
                {!j.fechaNac && !j.posicion && !j.telefono && !j.dni && <p className="text-zinc-600">Sin más datos.</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {onAddToEquipo && <Btn variant="secondary" onClick={() => { setMenuBanco(null); onAddToEquipo(j); }}>➕ A equipo</Btn>}
                <Btn variant="secondary" onClick={() => { setMenuBanco(null); openForm(j); }}>✏️ Editar</Btn>
                <Btn variant="danger" onClick={() => { setMenuBanco(null); eliminarJugador(j.id); }}>🗑️ Eliminar</Btn>
              </div>
              <Btn variant="ghost" className="w-full justify-center" onClick={() => setMenuBanco(null)}>Cerrar</Btn>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECCION: Gestión de equipos y usuarios del club'''
src = src.replace(anchor_end, banco_modal, 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [7/15] OK")
PYEOF

echo "═══ [8/15] Clasificaciones: Mi equipo + Global + podio ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

old_render = '<ClasificacionSection team={activeTeam} data={teamData} />'
assert old_render in src, "No encontrado: render de ClasificacionSection"
src = src.replace(old_render, '<ClasificacionSection team={activeTeam} data={teamData} db={db} />', 1)

start_marker = 'function ClasificacionSection({ team, data }) {'
end_marker = 'function MejoresRivalesSection({ db }) {'
assert start_marker in src, "No encontrado: inicio ClasificacionSection"
assert end_marker in src, "No encontrado: inicio MejoresRivalesSection"
i_start = src.index(start_marker)
i_end = src.index(end_marker)
assert i_start < i_end, "Orden inesperado"

new_component = '''function ClasificacionSection({ team, data, db }) {
  const [tab, setTab] = useState("goles");
  const [scope, setScope] = useState("equipo");

  const TABS = [
    { id: "goles", label: "🥇 Goles" },
    { id: "asistencias", label: "🎯 Asist." },
    { id: "ga", label: "⚡ G+A" },
    { id: "minutos", label: "⏱ Minutos" },
    { id: "partidos", label: "📋 Partidos" },
  ];

  const statsFromTeam = (teamData, teamName) => {
    const players = teamData?.players || [];
    const matches = teamData?.matches || [];
    return players.map(p => {
      let goles = 0, asistencias = 0, minutos = 0, titular = 0, suplente = 0;
      matches.forEach(m => {
        const c = (m.convocatoria || []).find(c => c.playerId === p.id);
        if (!c) return;
        goles += c.goles || 0;
        asistencias += c.asistencias || 0;
        minutos += c.minutos || 0;
        if (c.status === "titular") titular++;
        else if (c.status === "suplente") suplente++;
      });
      return { key: teamName + "_" + p.id, name: p.name, equipo: teamName, goles, asistencias, ga: goles + asistencias, minutos, titular, suplente, partidos: titular + suplente };
    });
  };

  const ranked = scope === "equipo"
    ? statsFromTeam(data, team)
    : Object.entries(db || {})
        .filter(([k, v]) => !k.startsWith("__") && v && typeof v === "object" && Array.isArray(v.players))
        .flatMap(([k, v]) => statsFromTeam(v, k));

  const FIELD = { goles: "goles", asistencias: "asistencias", ga: "ga", minutos: "minutos", partidos: "partidos" };
  const UNIT = { goles: "⚽", asistencias: "🎯", ga: "⚡", minutos: "min", partidos: "PJ" };
  const field = FIELD[tab];
  const sorted = [...ranked].sort((a, b) => b[field] - a[field]).filter(p => p[field] > 0);
  const maxVal = Math.max(1, ...(sorted.length ? sorted.map(p => p[field]) : [1]));

  const PODIO = [
    { ring: "border-yellow-500/60", bg: "bg-yellow-900/15", num: "text-yellow-400", medal: "🥇" },
    { ring: "border-zinc-400/50", bg: "bg-zinc-700/20", num: "text-zinc-300", medal: "🥈" },
    { ring: "border-amber-700/60", bg: "bg-amber-900/15", num: "text-amber-500", medal: "🥉" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Clasificaciones{scope === "equipo" ? ` — ${team}` : " — Todo el club"}</h2>

      {/* Ámbito */}
      <div className="flex gap-2">
        <button onClick={() => setScope("equipo")}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm border transition-all ${scope === "equipo" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>👤 Mi equipo</button>
        <button onClick={() => setScope("global")}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm border transition-all ${scope === "global" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>🌍 Global</button>
      </div>

      {/* Estadística */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-all ${tab === t.id ? "bg-zinc-100 border-zinc-100 text-zinc-900 font-bold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>{t.label}</button>
        ))}
      </div>

      {sorted.length === 0 && <p className="text-zinc-500 text-sm">Sin datos registrados todavía{scope === "global" ? " en ningún equipo" : ""}.</p>}

      <div className="space-y-1.5">
        {sorted.map((p, i) => {
          const pod = i < 3 ? PODIO[i] : null;
          return (
            <div key={p.key} className={`rounded-xl border px-4 py-3 ${pod ? `${pod.bg} ${pod.ring}` : "bg-zinc-900 border-zinc-800"}`}>
              <div className="flex items-center gap-3">
                <span className={`w-8 text-center shrink-0 ${pod ? "text-xl" : "text-zinc-500 text-sm font-bold"}`}>{pod ? pod.medal : i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-white font-semibold text-sm block truncate">{p.name}</span>
                  {scope === "global" && <span className="text-zinc-500 text-xs">{p.equipo}</span>}
                  {tab === "ga" && <span className="text-zinc-500 text-xs">{p.goles} ⚽ + {p.asistencias} 🎯</span>}
                  {tab === "partidos" && <span className="text-zinc-500 text-xs">{p.titular} tit. · {p.suplente} sup.</span>}
                </div>
                <span className={`font-black text-lg shrink-0 ${pod ? pod.num : "text-zinc-300"}`}>{p[field]}<span className="text-xs font-normal text-zinc-500 ml-1">{UNIT[tab]}</span></span>
              </div>
              <div className="mt-1.5 ml-11 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pod ? "bg-red-500" : "bg-zinc-600"}`} style={{ width: `${(p[field] / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Gestión de temporadas (coordinadores only)
// ══════════════════════════════════════════════════════════════════════════════
'''

src = src[:i_start] + new_component + src[i_end:]

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [8/15] OK")
PYEOF

echo "═══ [9/15] Microciclo → pestaña de Entrenamientos ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

anchor_state = 'const [lastSaved, setLastSaved] = useState(null);'
assert anchor_state in src, "No encontrado: estado lastSaved"
src = src.replace(anchor_state, anchor_state + '\n  const [vista, setVista] = useState("sesiones");', 1)

old_header = '''      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-xl font-bold text-white">Entrenamientos — {team}</h2>
        <Btn onClick={() => open()}>+ Nuevo entrenamiento</Btn>
      </div>'''
assert old_header in src, "No encontrado: cabecera entrenamientos"
new_header = '''      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-xl font-bold text-white">Entrenamientos — {team}</h2>
        {vista === "sesiones" && <Btn onClick={() => open()}>+ Nuevo entrenamiento</Btn>}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setVista("sesiones")}
          className={`px-4 py-2 rounded-lg text-sm border transition-all ${vista === "sesiones" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>🏃 Sesiones</button>
        <button onClick={() => setVista("microciclo")}
          className={`px-4 py-2 rounded-lg text-sm border transition-all ${vista === "microciclo" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>📅 Microciclo</button>
      </div>

      {vista === "microciclo" && <MicrocicloSection team={team} data={data} onSave={onSave} />}

      {vista === "sesiones" && <>'''
src = src.replace(old_header, new_header, 1)

anchor_close = '      {/* Menú de acciones del entrenamiento */}'
assert anchor_close in src, "No encontrado: menú de acciones del entrenamiento"
src = src.replace(anchor_close, '      </>}\n\n' + anchor_close, 1)

old_section = '    { id: "microciclo", label: "Microciclo", icon: "📅" },\n'
assert old_section in src, "No encontrado: sección microciclo en el menú"
src = src.replace(old_section, '', 1)

old_render = '''            {activeSection === "microciclo" && (
              <MicrocicloSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} />
            )}
'''
assert old_render in src, "No encontrado: render de microciclo"
src = src.replace(old_render, '', 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [9/15] OK")
PYEOF

echo "═══ [10/15] Microciclo conectado con sesiones reales ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

start_marker = 'function MicrocicloSection({ team, data, onSave }) {'
end_marker = '// COMPONENTE: Barra de navegación inferior'
assert start_marker in src, "No encontrado: inicio MicrocicloSection"
assert end_marker in src, "No encontrado: BottomNav tras Microciclo"
i_start = src.index(start_marker)
i_end = src.index(end_marker)
assert i_start < i_end, "Orden inesperado"
i_end = src.rindex('// ══', i_start, i_end)

new_component = '''function MicrocicloSection({ team, data, onSave }) {
  const DIAS = ["Lunes","Martes","Miercoles","Jueves","Viernes","Sabado","Domingo"];
  const TIPOS = ["Descanso","Fisico","Tecnico","Tactico","Mixto","Partido","Recuperacion"];
  const INTENSIDADES = ["Baja","Media","Alta","Maxima"];
  const COLORES_TIPO = {
    "Descanso":"bg-zinc-800 text-zinc-400",
    "Fisico":"bg-orange-900 text-orange-300",
    "Tecnico":"bg-blue-900 text-blue-300",
    "Tactico":"bg-purple-900 text-purple-300",
    "Mixto":"bg-yellow-900 text-yellow-300",
    "Partido":"bg-red-900 text-red-300",
    "Recuperacion":"bg-green-900 text-green-300"
  };
  const COLORES_INT = { "Baja":"text-green-400","Media":"text-yellow-400","Alta":"text-orange-400","Maxima":"text-red-400" };

  const semanaActual = () => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (hoy.getDay() || 7) + 1);
    return lunes.toISOString().slice(0, 10);
  };

  const [semana, setSemana] = React.useState(semanaActual());
  const [plan, setPlan] = React.useState(
    (data?.microciclos || {})[semanaActual()] || DIAS.map(d => ({ dia: d, tipo: "Descanso", objetivo: "", carga: 5, intensidad: "Media", notas: "" }))
  );
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    const mc = (data?.microciclos || {})[semana];
    setPlan(mc || DIAS.map(d => ({ dia: d, tipo: "Descanso", objetivo: "", carga: 5, intensidad: "Media", notas: "" })));
  }, [semana, data]);

  const fechaISO = (i) => {
    const d = new Date(semana);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  };
  const fechaDia = (i) => new Date(fechaISO(i)).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  const trainingsDe = (i) => (data?.trainings || []).filter(t => t.fecha === fechaISO(i));
  const matchesDe = (i) => (data?.matches || []).filter(m => m.fecha === fechaISO(i));

  const updateDia = (i, field, val) => {
    setPlan(plan.map((d, idx) => idx === i ? { ...d, [field]: val } : d));
  };

  const dataConPlan = (base) => ({
    ...base,
    microciclos: { ...(base?.microciclos || {}), [semana]: plan },
  });

  const guardar = async () => {
    setGuardando(true);
    await onSave(dataConPlan(data));
    setGuardando(false);
  };

  const crearSesion = async (i) => {
    const dia = plan[i];
    const nuevo = {
      id: Date.now(),
      fecha: fechaISO(i),
      desc: [dia.tipo !== "Descanso" ? "[" + dia.tipo + (dia.intensidad ? " · " + dia.intensidad : "") + "]" : "", dia.objetivo].filter(Boolean).join(" "),
      duracion: 90,
    };
    const trainings = [...(data.trainings || []), nuevo].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    setGuardando(true);
    await onSave(dataConPlan({ ...data, trainings }));
    setGuardando(false);
  };

  const crearSemana = async () => {
    const nuevos = [];
    plan.forEach((dia, i) => {
      if (dia.tipo === "Descanso" || dia.tipo === "Partido") return;
      if (trainingsDe(i).length > 0) return;
      nuevos.push({
        id: Date.now() + i,
        fecha: fechaISO(i),
        desc: ["[" + dia.tipo + (dia.intensidad ? " · " + dia.intensidad : "") + "]", dia.objetivo].filter(Boolean).join(" "),
        duracion: 90,
      });
    });
    if (!nuevos.length) { alert("Todos los días planificados ya tienen sesión creada."); return; }
    if (!window.confirm("¿Crear " + nuevos.length + " entrenamiento(s) a partir del plan?")) return;
    const trainings = [...(data.trainings || []), ...nuevos].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    setGuardando(true);
    await onSave(dataConPlan({ ...data, trainings }));
    setGuardando(false);
  };

  const semanaAnterior = () => { const d = new Date(semana); d.setDate(d.getDate() - 7); setSemana(d.toISOString().slice(0,10)); };
  const semanaSiguiente = () => { const d = new Date(semana); d.setDate(d.getDate() + 7); setSemana(d.toISOString().slice(0,10)); };

  const cargaTotal = plan.reduce((s, d) => d.tipo !== "Descanso" ? s + (d.carga || 0) : s, 0);
  const sesionesPlan = plan.filter(d => d.tipo !== "Descanso").length;
  const sesionesCreadas = plan.reduce((s, d, i) => s + trainingsDe(i).length, 0);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={semanaAnterior} className="text-zinc-400 hover:text-white px-3 py-1.5 bg-zinc-800 rounded-lg">‹</button>
          <span className="text-zinc-300 text-sm font-medium">Semana {new Date(semana).toLocaleDateString("es-ES", {day:"numeric",month:"short"})}</span>
          <button onClick={semanaSiguiente} className="text-zinc-400 hover:text-white px-3 py-1.5 bg-zinc-800 rounded-lg">›</button>
        </div>
        <Btn small variant="secondary" onClick={crearSemana} disabled={guardando}>⚡ Crear sesiones de la semana</Btn>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-center">
          <div className="text-white font-bold text-lg">{sesionesCreadas}/{sesionesPlan}</div>
          <div className="text-zinc-500 text-xs">Creadas / plan</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-center">
          <div className="text-white font-bold text-lg">{cargaTotal}</div>
          <div className="text-zinc-500 text-xs">Carga total</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-center">
          <div className="text-white font-bold text-lg">{sesionesPlan > 0 ? (cargaTotal/sesionesPlan).toFixed(1) : 0}</div>
          <div className="text-zinc-500 text-xs">Media/sesión</div>
        </div>
      </div>

      <div className="space-y-2">
        {plan.map((dia, i) => {
          const trainsReales = trainingsDe(i);
          const matchesReales = matchesDe(i);
          return (
            <div key={i} className={`border rounded-xl p-3 ${dia.tipo === "Partido" || matchesReales.length ? "border-red-800 bg-red-900/10" : "border-zinc-800 bg-zinc-900"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-20 flex-shrink-0">
                  <div className="text-white text-sm font-semibold">{dia.dia}</div>
                  <div className="text-zinc-500 text-xs">{fechaDia(i)}</div>
                </div>
                <select value={dia.tipo} onChange={e => updateDia(i, "tipo", e.target.value)}
                  className={`text-xs rounded-lg px-2 py-1.5 border-0 font-medium cursor-pointer ${COLORES_TIPO[dia.tipo] || "bg-zinc-800 text-zinc-300"}`}>
                  {TIPOS.map(t => <option key={t}>{t}</option>)}
                </select>
                {dia.tipo !== "Descanso" && (
                  <>
                    <input value={dia.objetivo} onChange={e => updateDia(i, "objetivo", e.target.value)}
                      placeholder="Objetivo del día..."
                      className="flex-1 min-w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-100 text-xs focus:outline-none" />
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 text-xs">Carga:</span>
                      <input type="range" min="1" max="10" value={dia.carga}
                        onChange={e => updateDia(i, "carga", parseInt(e.target.value))}
                        className="w-16 accent-red-600" />
                      <span className="text-white text-xs font-bold w-4">{dia.carga}</span>
                    </div>
                    <select value={dia.intensidad} onChange={e => updateDia(i, "intensidad", e.target.value)}
                      className={`text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 font-medium ${COLORES_INT[dia.intensidad] || ""}`}>
                      {INTENSIDADES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {matchesReales.map(m => (
                  <span key={m.id} className="text-xs px-2 py-1 rounded-full bg-red-900/40 border border-red-700 text-red-300">⚽ vs {m.rival}{m.resultado ? " · " + m.resultado : ""}</span>
                ))}
                {trainsReales.map(t => (
                  <span key={t.id} className="text-xs px-2 py-1 rounded-full bg-green-900/30 border border-green-700/60 text-green-300">✓ Sesión creada · {t.duracion || 90} min · {(t.tasks||[]).length} tareas</span>
                ))}
                {dia.tipo !== "Descanso" && dia.tipo !== "Partido" && trainsReales.length === 0 && (
                  <button onClick={() => crearSesion(i)} disabled={guardando}
                    className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white transition-all">➕ Crear entrenamiento</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Btn onClick={guardar} disabled={guardando} className="w-full justify-center">
        {guardando ? "Guardando..." : "💾 Guardar microciclo"}
      </Btn>
    </div>
  );
}

'''

src = src[:i_start] + new_component + src[i_end:]

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [10/15] OK")
PYEOF

echo "═══ [11/15] Tácticas → pestaña de Entrenamientos ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

anchor_tab = '''        <button onClick={() => setVista("microciclo")}
          className={`px-4 py-2 rounded-lg text-sm border transition-all ${vista === "microciclo" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>📅 Microciclo</button>'''
assert anchor_tab in src, "No encontrado: pestaña Microciclo"
src = src.replace(anchor_tab, anchor_tab + '''
        <button onClick={() => setVista("tacticas")}
          className={`px-4 py-2 rounded-lg text-sm border transition-all ${vista === "tacticas" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>🎬 Tácticas</button>''', 1)

anchor_render = '      {vista === "microciclo" && <MicrocicloSection team={team} data={data} onSave={onSave} />}'
assert anchor_render in src, "No encontrado: render microciclo en pestaña"
src = src.replace(anchor_render, anchor_render + '''

      {vista === "tacticas" && <TacticasSection team={team} data={data} onSave={onSave} />}''', 1)

old_section = '    { id: "tacticas", label: "Tácticas", icon: "🎬" },\n'
assert old_section in src, "No encontrado: sección tácticas en el menú"
src = src.replace(old_section, '', 1)

old_render = '''            {activeSection === "tacticas" && (
              <TacticasSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} />
            )}
'''
assert old_render in src, "No encontrado: render independiente de tácticas"
src = src.replace(old_render, '', 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [11/15] OK")
PYEOF

echo "═══ [12/15] Avisos → pestaña de Ajustes (coordinador) ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

anchor_state = 'const [activeSection, setActiveSection] = useState("plantilla");'
assert anchor_state in src, "No encontrado: estado activeSection"
src = src.replace(anchor_state, anchor_state + '\n  const [ajustesVista, setAjustesVista] = useState("club");', 1)

old_section = '{ id: "avisos", label: "Avisos", icon: "🔔" },'
assert old_section in src, "No encontrado: sección avisos en el menú"
src = src.replace(old_section, '...(!isCoord ? [{ id: "avisos", label: "Avisos", icon: "🔔" }] : []),', 1)

old_gestion = '''              <div>
                <GestionClubSection clubActual={clubActual} onEquiposChange={(eqs) => setEquiposDinamicos(eqs.map(e => e.nombre))} />
                <GestionSection db={db} onArchive={archiveSeason} onRestore={restoreSeason} passwords={{...TEAM_PASSWORDS, ...teamPasswords}} onSavePasswords={savePasswords} />
              </div>'''
assert old_gestion in src, "No encontrado: bloque de Ajustes"
new_gestion = '''              <div className="space-y-4">
                <div className="flex gap-2">
                  <button onClick={() => setAjustesVista("club")}
                    className={`px-4 py-2 rounded-lg text-sm border transition-all ${ajustesVista === "club" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>🏟️ Club</button>
                  <button onClick={() => setAjustesVista("avisos")}
                    className={`px-4 py-2 rounded-lg text-sm border transition-all ${ajustesVista === "avisos" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>🔔 Avisos</button>
                </div>
                {ajustesVista === "club" && (
                  <div>
                    <GestionClubSection clubActual={clubActual} onEquiposChange={(eqs) => setEquiposDinamicos(eqs.map(e => e.nombre))} />
                    <GestionSection db={db} onArchive={archiveSeason} onRestore={restoreSeason} passwords={{...TEAM_PASSWORDS, ...teamPasswords}} onSavePasswords={savePasswords} />
                  </div>
                )}
                {ajustesVista === "avisos" && (
                  <AvisosSection isCoord={isCoord} teamAccess={teamAccess} teams={teamsToUse} currentUser={currentUser} clubId={clubActual?.id || "magdalena"} />
                )}
              </div>'''
src = src.replace(old_gestion, new_gestion, 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [12/15] OK")
PYEOF

echo "═══ [13/15] Mejores Rivales → pestaña de Clasificaciones ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

old_render = '<ClasificacionSection team={activeTeam} data={teamData} db={db} />'
assert old_render in src, "No encontrado: render de ClasificacionSection"
src = src.replace(old_render, '<ClasificacionSection team={activeTeam} data={teamData} db={db} isCoord={isCoord} />', 1)

old_sig = 'function ClasificacionSection({ team, data, db }) {'
assert old_sig in src, "No encontrado: firma ClasificacionSection"
src = src.replace(old_sig, 'function ClasificacionSection({ team, data, db, isCoord }) {', 1)

anchor_scope = '''        <button onClick={() => setScope("global")}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm border transition-all ${scope === "global" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>🌍 Global</button>'''
assert anchor_scope in src, "No encontrado: botón Global"
src = src.replace(anchor_scope, anchor_scope + '''
        {isCoord && <button onClick={() => setScope("rivales")}
          className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm border transition-all ${scope === "rivales" ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>⭐ Rivales</button>}''', 1)

anchor_pills = '''      {/* Estadística */}
      <div className="flex flex-wrap gap-1.5">'''
assert anchor_pills in src, "No encontrado: pastillas de estadística"
src = src.replace(anchor_pills, '''      {scope === "rivales" && <MejoresRivalesSection db={db} embed />}

      {/* Estadística */}
      {scope !== "rivales" && <div className="flex flex-wrap gap-1.5">''', 1)

anchor_pills_end = '''            className={`px-3 py-1.5 rounded-full text-xs border transition-all ${tab === t.id ? "bg-zinc-100 border-zinc-100 text-zinc-900 font-bold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>{t.label}</button>
        ))}
      </div>'''
assert anchor_pills_end in src, "No encontrado: cierre de pastillas"
src = src.replace(anchor_pills_end, anchor_pills_end.replace('</div>', '</div>}'), 1)

old_empty = '      {sorted.length === 0 && <p className="text-zinc-500 text-sm">Sin datos registrados todavía{scope === "global" ? " en ningún equipo" : ""}.</p>}'
assert old_empty in src, "No encontrado: mensaje sin datos"
src = src.replace(old_empty, '      {scope !== "rivales" && sorted.length === 0 && <p className="text-zinc-500 text-sm">Sin datos registrados todavía{scope === "global" ? " en ningún equipo" : ""}.</p>}', 1)

old_list = '''      <div className="space-y-1.5">
        {sorted.map((p, i) => {'''
assert old_list in src, "No encontrado: lista de ranking"
src = src.replace(old_list, '''      {scope !== "rivales" && <div className="space-y-1.5">
        {sorted.map((p, i) => {''', 1)

old_list_end = '''          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Gestión de temporadas (coordinadores only)'''
assert old_list_end in src, "No encontrado: cierre de lista de ranking"
src = src.replace(old_list_end, '''          );
        })}
      </div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION: Gestión de temporadas (coordinadores only)''', 1)

old_riv_sig = 'function MejoresRivalesSection({ db }) {'
assert old_riv_sig in src, "No encontrado: firma MejoresRivalesSection"
src = src.replace(old_riv_sig, 'function MejoresRivalesSection({ db, embed }) {', 1)

old_riv_title = '''      <h2 className="text-xl font-bold text-white">⭐ Mejores Jugadores Rivales</h2>
      <p className="text-zinc-400 text-sm">Jugadores rivales destacados registrados por los entrenadores en cada partido.</p>'''
assert old_riv_title in src, "No encontrado: título de Mejores Rivales"
src = src.replace(old_riv_title, '''      {!embed && <h2 className="text-xl font-bold text-white">⭐ Mejores Jugadores Rivales</h2>}
      <p className="text-zinc-400 text-sm">Jugadores rivales destacados registrados por los entrenadores en cada partido.</p>''', 1)

old_section = '    ...(isCoord ? [{ id: "mejoresrivales", label: "Mejores Rivales", icon: "⭐" }] : []),\n'
assert old_section in src, "No encontrado: sección mejoresrivales en el menú"
src = src.replace(old_section, '', 1)

old_render2 = '''            {activeSection === "mejoresrivales" && isCoord && (
        <MejoresRivalesSection db={db} />
      )}
'''
assert old_render2 in src, "No encontrado: render independiente de mejores rivales"
src = src.replace(old_render2, '', 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [13/15] OK")
PYEOF

echo "═══ [14/15] Banco → pestaña de Plantilla ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

old_render = '<PlantillaSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} seasons={seasons} db={db} />'
assert old_render in src, "No encontrado: render de PlantillaSection"
src = src.replace(old_render, '<PlantillaSection team={activeTeam} data={teamData} onSave={d => updateTeamData(activeTeam, d)} isCoord={isCoord} seasons={seasons} db={db} clubActual={clubActual} />', 1)

old_sig = 'function PlantillaSection({ team, data, onSave, isCoord, seasons, db }) {'
assert old_sig in src, "No encontrado: firma PlantillaSection"
src = src.replace(old_sig, 'function PlantillaSection({ team, data, onSave, isCoord, seasons, db, clubActual }) {', 1)

old_header_btn = '''        {tab === "oficial"
          ? <Btn onClick={() => open()}>+ Añadir jugador</Btn>
          : <Btn onClick={() => { setTab("oficial"); setTimeout(() => { window.dispatchEvent(new CustomEvent("openProbandoForm")); }, 50); }}>+ Añadir jugador en prueba</Btn>
        }'''
assert old_header_btn in src, "No encontrado: botón de cabecera de plantilla"
src = src.replace(old_header_btn, '''        {tab === "oficial"
          ? <Btn onClick={() => open()}>+ Añadir jugador</Btn>
          : tab === "probando"
          ? <Btn onClick={() => { setTab("oficial"); setTimeout(() => { window.dispatchEvent(new CustomEvent("openProbandoForm")); }, 50); }}>+ Añadir jugador en prueba</Btn>
          : null
        }''', 1)

anchor_tab = '''        >📋 Convocatoria</button>'''
assert anchor_tab in src, "No encontrado: pestaña Convocatoria"
src = src.replace(anchor_tab, anchor_tab + '''
        {isCoord && <button
          onClick={() => { setTab("banco"); setShowForm(false); }}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${tab === "banco" ? "border-green-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >🗂️ Banco</button>}''', 1)

anchor_content = '{tab === "convocatoria" && <ConvocatoriaContent team={team} data={data} onSave={onSave} isCoord={isCoord} db={db || {}} />}'
assert anchor_content in src, "No encontrado: render convocatoria"
src = src.replace(anchor_content, anchor_content + '''
      {tab === "banco" && isCoord && <BancoJugadoresSection clubActual={clubActual} />}''', 1)

old_section = '    ...(isCoord ? [{ id: "banco", label: "Banco de Jugadores", icon: "🗂️" }] : []),\n'
assert old_section in src, "No encontrado: sección banco en el menú"
src = src.replace(old_section, '', 1)

old_render2 = '''      {activeSection === "banco" && isCoord && (
              <BancoJugadoresSection clubActual={clubActual} />
            )}
'''
assert old_render2 in src, "No encontrado: render independiente del banco"
src = src.replace(old_render2, '', 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [14/15] OK")
PYEOF

echo "═══ [15/15] Tácticas: pantalla completa en móvil ═══"
python3 << 'PYEOF'
with open('src/App.jsx', 'r') as f:
    src = f.read()

old_open = '''  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => {
          // Normalizar quitando campos internos (tipo) antes de comparar'''
assert old_open in src, "No encontrado: apertura de TacticaEditor"
new_open = '''  return (
    <div className="fixed inset-0 z-[70] bg-zinc-950 overflow-auto p-4 pb-10 space-y-4 md:static md:z-auto md:bg-transparent md:p-0 md:overflow-visible">
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2.5 bg-zinc-950/95 border-b border-zinc-800 flex items-center gap-3 flex-wrap md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-0">
        <button onClick={() => {
          // Normalizar quitando campos internos (tipo) antes de comparar'''
src = src.replace(old_open, new_open, 1)

old_touch = 'touchAction: dragging ? "none" : "pan-y",'
assert old_touch in src, "No encontrado: touchAction del canvas"
src = src.replace(old_touch, 'touchAction: "none",', 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("✅ [15/15] OK")
PYEOF

echo ""
echo "═══ BUILD + SUBIR ═══"
npm run build
git add -A
git commit -m "Rediseño completo: tarjetas compactas, ficha jugador, asistencia con gráficos, microciclo conectado, reorganización de pestañas, tácticas fullscreen"
git push

echo ""
echo "🎉 TODO SUBIDO. Vercel desplegará en 1-2 minutos."
