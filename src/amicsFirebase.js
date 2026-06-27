import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXNq-oZDJfMLUY8C2zvv80o98N-ER-hKs",
  authDomain: "amics-castello-app.firebaseapp.com",
  projectId: "amics-castello-app",
  storageBucket: "amics-castello-app.firebasestorage.app",
  messagingSenderId: "803606875688",
  appId: "1:803606875688:web:bcb392a3005fb0f3f62f1d"
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
    const snap = await getDoc(doc(db, "amicscastello", "main"));
    if (!snap.exists()) return null;
    const raw = snap.data().json;
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed ? cleanLoaded(parsed) : null;
  } catch(e) { console.error("Load error", e); return null; }
}

export async function saveData(data) {
  try {
    const json = JSON.stringify(data);
    await setDoc(doc(db, "amicscastello", "main"), { json });
    console.log("Saved OK, size:", json.length);
  } catch(e) { console.error("Save error", e); }
}

export async function loadSeasons() {
  try {
    const snap = await getDoc(doc(db, "amicscastello", "seasons"));
    if (!snap.exists()) return [];
    const raw = snap.data().json;
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

export function subscribeToData(callback) {
  try {
    return onSnapshot(doc(db, "amicscastello", "main"), (snap) => {
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
    await setDoc(doc(db, "amicscastello", "seasons"), { json });
  } catch(e) { console.error(e); }
}