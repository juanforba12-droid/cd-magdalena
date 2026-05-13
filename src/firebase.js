import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

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
      // Try to identify which key causes the issue
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

export async function saveSeasons(seasons) {
  try {
    const json = JSON.stringify(seasons);
    await setDoc(doc(db, "cdmagdalena", "seasons"), { json });
  } catch(e) { console.error(e); }
}
