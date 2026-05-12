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

function clean(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export async function loadData() {
  try {
    const snap = await getDoc(doc(db, "cdmagdalena", "main"));
    return snap.exists() ? snap.data().state : null;
  } catch(e) {
    console.error("Load error", e);
    return null;
  }
}

export async function saveData(data) {
  try {
    await setDoc(doc(db, "cdmagdalena", "main"), { state: clean(data) });
  } catch(e) {
    console.error("Save error", e);
  }
}

export async function loadSeasons() {
  try {
    const snap = await getDoc(doc(db, "cdmagdalena", "seasons"));
    return snap.exists() ? snap.data().seasons : [];
  } catch(e) {
    return [];
  }
}

export async function saveSeasons(seasons) {
  try {
    await setDoc(doc(db, "cdmagdalena", "seasons"), { seasons: clean(seasons) });
  } catch(e) {
    console.error(e);
  }
}
