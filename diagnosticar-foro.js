// DIAGNÓSTICO — SOLO LEE, no modifica ni borra nada.
//
// USO (desde la terminal de Codespaces, en la raíz del proyecto):
//   node diagnosticar-foro.js
//
// Qué hace:
//   Lee los partidos reales de Partidos (todos los equipos) y compara,
//   equipo por equipo, cuáles tienen resultado puesto ahí, contra lo que
//   hay guardado en el documento del Foro (cdmagdalena_config/foro_resultados).
//   Marca en rojo cualquier partido con resultado que NO aparezca en el Foro,
//   o que aparezca pero con un rival o marcador distinto al real.

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
const PREFIX = "cdmagdalena";

async function main() {
  console.log("Leyendo partidos reales (Partidos) y lo publicado en el Foro...\n");

  const mainSnap = await getDoc(doc(db, PREFIX, "main"));
  const dataReal = mainSnap.exists() ? JSON.parse(mainSnap.data().json) : {};

  const foroSnap = await getDoc(doc(db, PREFIX + "_config", "foro_resultados"));
  const resultadosForo = foroSnap.exists() ? (foroSnap.data().resultados || {}) : {};

  console.log("──── Documento completo tal cual está en el Foro ahora mismo ────");
  console.log(JSON.stringify(resultadosForo, null, 2));
  console.log("───────────────────────────────────────────────────────────────\n");

  let totalConResultado = 0;
  let totalProblemas = 0;

  for (const equipo of Object.keys(dataReal)) {
    if (equipo.startsWith("__")) continue;
    const matches = dataReal[equipo]?.matches;
    if (!Array.isArray(matches)) continue;
    const conResultado = matches.filter(m => m.resultado);
    if (conResultado.length === 0) continue;

    console.log(`\n=== ${equipo} ===`);
    const publicadosEquipo = resultadosForo[equipo] || [];

    conResultado.forEach(m => {
      totalConResultado++;
      const enForo = publicadosEquipo.find(r => r.rival === m.rival && r.fecha === m.fecha);
      if (!enForo) {
        totalProblemas++;
        console.log(`  ❌ FALTA en el Foro: vs ${m.rival} (${m.fecha}) — resultado real: ${m.resultado}`);
      } else if (enForo.resultado !== m.resultado) {
        totalProblemas++;
        console.log(`  ⚠️  MARCADOR DISTINTO: vs ${m.rival} (${m.fecha}) — real: ${m.resultado}, en el Foro: ${enForo.resultado}`);
      } else {
        console.log(`  ✅ OK: vs ${m.rival} (${m.fecha}) — ${m.resultado}`);
      }
    });

    // Partidos publicados en el Foro que ya NO existen (o no tienen ese
    // resultado) en los datos reales de Partidos — posibles "fantasma".
    publicadosEquipo.forEach(r => {
      const existeReal = matches.find(m => m.rival === r.rival && m.fecha === r.fecha && m.resultado);
      if (!existeReal) {
        totalProblemas++;
        console.log(`  👻 EN EL FORO PERO NO EN PARTIDOS: vs ${r.rival} (${r.fecha}) — ${r.resultado}`);
      }
    });
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`Partidos con resultado en Partidos: ${totalConResultado}`);
  console.log(`Problemas encontrados: ${totalProblemas}`);
}

main().catch(e => console.error("Error:", e.message));
