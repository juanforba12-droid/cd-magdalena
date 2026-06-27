import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

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
