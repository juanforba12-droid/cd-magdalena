// Importa jugadores de Alevín A, Alevín B, Benjamín A y Prebenjamín a la
// PLANTILLA real de cada equipo (la que se usa para convocatorias y
// alineaciones) — no al Banco de Jugadores. Mismos datos que el script
// anterior (import-banco-4.js), pero en el sitio correcto esta vez.
//
// USO (desde la terminal de Codespaces, en la raíz del proyecto):
//   node import-plantilla-4.js
//
// Qué hace:
//   1. Lee el documento principal completo (no toca nada todavía)
//   2. Guarda una copia de seguridad en backup-antes-de-plantilla-4.json
//   3. Compara por nombre con quien YA está en la Plantilla de cada
//      equipo, y SOLO añade los que todavía no están (evita duplicados)
//   4. Los marcados "LICENCIAS PENDIENTES" en el PDF se añaden con
//      estado "Sin ficha"
//   5. Guarda el resultado
//
// No hay teléfono en el documento origen, así que se importan solo con
// el nombre.

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import fs from "fs";

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

const jugador = (name, extra = {}) => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  name,
  dorsal: "",
  positions: [],
  posicionPrincipal: "",
  telefono: "",
  dni: "",
  fechaNacimiento: "",
  ...extra,
});

// --- Alevín A --------------------------------------------------------
const nuevosAlevinA = [
  jugador("Miguel José Centelles Centelles"),
  jugador("Pablo Gil Archilés"),
  jugador("José Gregorio Hernández Sánchez"),
  jugador("Mihkhael Kudryavtsev Pesliak"),
  jugador("Héctor Martínez Susu"),
  jugador("Mohamed Reklaoui Er Raklaoui"),
  jugador("Saad Reklaoui Er Raklaoui"),
  jugador("Máximo Sánchez de Mora Kakovka"),
  jugador("Alejandro Sgarbi Palmi"),
  jugador("Cristhian David Padilla Rivas"),
  jugador("Carlos David Fernández Hernández", { status: "sin_ficha" }),
  jugador("John Paul Hernández Llort", { status: "sin_ficha" }),
];

// --- Alevín B ---------------------------------------------------------
const nuevosAlevinB = [
  jugador("Adriano Alvarado Tapia"),
  jugador("Lucas Archelós Jaime"),
  jugador("Thomas Arevalo Gereda"),
  jugador("Taha Meriouli Dris"),
  jugador("Sebastián Ignacio Prieto Vidal"),
  jugador("Bruno Stoyan Samaniego Samaniego"),
  jugador("Mohammed Ali Zeddouri"),
  jugador("Eylan Fabregat Turón", { status: "sin_ficha" }),
  jugador("Mathias Mijares Bonalde", { status: "sin_ficha" }),
  jugador("Felipe Pagella", { status: "sin_ficha" }),
  jugador("Hugo Muñoz Luque", { status: "sin_ficha" }),
  jugador("Alejandro Uribe", { status: "sin_ficha" }),
];

// --- Benjamín A ---------------------------------------------------------
const nuevosBenjaminA = [
  jugador("Antonio Barreda Huamán"),
  jugador("Eric Boniche Cerdá"),
  jugador("Alvaro Cobo Gordillo"),
  jugador("Sergio Escrig Clarós"),
  jugador("Alex Gómez Mateu"),
  jugador("Neyzan Gutierrez Muñoz"),
  jugador("Riyad Marfak"),
  jugador("Jon Martínez Martínez"),
  jugador("Víctor Ortega Roncero"),
  jugador("Daniil Safronov"),
  jugador("Dominic Valentín Secelean"),
  jugador("Dylan Delgado Gonzalo"),
  jugador("Martín Pinedo Hernández"),
  jugador("Deivi José Palencia Heredia", { status: "sin_ficha" }),
];

// --- Prebenjamín ---------------------------------------------------------
const nuevosPrebenjamin = [
  jugador("Jesé Selma Jiménez"),
  jugador("Manuel Tonda Hernández"),
  jugador("Saulo García Callejas"),
  jugador("Josué Pueyo Escudero", { status: "sin_ficha" }),
  jugador("Ángel Hernández Jiménez", { status: "sin_ficha" }),
  jugador("Dylan Iordan Valentín", { status: "sin_ficha" }),
  jugador("Lucas Barbi", { status: "sin_ficha" }),
  jugador("José Alejandro", { status: "sin_ficha" }),
];

const norm = (s) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

async function main() {
  console.log("Leyendo datos actuales...");
  const snap = await getDoc(doc(db, PREFIX, "main"));
  if (!snap.exists()) {
    console.error("No se ha encontrado el documento cdmagdalena/main. Nada que hacer.");
    process.exit(1);
  }
  const dataActual = JSON.parse(snap.data().json);

  fs.writeFileSync("backup-antes-de-plantilla-4.json", JSON.stringify(dataActual, null, 2));
  console.log("Copia de seguridad guardada en backup-antes-de-plantilla-4.json");

  const equipos = [
    { nombre: "Alevín A", nuevos: nuevosAlevinA },
    { nombre: "Alevín B", nuevos: nuevosAlevinB },
    { nombre: "Benjamín A", nuevos: nuevosBenjaminA },
    { nombre: "Prebenjamín", nuevos: nuevosPrebenjamin },
  ];

  for (const { nombre, nuevos } of equipos) {
    const actual = dataActual[nombre] || { players: [], trainings: [], matches: [], attendance: [] };
    const existentes = new Set((actual.players || []).map(p => norm(p.name)));
    const aAnadir = nuevos.filter(j => !existentes.has(norm(j.name)));
    const saltados = nuevos.filter(j => existentes.has(norm(j.name)));

    const antes = (actual.players || []).length;
    actual.players = [...(actual.players || []), ...aAnadir];
    dataActual[nombre] = actual;

    console.log(`\n${nombre}: ${antes} jugadores -> ${actual.players.length} jugadores (+${aAnadir.length})`);
    if (saltados.length > 0) {
      console.log(`  Ya existían, no se han duplicado (${saltados.length}): ${saltados.map(j => j.name).join(", ")}`);
    }
  }

  console.log("\nGuardando...");
  await setDoc(doc(db, PREFIX, "main"), { json: JSON.stringify(dataActual) });
  console.log("Hecho. Revisa la Plantilla de cada equipo en la app.");
}

main().catch((e) => {
  console.error("Error al importar:", e.message);
  console.error("No se ha modificado nada si el error ha sido al leer o antes de guardar.");
  process.exit(1);
});
