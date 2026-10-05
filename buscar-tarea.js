// BÚSQUEDA — SOLO LEE, no modifica ni borra nada.
//
// USO (desde la terminal de Codespaces, en la raíz del proyecto):
//   node buscar-tarea.js            -> busca "físico" (también "fisico", "físico 1")
//   node buscar-tarea.js "calent"   -> busca otro texto
//
// Qué hace:
//   Lee el documento principal del club y busca el texto en TODOS los sitios
//   donde puede haber quedado una tarea: la biblioteca global, las tareas de
//   cada equipo, las tareas dentro de cada entrenamiento, y también bajo la
//   clave fantasma "null" (donde van a parar los guardados cuando activeTeam
//   se rompe). Además muestra el tamaño del documento frente al límite de 1 MB
//   y los entrenamientos con fecha 2026-10-05.

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAnzUJZe1NQYbjWHeq1jqV2O118CDR0dBQ",
  authDomain: "cd-la-magdalena.firebaseapp.com",
  projectId: "cd-la-magdalena",
  storageBucket: "cd-la-magdalena.firebasestorage.app",
  messagingSenderId: "15940427840",
  appId: "1:15940427840:web:4e76b3c595b7394582ffa5",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const quitaAcentos = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const BUSCA = quitaAcentos(process.argv[2] || "fisico");
const HOY = "2026-10-05";

// Textos de una tarea, sin los dibujos de la pizarra (que pesan mucho y no ayudan).
function textosDe(t) {
  return Object.entries(t || {})
    .filter(([k, v]) => !k.startsWith("pizarra") && typeof v === "string")
    .map(([, v]) => v);
}
const coincide = (t) => textosDe(t).some((s) => quitaAcentos(s).includes(BUSCA));
const titulo = (t) => t.name || t.title || t.nombre || t.titulo || textosDe(t)[0] || "(sin nombre)";

async function main() {
  const snap = await getDoc(doc(db, "cdmagdalena", "main"));
  if (!snap.exists()) { console.log("No existe cdmagdalena/main"); process.exit(1); }
  const raw = snap.data().json;
  const bytes = Buffer.byteLength(raw, "utf8");
  console.log(`Tamaño del documento: ${(bytes / 1024).toFixed(0)} KB de 1024 KB (${((bytes / 1048576) * 100).toFixed(0)}%)\n`);
  const data = JSON.parse(raw);

  const peso = Object.entries(data)
    .map(([k, v]) => [k, Buffer.byteLength(JSON.stringify(v), "utf8")])
    .sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log("Lo que más pesa:", peso.map(([k, b]) => `${k} ${(b / 1024).toFixed(0)} KB`).join(" · "), "\n");

  let hallazgos = 0;
  const muestra = (donde, t, extra = "") => {
    hallazgos++;
    console.log(`✔ ${donde}${extra}\n    "${titulo(t)}"  id=${t.id ?? "?"}`);
  };

  for (const t of data.__globalTasks || []) if (coincide(t)) muestra("Biblioteca global (Tareas)", t);

  for (const [equipo, td] of Object.entries(data)) {
    if (equipo.startsWith("__") || !td || typeof td !== "object") continue;
    for (const t of td.tasks || []) if (coincide(t)) muestra(`Equipo "${equipo}" · tareas`, t);
    for (const tr of td.trainings || []) {
      for (const t of tr.tasks || []) {
        if (coincide(t)) muestra(`Equipo "${equipo}" · entrenamiento ${tr.fecha || tr.date || "?"}`, t);
      }
    }
  }

  console.log(hallazgos ? `\n${hallazgos} coincidencia(s).` : "\nNo hay ninguna tarea con ese texto en el documento.");

  console.log(`\nEntrenamientos con fecha ${HOY}:`);
  let hay = false;
  for (const [equipo, td] of Object.entries(data)) {
    if (equipo.startsWith("__") || !td || typeof td !== "object") continue;
    for (const tr of td.trainings || []) {
      if ((tr.fecha || tr.date) === HOY) {
        hay = true;
        console.log(`  ${equipo}: ${(tr.tasks || []).length} tarea(s) → ${(tr.tasks || []).map(titulo).join(" | ") || "—"}`);
      }
    }
  }
  if (!hay) console.log("  (ninguno)");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
