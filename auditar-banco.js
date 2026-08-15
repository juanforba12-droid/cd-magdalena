// AUDITORÍA del Banco de Jugadores — SOLO LEE, no modifica ni borra nada.
//
// USO (desde la terminal de Codespaces, en la raíz del proyecto):
//   node auditar-banco.js
//
// Qué hace:
//   Lee el Banco de Jugadores completo y agrupa a los jugadores por el
//   "Equipo de origen" que tienen puesto. Por cada equipo, dice si es uno
//   de los 11 equipos actuales del club o si ya no existe (equipo viejo),
//   y lista los nombres de los jugadores en cada grupo.
//
// Con esto delante puedes decidir con seguridad a quién borrar, a quién
// corregirle el equipo, y a quién dejar tal cual.

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

// Los 11 equipos actuales del club (los que se ven hoy en Ajustes →
// Gestión del Club → Equipos). Si habéis creado/renombrado equipos desde
// que escribí esto, edita esta lista antes de ejecutar el script.
const EQUIPOS_ACTUALES = [
  "Escoleta", "Prebenjamín", "Benjamín A", "Alevín C", "Alevín B", "Alevín A",
  "Infantil", "Cadete", "Juvenil A", "Juvenil B", "Amateur",
];

async function main() {
  console.log("Leyendo Banco de Jugadores...\n");
  const snap = await getDoc(doc(db, PREFIX + "_config", "banco_jugadores"));
  const banco = snap.exists() ? (snap.data().jugadores || []) : [];

  if (banco.length === 0) {
    console.log("El Banco de Jugadores está vacío.");
    return;
  }

  const grupos = {};
  banco.forEach(j => {
    const eq = j.equipoOrigen || "(sin equipo puesto)";
    if (!grupos[eq]) grupos[eq] = [];
    grupos[eq].push(j.nombre || "(sin nombre)");
  });

  const equiposOrdenados = Object.keys(grupos).sort();

  console.log(`Total en el Banco: ${banco.length} jugadores, repartidos en ${equiposOrdenados.length} equipos distintos:\n`);

  equiposOrdenados.forEach(eq => {
    const esActual = EQUIPOS_ACTUALES.includes(eq);
    const etiqueta = esActual ? "✅ EQUIPO ACTUAL" : "⚠️  YA NO EXISTE";
    console.log(`${etiqueta}  —  "${eq}"  (${grupos[eq].length} jugador${grupos[eq].length === 1 ? "" : "es"})`);
    grupos[eq].forEach(nombre => console.log(`    - ${nombre}`));
    console.log("");
  });

  const stats = equiposOrdenados.reduce((acc, eq) => {
    if (EQUIPOS_ACTUALES.includes(eq)) acc.actuales += grupos[eq].length;
    else acc.viejos += grupos[eq].length;
    return acc;
  }, { actuales: 0, viejos: 0 });

  console.log("──────────────────────────────────────");
  console.log(`Jugadores en equipos actuales: ${stats.actuales}`);
  console.log(`Jugadores en equipos que ya no existen: ${stats.viejos}`);
}

main().catch(e => console.error("Error:", e.message));
