import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCfxoAOo4E6bpfFe1N9_DkZvYl2yewijhI",
  authDomain: "academia-basket-app.firebaseapp.com",
  projectId: "academia-basket-app",
  storageBucket: "academia-basket-app.firebasestorage.app",
  messagingSenderId: "573776541077",
  appId: "1:573776541077:web:9da12db6d5c54dbcce329c"
};

const app = getApps().find(a => a.name === "internacional") || initializeApp(firebaseConfig, "internacional");
const db = getFirestore(app);

export async function loadInternacionalData(collection_name) {
  try {
    const snap = await getDocs(collection(db, collection_name));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

export async function saveInternacionalDoc(collection_name, id, data) {
  try {
    await setDoc(doc(db, collection_name, id), data, { merge: true });
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

export async function deleteInternacionalDoc(collection_name, id) {
  try {
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, collection_name, id));
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

export async function loginInternacional({ email, password }) {
  try {
    const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const snap = await getDoc(doc(db, "internacional_usuarios", emailKey));
    if (!snap.exists()) return { ok: false, error: "Email no encontrado." };
    const userData = snap.data();
    const hash = (str) => [...str].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0).toString(36);
    if (userData.passwordHash !== hash(password)) return { ok: false, error: "Contraseña incorrecta." };
    return { ok: true, user: { ...userData, rolActual: userData.rol } };
  } catch(e) { return { ok: false, error: e.message }; }
}

export async function registrarInternacional({ nombre, email, password, rol, equipo }) {
  try {
    const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const hash = (str) => [...str].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0).toString(36);
    const userData = { nombre, email: email.toLowerCase(), passwordHash: hash(password), rol, equipo: equipo || null, creadoEn: new Date().toISOString() };
    await setDoc(doc(db, "internacional_usuarios", emailKey), userData);
    return { ok: true, user: { ...userData, rolActual: rol } };
  } catch(e) { return { ok: false, error: e.message }; }
}

export { db as internacionalDb };
