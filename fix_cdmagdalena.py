import re

# ── firebase.js ──────────────────────────────────────────────────────────────
firebase_content = '''import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

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
export const storage = getStorage(app);

function cleanLoaded(obj) {
  if (!obj || typeof obj !== \'object\') return obj;
  if (Array.isArray(obj)) return obj.filter(i => i != null).map(cleanLoaded);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === \'pizarra\' && Array.isArray(v)) {
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

// ── Firebase Storage: fichas PDF ─────────────────────────────────────────────
export async function uploadFichaPDF(team, playerId, file) {
  try {
    const path = `fichas/${team}/${playerId}.pdf`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: "application/pdf" });
    const url = await getDownloadURL(storageRef);
    return { ok: true, url };
  } catch(e) {
    console.error("Upload ficha error", e);
    return { ok: false, error: e.message };
  }
}

export async function deleteFichaPDF(team, playerId) {
  try {
    const path = `fichas/${team}/${playerId}.pdf`;
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return { ok: true };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}
'''

with open("src/firebase.js", "w") as f:
    f.write(firebase_content)
print("✅ firebase.js escrito")

# ── App.jsx patches ──────────────────────────────────────────────────────────
with open("src/App.jsx", "r") as f:
    content = f.read()

original_len = len(content)

# 1. Import
content = content.replace(
    'import { loadData, saveData, loadSeasons, saveSeasons, subscribeToData } from "./firebase";',
    'import { loadData, saveData, loadSeasons, saveSeasons, subscribeToData, uploadFichaPDF, deleteFichaPDF } from "./firebase";'
)

# 2. Estado fichaUploading
content = content.replace(
    '  const [statsPlayer, setStatsPlayer] = useState(null);\n  const [attPlayer, setAttPlayer] = useState(null);\n  const [search, setSearch] = useState("");',
    '  const [statsPlayer, setStatsPlayer] = useState(null);\n  const [attPlayer, setAttPlayer] = useState(null);\n  const [search, setSearch] = useState("");\n  const [fichaUploading, setFichaUploading] = useState({});'
)

# 3. del + handlers
old_del = '  const del = (id) => {\n    if (!window.confirm("¿Eliminar jugador?")) return;\n    onSave({ ...data, players: data.players.filter(p => p.id !== id) });\n  };'
new_del = r'''  const del = (id) => {
    if (!window.confirm("¿Eliminar jugador?\nSe eliminarán también sus datos, informes y ficha PDF si tiene.")) return;
    const player = (data.players || []).find(p => p.id === id);
    if (player?.fichaUrl) deleteFichaPDF(team, id).catch(() => {});
    onSave({ ...data, players: data.players.filter(p => p.id !== id) });
  };

  const handleFichaUpload = async (player, file) => {
    if (!file || file.type !== "application/pdf") {
      alert("Solo se admiten archivos PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("El PDF no puede superar 5 MB.");
      return;
    }
    setFichaUploading(prev => ({ ...prev, [player.id]: true }));
    const result = await uploadFichaPDF(team, player.id, file);
    setFichaUploading(prev => ({ ...prev, [player.id]: false }));
    if (result.ok) {
      const players = (data.players || []).map(p =>
        p.id !== player.id ? p : { ...p, fichaUrl: result.url, fichaNombre: file.name }
      );
      onSave({ ...data, players });
    } else {
      alert("Error al subir el PDF. Comprueba los permisos de Firebase Storage.\n" + result.error);
    }
  };

  const handleFichaDelete = async (player) => {
    if (!window.confirm(`¿Eliminar la ficha PDF de ${player.name}?`)) return;
    setFichaUploading(prev => ({ ...prev, [player.id]: true }));
    await deleteFichaPDF(team, player.id);
    setFichaUploading(prev => ({ ...prev, [player.id]: false }));
    const players = (data.players || []).map(p =>
      p.id !== player.id ? p : { ...p, fichaUrl: null, fichaNombre: null }
    );
    onSave({ ...data, players });
  };'''
content = content.replace(old_del, new_del)

# 4. <th> Ficha header
old_th = ('                        {isCoord && <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">DNI</th>}\n'
          '                        <th className="text-right px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Acciones</th>')
new_th = ('                        {isCoord && <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">DNI</th>}\n'
          '                        {isCoord && <th className="text-left px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Ficha</th>}\n'
          '                        <th className="text-right px-3 py-2.5 text-xs text-zinc-500 font-semibold uppercase tracking-wider">Acciones</th>')
content = content.replace(old_th, new_th)

# 5. <td> Ficha cell
old_td = ('                            {isCoord && (\n'
          '                              <td className="px-3 py-3">\n'
          '                                <span className="text-zinc-300 text-sm font-mono">{p.dni || <span className="text-zinc-600">—</span>}</span>\n'
          '                              </td>\n'
          '                            )}')
new_td = r'''                            {isCoord && (
                              <td className="px-3 py-3">
                                <span className="text-zinc-300 text-sm font-mono">{p.dni || <span className="text-zinc-600">—</span>}</span>
                              </td>
                            )}
                            {isCoord && (
                              <td className="px-3 py-3">
                                {fichaUploading[p.id] ? (
                                  <span className="text-xs text-zinc-400 animate-pulse">⏳ Subiendo...</span>
                                ) : p.fichaUrl ? (
                                  <div className="flex items-center gap-1.5">
                                    <a
                                      href={p.fichaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={p.fichaNombre || "Ver ficha PDF"}
                                      className="text-xs px-2 py-1 rounded bg-blue-900/40 border border-blue-700/50 text-blue-300 hover:bg-blue-900/70 transition-all font-medium"
                                    >
                                      📄 Ver
                                    </a>
                                    <label
                                      title="Reemplazar PDF"
                                      className="text-xs px-1.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all cursor-pointer"
                                    >
                                      🔄
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        className="hidden"
                                        onChange={e => { if (e.target.files[0]) handleFichaUpload(p, e.target.files[0]); e.target.value = ""; }}
                                      />
                                    </label>
                                    <button
                                      onClick={() => handleFichaDelete(p)}
                                      title="Eliminar ficha"
                                      className="text-xs px-1.5 py-1 rounded bg-zinc-800 border border-red-900/50 text-red-500 hover:bg-red-900/30 hover:border-red-700 transition-all"
                                    >✕</button>
                                  </div>
                                ) : (
                                  <label
                                    title="Subir ficha PDF"
                                    className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all cursor-pointer flex items-center gap-1 w-fit"
                                  >
                                    ⬆️ Subir
                                    <input
                                      type="file"
                                      accept="application/pdf"
                                      className="hidden"
                                      onChange={e => { if (e.target.files[0]) handleFichaUpload(p, e.target.files[0]); e.target.value = ""; }}
                                    />
                                  </label>
                                )}
                              </td>
                            )}'''
content = content.replace(old_td, new_td)

with open("src/App.jsx", "w") as f:
    f.write(content)

new_len = len(content)
diff = new_len - original_len
print(f"✅ App.jsx actualizado — {original_len} → {new_len} chars (+{diff})")
if diff < 100:
    print("⚠️  ADVERTENCIA: el diff es muy pequeño, puede que algún replace no haya encontrado el texto exacto")
else:
    print("✅ Todos los cambios aplicados correctamente")
