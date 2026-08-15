import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, getDocs, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAnzUJZe1NQYbjWHeq1jqV2O118CDR0dBQ",
  authDomain: "cd-la-magdalena.firebaseapp.com",
  projectId: "cd-la-magdalena",
  storageBucket: "cd-la-magdalena.firebasestorage.app",
  messagingSenderId: "15940427840",
  appId: "1:15940427840:web:4e76b3c595b7394582ffa5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

function cleanLoaded(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.filter(i => i != null).map(cleanLoaded);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'pizarra' && Array.isArray(v)) {
      result[k] = v.filter(i => i != null);
    } else {
      result[k] = cleanLoaded(v);
    }
  }
  return result;
}

export async function loadData() {
  try {
    const snap = await getDoc(doc(db, "cdmagdalena", "main"));
    if (!snap.exists()) return null;
    const raw = snap.data().json;
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed ? cleanLoaded(parsed) : null;
  } catch(e) { console.error("Load error", e); return null; }
}

export async function saveData(data) {
  try {
    let json;
    try {
      json = JSON.stringify(data);
    } catch(jsonErr) {
      console.error("JSON.stringify failed:", jsonErr.message);
      for (const team of Object.keys(data)) {
        try { JSON.stringify(data[team]); }
        catch(e2) { console.error("Problem in team:", team, e2.message); }
      }
      return;
    }
    await setDoc(doc(db, "cdmagdalena", "main"), { json });
    console.log("Saved OK, size:", json.length);
  } catch(e) { console.error("Save error", e); }
}

export async function loadSeasons() {
  try {
    const snap = await getDoc(doc(db, "cdmagdalena", "seasons"));
    if (!snap.exists()) return [];
    const raw = snap.data().json;
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

export function subscribeToData(callback) {
  try {
    return onSnapshot(doc(db, "cdmagdalena", "main"), (snap) => {
      if (!snap.exists()) return;
      try {
        const raw = snap.data().json;
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed) callback(cleanLoaded(parsed));
      } catch(e) { console.error("Snapshot parse error", e); }
    });
  } catch(e) { console.error("Subscribe error", e); return () => {}; }
}

export async function saveSeasons(seasons) {
  try {
    const json = JSON.stringify(seasons);
    await setDoc(doc(db, "cdmagdalena", "seasons"), { json });
  } catch(e) { console.error(e); }
}

export async function loadFichas(team) {
  try {
    const snap = await getDoc(doc(db, "cdmagdalena_fichas", team));
    if (!snap.exists()) return {};
    return snap.data() || {};
  } catch(e) { console.error("loadFichas error", e); return {}; }
}

export async function saveFicha(team, playerId, base64, nombre) {
  try {
    const current = await loadFichas(team);
    current[String(playerId)] = { base64, nombre };
    await setDoc(doc(db, "cdmagdalena_fichas", team), current);
    return { ok: true };
  } catch(e) {
    console.error("saveFicha error", e);
    return { ok: false, error: e.message };
  }
}

export async function deleteFicha(team, playerId) {
  try {
    const current = await loadFichas(team);
    delete current[String(playerId)];
    await setDoc(doc(db, "cdmagdalena_fichas", team), current);
    return { ok: true };
  } catch(e) {
    console.error("deleteFicha error", e);
    return { ok: false, error: e.message };
  }
}

// ── Usuarios ─────────────────────────────────────────────────────────────────
function hashSimple(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return hash.toString(36);
}
export async function registrarUsuario({ nombre, email, password, rol, equipo, equiposSeguidos, club }) {
  try {
    const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const snap = await getDoc(doc(db, "cdmagdalena_usuarios", emailKey));
    const clubId = club || "magdalena";
    if (snap.exists()) {
      // Usuario ya existe - añadir rol para este club
      const existing = snap.data();
      const roles = existing.roles || {};
      roles[clubId] = { rol, equipo: equipo || null, equiposSeguidos: equiposSeguidos || [] };
      await setDoc(doc(db, "cdmagdalena_usuarios", emailKey), { ...existing, roles }, { merge: true });
      const updatedUser = { ...existing, roles, rolActual: rol, equipoActual: equipo || null, equiposSeguidos: equiposSeguidos || [] };
      return { ok: true, user: updatedUser };
    }
    const roles = { [clubId]: { rol, equipo: equipo || null, equiposSeguidos: equiposSeguidos || [] } };
    const userData = { nombre, email: email.toLowerCase(), passwordHash: hashSimple(password), roles, creadoEn: new Date().toISOString() };
    await setDoc(doc(db, "cdmagdalena_usuarios", emailKey), userData);
    return { ok: true, user: { ...userData, rolActual: rol, equipoActual: equipo || null, equiposSeguidos: equiposSeguidos || [] } };
  } catch (e) { return { ok: false, error: e.message }; }
}
export async function loginUsuario({ email, password, clubId }) {
  try {
    const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const snap = await getDoc(doc(db, "cdmagdalena_usuarios", emailKey));
    if (!snap.exists()) return { ok: false, error: "Email no encontrado." };
    const userData = snap.data();
    if (userData.passwordHash !== hashSimple(password)) return { ok: false, error: "Contrasena incorrecta." };
    const club = clubId || "magdalena";
    const roles = userData.roles || {};
    const clubRol = roles[club];
    if (!clubRol) {
      // Si no tiene roles por club, solo permitir acceso a magdalena con el rol legacy
      if (club === "magdalena" && userData.rol) {
        return { ok: true, user: { ...userData, rolActual: userData.rol, equipoActual: userData.equipo || null, equiposSeguidos: userData.equiposSeguidos || [] } };
      }
      return { ok: false, error: "No tienes acceso a este club. Registrate primero en " + club + "." };
    }
    return { ok: true, user: { ...userData, rolActual: clubRol.rol, equipoActual: clubRol.equipo, rol: clubRol.rol, equipo: clubRol.equipo, equiposSeguidos: clubRol.equiposSeguidos || [] } };
  } catch (e) { return { ok: false, error: e.message }; }
}
export async function verificarCodigoRol(rol, codigo) {
  try {
    const snap = await getDoc(doc(db, "cdmagdalena_config", "roles"));
    if (!snap.exists()) return false;
    return snap.data()[rol] === codigo.trim().toUpperCase();
  } catch (e) { return false; }
}

// ── Login/registro dinámico por club ─────────────────────────────────────────
export async function loginUsuarioClub(firebaseConfig, prefix, email, password) {
  try {
    const db2 = getClubDb(firebaseConfig);
    const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const snap = await getDoc(doc(db2, prefix + "_usuarios", emailKey));
    if (!snap.exists()) return { ok: false, error: "Email no encontrado en este club." };
    const userData = snap.data();
    if (userData.passwordHash !== hashSimple(password)) return { ok: false, error: "Contrasena incorrecta." };
    return { ok: true, user: userData };
  } catch(e) { return { ok: false, error: e.message }; }
}

export async function registrarUsuarioClub(firebaseConfig, prefix, datos) {
  try {
    const db2 = getClubDb(firebaseConfig);
    const emailKey = datos.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const snap = await getDoc(doc(db2, prefix + "_usuarios", emailKey));
    if (snap.exists()) return { ok: false, error: "Este email ya esta registrado en este club." };
    await setDoc(doc(db2, prefix + "_usuarios", emailKey), datos);
    return { ok: true, user: datos };
  } catch(e) { return { ok: false, error: e.message }; }
}

export async function loadClubData(firebaseConfig, prefix) {
  try {
    const db2 = getClubDb(firebaseConfig);
    const snap = await getDoc(doc(db2, prefix, "main"));
    if (!snap.exists()) return null;
    const raw = snap.data().json;
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed ? cleanLoaded(parsed) : null;
  } catch(e) { console.error("loadClubData error", e); return null; }
}

export async function saveClubData(firebaseConfig, prefix, data) {
  try {
    const db2 = getClubDb(firebaseConfig);
    const json = JSON.stringify(data);
    await setDoc(doc(db2, prefix, "main"), { json });
  } catch(e) { console.error("saveClubData error", e); }
}

export async function loadClubSeasons(firebaseConfig, prefix) {
  try {
    const db2 = getClubDb(firebaseConfig);
    const snap = await getDoc(doc(db2, prefix, "seasons"));
    if (!snap.exists()) return [];
    const raw = snap.data().json;
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

export async function saveClubSeasons(firebaseConfig, prefix, seasons) {
  try {
    const db2 = getClubDb(firebaseConfig);
    const json = JSON.stringify(seasons);
    await setDoc(doc(db2, prefix, "seasons"), { json });
  } catch(e) { console.error(e); }
}

export function getClubDb(firebaseConfig) {
  const appName = firebaseConfig.projectId;
  const existingApp = getApps().find(a => a.name === appName);
  const app2 = existingApp || initializeApp(firebaseConfig, appName);
  return getFirestore(app2);
}

// ── Gestión de equipos por club ───────────────────────────────────────────────
export async function loadEquipos(prefix) {
  try {
    const snap = await getDoc(doc(db, prefix + "_config", "equipos"));
    if (!snap.exists()) return [];
    return snap.data().lista || [];
  } catch(e) { return []; }
}

export async function saveEquipos(prefix, equipos) {
  try {
    await setDoc(doc(db, prefix + "_config", "equipos"), { lista: equipos });
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

export async function loadUsuariosClub(prefix) {
  try {
    const snap = await getDocs(collection(db, prefix + "_usuarios"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

export async function actualizarRolUsuario(prefix, email, clubId, nuevoRol) {
  try {
    const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const ref = doc(db, prefix + "_usuarios", emailKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok: false, error: "Usuario no encontrado" };
    const existing = snap.data();
    const roles = existing.roles || {};
    const equipoActual = roles[clubId]?.equipo || null;
    roles[clubId] = { rol: nuevoRol, equipo: nuevoRol === "entrenador" ? equipoActual : null };
    await setDoc(ref, { ...existing, roles }, { merge: true });
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Banco de jugadores del club ───────────────────────────────────────────────
export async function loadBancoJugadores(prefix) {
  try {
    const snap = await getDoc(doc(db, prefix + "_config", "banco_jugadores"));
    if (!snap.exists()) return [];
    return snap.data().jugadores || [];
  } catch(e) { return []; }
}

export async function saveBancoJugadores(prefix, jugadores) {
  try {
    await setDoc(doc(db, prefix + "_config", "banco_jugadores"), { jugadores });
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Foro público ─────────────────────────────────────────────────────────────
// IMPORTANTE: todo esto vive aparte de "prefix/main" (donde están los datos
// sensibles del club — jugadores, teléfonos, DNI...). El Foro es de acceso
// público sin contraseña, así que solo debe leer/escribir aquí: nunca debe
// tocar ni depender del documento principal.
//
// Las noticias van cada una en su propio documento (no todas juntas en uno
// solo) porque pueden llevar foto incrustada, y Firestore limita cada
// documento a 1 MB — así cada noticia tiene su propio margen, en vez de
// compartir un único límite entre todas. Las fotos NO usan Firebase Storage
// (eso exige activar el plan de pago Blaze); se comprimen en el propio
// móvil y se guardan como texto dentro del mismo documento, gratis.

export async function loadNoticias(prefix) {
  try {
    const snap = await getDocs(collection(db, prefix + "_noticias"));
    return snap.docs.map(d => d.data()).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  } catch(e) { return []; }
}

export async function guardarNoticia(prefix, noticia) {
  try {
    await setDoc(doc(db, prefix + "_noticias", noticia.id), noticia);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

export async function borrarNoticia(prefix, noticiaId) {
  try {
    await deleteDoc(doc(db, prefix + "_noticias", noticiaId));
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

export async function loadResultadosPublicos(prefix) {
  try {
    const snap = await getDoc(doc(db, prefix + "_config", "foro_resultados"));
    if (!snap.exists()) return {};
    return snap.data().resultados || {};
  } catch(e) { return {}; }
}

// Se llama automáticamente al guardar un partido desde Partidos, para que
// el resultado aparezca también en el Foro público sin exponer nada más.
export async function publicarResultado(prefix, equipo, { rival, fecha, resultado }) {
  try {
    const actual = await loadResultadosPublicos(prefix);
    const resultados = { ...actual };
    const lista = (resultados[equipo] || []).filter(r => !(r.rival === rival && r.fecha === fecha));
    resultados[equipo] = [{ rival, fecha, resultado }, ...lista].slice(0, 30);
    await setDoc(doc(db, prefix + "_config", "foro_resultados"), { resultados });
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}
