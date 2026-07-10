import { getApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirestore, doc, setDoc, addDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp } from "firebase/firestore";

// ⚠️ PEGA AQUÍ TU CLAVE (consola Firebase → Cloud Messaging → Certificados push web):
const VAPID_KEY = "PEGA_AQUI_LA_CLAVE_VAPID";

export async function activarPush({ email, nombre, rol, equipo, clubId }) {
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
      equipo: equipo || "",
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

export async function enviarAviso({ titulo, mensaje, destino, clubId, creadoPor }) {
  const db = getFirestore(getApp());
  await addDoc(collection(db, "avisosPush"), {
    titulo,
    mensaje,
    destino: destino || "todos",
    clubId: clubId || "magdalena",
    creadoPor: creadoPor || "sistema",
    fecha: serverTimestamp(),
  });
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
