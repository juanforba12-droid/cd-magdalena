import { getApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp } from "firebase/firestore";

// ⚠️ PEGA AQUÍ TU CLAVE (consola Firebase → Cloud Messaging → Certificados push web):
const VAPID_KEY = "BG9MYtEVe9RXcYsQTWO8_5JphByaE6FUVdvglI-4Xp_gf_aSRqZA9DRT07OzyUb2-K6GHeJhTxKNb1F3DCplbtw";

export async function obtenerMiToken() {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return null;
    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch (e) { return null; }
}

export async function cargarMisPreferencias() {
  const token = await obtenerMiToken();
  if (!token) return null;
  const db = getFirestore(getApp());
  const snap = await getDoc(doc(db, "pushTokens", token));
  if (!snap.exists()) return null;
  return { token, ...snap.data() };
}

export async function actualizarPreferencia(token, equipo, tipo, activado) {
  const db = getFirestore(getApp());
  const snap = await getDoc(doc(db, "pushTokens", token));
  if (!snap.exists()) return { ok: false };
  const actual = snap.data();
  const prefs = { ...(actual.prefs || {}) };
  prefs[equipo] = { ...(prefs[equipo] || {}), [tipo]: activado };
  await setDoc(doc(db, "pushTokens", token), { prefs }, { merge: true });
  return { ok: true };
}

export async function activarPush({ email, nombre, rol, equipos, clubId }) {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return { ok: false, error: "Este navegador no soporta notificaciones. En iPhone, la app debe estar añadida a pantalla de inicio." };
    }
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return { ok: false, error: "Permiso denegado. Actívalo en los ajustes del navegador." };

    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return { ok: false, error: "No se pudo obtener el token." };

    const db = getFirestore(getApp());
    await setDoc(doc(db, "pushTokens", token), {
      token,
      email: email || "",
      nombre: nombre || "",
      rol: rol || "familiar",
      equipos: equipos && equipos.length > 0 ? equipos : [],
      clubId: clubId || "magdalena",
      updatedAt: serverTimestamp(),
    });

    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      try { new Notification(title || "MiClubFUT", { body: body || "", icon: "/pwa-192.png" }); } catch(e) {}
    });

    return { ok: true, token };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function enviarAviso({ titulo, mensaje, destino, tipo, clubId, creadoPor }) {
  const db = getFirestore(getApp());
  await addDoc(collection(db, "avisosPush"), {
    titulo,
    mensaje,
    destino: destino || "todos",
    tipo: tipo || "general",
    clubId: clubId || "magdalena",
    creadoPor: creadoPor || "sistema",
    fecha: serverTimestamp(),
  });
  fetch("/api/send-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titulo, mensaje, destino: destino || "todos", tipo: tipo || "general", clubId: clubId || "magdalena" }),
  }).catch(() => {});
  return { ok: true };
}

export async function cargarAvisos(clubId) {
  const db = getFirestore(getApp());
  const q = query(
    collection(db, "avisosPush"),
    where("clubId", "==", clubId || "magdalena"),
    orderBy("fecha", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
