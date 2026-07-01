
import { useState, useEffect } from "react";
import { internacionalDb, loginInternacional, registrarInternacional, loadInternacionalData, saveInternacionalDoc, deleteInternacionalDoc } from "./internacionalFirebase";
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc } from "firebase/firestore";

// ── Helpers UI ────────────────────────────────────────────────────────────────
function IBadge({ color, children }) {
  const COLORS = { green:"bg-green-900 text-green-300", red:"bg-red-900 text-red-300", blue:"bg-blue-900 text-blue-300", orange:"bg-orange-900 text-orange-300", zinc:"bg-zinc-800 text-zinc-400", yellow:"bg-yellow-900 text-yellow-300" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLORS[color]||COLORS.zinc}`}>{children}</span>;
}
function IBtn({ onClick, children, variant="primary", disabled, small, className="" }) {
  const BASE = "rounded-lg font-medium transition-all focus:outline-none ";
  const SIZE = small ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm";
  const VAR = { primary:"bg-orange-600 hover:bg-orange-500 text-white", secondary:"bg-zinc-800 hover:bg-zinc-700 text-zinc-300", danger:"bg-red-900 hover:bg-red-800 text-red-300" };
  return <button onClick={onClick} disabled={disabled} className={`${BASE}${SIZE} ${VAR[variant]||VAR.primary} ${disabled?"opacity-50 cursor-not-allowed":""} ${className}`}>{children}</button>;
}
function ICard({ children, className="" }) {
  return <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 ${className}`}>{children}</div>;
}
function IInput({ label, value, onChange, type="text", placeholder="" }) {
  return (
    <div className="mb-3">
      {label && <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-orange-600" />
    </div>
  );
}

// ── Secciones ────────────────────────────────────────────────────────────────

function IDashboard({ currentUser }) {
  const [stats, setStats] = useState({ jugadores: 0, sesiones: 0, partidos: 0, noticias: 0 });
  useEffect(() => {
    Promise.all([
      loadInternacionalData("jugadores"),
      loadInternacionalData("sesiones"),
      loadInternacionalData("partidos"),
      loadInternacionalData("noticias")
    ]).then(([j, s, p, n]) => setStats({ jugadores: j.length, sesiones: s.length, partidos: p.length, noticias: n.length }));
  }, []);
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-white mb-6">Dashboard</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[["👥","Jugadores",stats.jugadores,"blue"],["🏃","Sesiones",stats.sesiones,"orange"],["🏀","Partidos",stats.partidos,"green"],["📰","Noticias",stats.noticias,"zinc"]].map(([icon,label,val,color]) => (
          <ICard key={label} className="text-center">
            <div className="text-3xl mb-1">{icon}</div>
            <div className="text-2xl font-bold text-white">{val}</div>
            <div className="text-zinc-500 text-xs">{label}</div>
          </ICard>
        ))}
      </div>
      <ICard>
        <p className="text-zinc-400 text-sm">Bienvenido, <span className="text-white font-semibold">{currentUser?.nombre}</span>.</p>
        <p className="text-zinc-500 text-xs mt-1">Rol: <span className="text-orange-400 capitalize">{currentUser?.rolActual}</span></p>
      </ICard>
    </div>
  );
}

function IJugadores({ isAdmin }) {
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre:"", apellidos:"", fechaNac:"", nacionalidad:"", pasaporte:"", posicion:"", equipo:"", email:"", telefono:"", notas:"" });
  const [editId, setEditId] = useState(null);
  const POSICIONES = ["Base","Escolta","Alero","Ala-pívot","Pívot"];
  useEffect(() => { loadInternacionalData("jugadores").then(j => { setJugadores(j); setLoading(false); }); }, []);
  const guardar = async () => {
    if (!form.nombre.trim()) return;
    const id = editId || Date.now().toString();
    await saveInternacionalDoc("jugadores", id, { ...form, id, actualizadoEn: new Date().toISOString() });
    setJugadores(prev => editId ? prev.map(j => j.id === id ? { ...form, id } : j) : [...prev, { ...form, id }]);
    setShowForm(false); setEditId(null); setForm({ nombre:"", apellidos:"", fechaNac:"", nacionalidad:"", pasaporte:"", posicion:"", equipo:"", email:"", telefono:"", notas:"" });
  };
  const eliminar = async (id) => {
    if (!window.confirm("Eliminar jugador?")) return;
    await deleteInternacionalDoc("jugadores", id);
    setJugadores(prev => prev.filter(j => j.id !== id));
  };
  const filtrados = jugadores.filter(j => !search || (j.nombre+" "+j.apellidos).toLowerCase().includes(search.toLowerCase()));
  if (loading) return <div className="p-6 text-zinc-500">Cargando...</div>;
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Jugadores ({jugadores.length})</h2>
        {isAdmin && <IBtn onClick={() => { setShowForm(true); setEditId(null); }}>+ Añadir</IBtn>}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar jugador..."
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none mb-4" />
      {showForm && (
        <ICard className="mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">{editId ? "Editar" : "Nuevo"} jugador</h3>
          <div className="grid grid-cols-2 gap-2">
            <IInput label="Nombre" value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} />
            <IInput label="Apellidos" value={form.apellidos} onChange={e => setForm({...form, apellidos:e.target.value})} />
            <IInput label="Fecha nacimiento" type="date" value={form.fechaNac} onChange={e => setForm({...form, fechaNac:e.target.value})} />
            <IInput label="Nacionalidad" value={form.nacionalidad} onChange={e => setForm({...form, nacionalidad:e.target.value})} />
            <IInput label="Pasaporte/DNI" value={form.pasaporte} onChange={e => setForm({...form, pasaporte:e.target.value})} />
            <IInput label="Email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
            <IInput label="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono:e.target.value})} />
            <div className="mb-3">
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Posición</label>
              <select value={form.posicion} onChange={e => setForm({...form, posicion:e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none">
                <option value="">Sin posición</option>
                {POSICIONES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <IInput label="Notas" value={form.notas} onChange={e => setForm({...form, notas:e.target.value})} placeholder="Observaciones..." />
          <div className="flex gap-2 mt-2">
            <IBtn onClick={guardar}>Guardar</IBtn>
            <IBtn variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancelar</IBtn>
          </div>
        </ICard>
      )}
      <ICard>
        {filtrados.length === 0 && <p className="text-zinc-500 text-sm">No hay jugadores.</p>}
        {filtrados.map(j => (
          <div key={j.id} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
            <div className="w-8 h-8 rounded-full bg-orange-900 flex items-center justify-center text-orange-300 text-sm font-bold flex-shrink-0">
              {(j.nombre||"?")[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-white text-sm font-semibold">{j.nombre} {j.apellidos}</div>
              <div className="text-zinc-500 text-xs flex gap-2">
                {j.posicion && <span>{j.posicion}</span>}
                {j.nacionalidad && <span>🌍 {j.nacionalidad}</span>}
                {j.fechaNac && <span>{new Date().getFullYear() - new Date(j.fechaNac).getFullYear()} años</span>}
              </div>
            </div>
            {isAdmin && <>
              <IBtn small onClick={() => { setForm({ nombre:j.nombre||"", apellidos:j.apellidos||"", fechaNac:j.fechaNac||"", nacionalidad:j.nacionalidad||"", pasaporte:j.pasaporte||"", posicion:j.posicion||"", equipo:j.equipo||"", email:j.email||"", telefono:j.telefono||"", notas:j.notas||"" }); setEditId(j.id); setShowForm(true); }}>✏️</IBtn>
              <IBtn small variant="danger" onClick={() => eliminar(j.id)}>🗑</IBtn>
            </>}
          </div>
        ))}
      </ICard>
    </div>
  );
}

function INoticias({ isAdmin }) {
  const [noticias, setNoticias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo:"", contenido:"", categoria:"Club" });
  const CATEGORIAS = ["Club","Resultados","Captación","Eventos","Otros"];
  useEffect(() => { loadInternacionalData("noticias").then(n => { setNoticias(n.sort((a,b) => (b.fecha||"").localeCompare(a.fecha||""))); setLoading(false); }); }, []);
  const guardar = async () => {
    if (!form.titulo.trim()) return;
    const id = Date.now().toString();
    const nueva = { ...form, id, fecha: new Date().toISOString() };
    await saveInternacionalDoc("noticias", id, nueva);
    setNoticias(prev => [nueva, ...prev]);
    setShowForm(false); setForm({ titulo:"", contenido:"", categoria:"Club" });
  };
  if (loading) return <div className="p-6 text-zinc-500">Cargando...</div>;
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Noticias</h2>
        {isAdmin && <IBtn onClick={() => setShowForm(!showForm)}>+ Nueva noticia</IBtn>}
      </div>
      {showForm && (
        <ICard className="mb-4">
          <IInput label="Título" value={form.titulo} onChange={e => setForm({...form, titulo:e.target.value})} />
          <div className="mb-3">
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Categoría</label>
            <select value={form.categoria} onChange={e => setForm({...form, categoria:e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm">
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Contenido</label>
            <textarea value={form.contenido} onChange={e => setForm({...form, contenido:e.target.value})} rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <IBtn onClick={guardar}>Publicar</IBtn>
            <IBtn variant="secondary" onClick={() => setShowForm(false)}>Cancelar</IBtn>
          </div>
        </ICard>
      )}
      <div className="space-y-3">
        {noticias.length === 0 && <p className="text-zinc-500 text-sm">No hay noticias.</p>}
        {noticias.map(n => (
          <ICard key={n.id}>
            <div className="text-xs font-semibold text-orange-400 mb-1">{n.categoria}</div>
            <h3 className="text-white font-semibold">{n.titulo}</h3>
            {n.contenido && <p className="text-zinc-400 text-sm mt-1">{n.contenido}</p>}
            <div className="text-zinc-600 text-xs mt-2">{n.fecha ? new Date(n.fecha).toLocaleDateString("es-ES") : ""}</div>
          </ICard>
        ))}
      </div>
    </div>
  );
}

function ICalendario({ isAdmin }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo:"", fecha:"", hora:"", tipo:"Entrenamiento", lugar:"", descripcion:"" });
  const TIPOS = ["Entrenamiento","Partido","Evento","Viaje","Otro"];
  const TIPO_COLOR = { "Entrenamiento":"orange","Partido":"green","Evento":"blue","Viaje":"zinc","Otro":"zinc" };
  useEffect(() => { loadInternacionalData("calendario").then(e => { setEventos(e.sort((a,b) => (a.fecha||"").localeCompare(b.fecha||""))); setLoading(false); }); }, []);
  const guardar = async () => {
    if (!form.titulo.trim() || !form.fecha) return;
    const id = Date.now().toString();
    const nuevo = { ...form, id };
    await saveInternacionalDoc("calendario", id, nuevo);
    setEventos(prev => [...prev, nuevo].sort((a,b) => (a.fecha||"").localeCompare(b.fecha||"")));
    setShowForm(false); setForm({ titulo:"", fecha:"", hora:"", tipo:"Entrenamiento", lugar:"", descripcion:"" });
  };
  const eliminar = async (id) => { await deleteInternacionalDoc("calendario", id); setEventos(prev => prev.filter(e => e.id !== id)); };
  const futuros = eventos.filter(e => e.fecha >= new Date().toISOString().slice(0,10));
  const pasados = eventos.filter(e => e.fecha < new Date().toISOString().slice(0,10));
  if (loading) return <div className="p-6 text-zinc-500">Cargando...</div>;
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Calendario</h2>
        {isAdmin && <IBtn onClick={() => setShowForm(!showForm)}>+ Evento</IBtn>}
      </div>
      {showForm && (
        <ICard className="mb-4">
          <div className="grid grid-cols-2 gap-2">
            <IInput label="Título" value={form.titulo} onChange={e => setForm({...form, titulo:e.target.value})} />
            <IInput label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha:e.target.value})} />
            <IInput label="Hora" type="time" value={form.hora} onChange={e => setForm({...form, hora:e.target.value})} />
            <IInput label="Lugar" value={form.lugar} onChange={e => setForm({...form, lugar:e.target.value})} />
            <div className="mb-3">
              <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({...form, tipo:e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm">
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <IInput label="Descripción" value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} />
          <div className="flex gap-2">
            <IBtn onClick={guardar}>Guardar</IBtn>
            <IBtn variant="secondary" onClick={() => setShowForm(false)}>Cancelar</IBtn>
          </div>
        </ICard>
      )}
      <h3 className="text-sm font-semibold text-zinc-400 mb-2">Próximos eventos</h3>
      <div className="space-y-2 mb-4">
        {futuros.length === 0 && <p className="text-zinc-500 text-sm">No hay eventos próximos.</p>}
        {futuros.map(e => (
          <ICard key={e.id} className="flex items-center gap-3">
            <div className="text-center flex-shrink-0 w-12">
              <div className="text-white font-bold text-lg">{new Date(e.fecha+"T12:00").getDate()}</div>
              <div className="text-zinc-500 text-xs">{new Date(e.fecha+"T12:00").toLocaleDateString("es-ES",{month:"short"})}</div>
            </div>
            <div className="flex-1">
              <div className="text-white text-sm font-semibold">{e.titulo}</div>
              <div className="text-zinc-500 text-xs">{e.hora && e.hora+" · "}{e.lugar}</div>
            </div>
            <IBadge color={TIPO_COLOR[e.tipo]||"zinc"}>{e.tipo}</IBadge>
            {isAdmin && <IBtn small variant="danger" onClick={() => eliminar(e.id)}>🗑</IBtn>}
          </ICard>
        ))}
      </div>
      {pasados.length > 0 && <>
        <h3 className="text-sm font-semibold text-zinc-400 mb-2">Pasados</h3>
        <div className="space-y-2 opacity-50">
          {pasados.slice(-5).reverse().map(e => (
            <ICard key={e.id} className="flex items-center gap-3 py-2">
              <div className="text-zinc-400 text-sm flex-1">{e.fecha} · {e.titulo}</div>
              <IBadge color="zinc">{e.tipo}</IBadge>
              {isAdmin && <IBtn small variant="danger" onClick={() => eliminar(e.id)}>🗑</IBtn>}
            </ICard>
          ))}
        </div>
      </>}
    </div>
  );
}

function IUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre:"", email:"", password:"", rol:"entrenador" });
  const [msg, setMsg] = useState("");
  useEffect(() => { loadInternacionalData("internacional_usuarios").then(u => { setUsuarios(u); setLoading(false); }); }, []);
  const crear = async () => {
    if (!form.nombre || !form.email || !form.password) { setMsg("Rellena todos los campos."); return; }
    const res = await registrarInternacional(form);
    if (res.ok) { setUsuarios(prev => [...prev, res.user]); setForm({ nombre:"", email:"", password:"", rol:"entrenador" }); setMsg("Usuario creado."); }
    else { setMsg(res.error); }
    setTimeout(() => setMsg(""), 3000);
  };
  if (loading) return <div className="p-6 text-zinc-500">Cargando...</div>;
  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-xl font-bold text-white mb-4">Usuarios</h2>
      <ICard className="mb-4">
        <h3 className="text-sm font-semibold text-white mb-3">Crear usuario</h3>
        <div className="grid grid-cols-2 gap-2">
          <IInput label="Nombre" value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} />
          <IInput label="Email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
          <IInput label="Contraseña" type="password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} />
          <div className="mb-3">
            <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">Rol</label>
            <select value={form.rol} onChange={e => setForm({...form, rol:e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm">
              {["admin","entrenador","jugador"].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        {msg && <p className="text-xs text-green-400 mb-2">{msg}</p>}
        <IBtn onClick={crear}>Crear usuario</IBtn>
      </ICard>
      <ICard>
        {usuarios.map(u => (
          <div key={u.email} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white text-xs font-bold">{(u.nombre||"?")[0].toUpperCase()}</div>
            <div className="flex-1">
              <div className="text-white text-sm font-semibold">{u.nombre}</div>
              <div className="text-zinc-500 text-xs">{u.email}</div>
            </div>
            <IBadge color={u.rol==="admin"?"red":u.rol==="entrenador"?"blue":"zinc"}>{u.rol}</IBadge>
          </div>
        ))}
      </ICard>
    </div>
  );
}

// ── App principal Internacional ───────────────────────────────────────────────
export default function InternacionalApp({ currentUser, onVolver, onSalir }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const isAdmin = currentUser?.rolActual === "coordinador" || currentUser?.rolActual === "admin";

  const SECCIONES = [
    { id:"dashboard", label:"🏠 Dashboard" },
    { id:"jugadores", label:"👥 Jugadores" },
    { id:"noticias", label:"📰 Noticias" },
    { id:"calendario", label:"📅 Calendario" },
    ...(isAdmin ? [{ id:"usuarios", label:"👤 Usuarios" }] : []),
  ];

  return (
    <div className="min-h-screen bg-zinc-950 flex text-zinc-100" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Sidebar */}
      <div className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-orange-700">🌍</div>
            <div>
              <div className="font-black text-white text-sm">Amics International</div>
              <div className="text-xs text-zinc-400">{currentUser?.nombre}</div>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300 capitalize">{currentUser?.rolActual}</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {SECCIONES.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${activeSection===s.id ? "bg-orange-900/40 text-orange-300 font-semibold" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-800 space-y-1">
          <button onClick={onVolver} className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-white transition-all">🏠 Inicio</button>
          <button onClick={onSalir} className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-red-400 transition-all">Salir</button>
        </div>
      </div>
      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === "dashboard" && <IDashboard currentUser={currentUser} />}
        {activeSection === "jugadores" && <IJugadores isAdmin={isAdmin} />}
        {activeSection === "noticias" && <INoticias isAdmin={isAdmin} />}
        {activeSection === "calendario" && <ICalendario isAdmin={isAdmin} />}
        {activeSection === "usuarios" && isAdmin && <IUsuarios />}
      </div>
    </div>
  );
}
