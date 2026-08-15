// Importa jugadores de Alevín A, Alevín B, Benjamín A y Prebenjamín al
// BANCO DE JUGADORES (cdmagdalena_config/banco_jugadores), a partir de
// "ACTUALIZACION LICENCIAS 13-08" — el mismo documento que se usó para
// Juvenil B y Cadete.
//
// USO (desde la terminal de Codespaces, en la raíz del proyecto):
//   node import-banco-4.js
//
// Qué hace:
//   1. Lee el Banco de Jugadores actual (no toca nada todavía)
//   2. Guarda una copia de seguridad en backup-antes-de-importar-banco-4.json
//   3. Compara por nombre con quien YA está en el Banco, y SOLO añade los
//      que todavía no están (evita duplicados)
//   4. Cada jugador lleva su "Equipo de origen" puesto
//   5. Los marcados "LICENCIAS PENDIENTES" en el PDF se añaden con estado
//      "Sin ficha" y, en notas, el motivo exacto que ponía el documento
//   6. Guarda el resultado

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

const jugador = (nombre, equipoOrigen, extra = {}) => ({
  id: Date.now().toString() + Math.floor(Math.random() * 100000),
  nombre,
  fechaNac: "",
  dni: "",
  telefono: "",
  posicion: "",
  posicionesSecundarias: [],
  estado: "disponible",
  notas: "",
  equipoOrigen,
  creadoEn: new Date().toISOString(),
  ...extra,
});

// --- Alevín A --------------------------------------------------------
const nuevosAlevinA = [
  jugador("Miguel José Centelles Centelles", "Alevín A"),
  jugador("Pablo Gil Archilés", "Alevín A"),
  jugador("José Gregorio Hernández Sánchez", "Alevín A"),
  jugador("Mihkhael Kudryavtsev Pesliak", "Alevín A"),
  jugador("Héctor Martínez Susu", "Alevín A"),
  jugador("Mohamed Reklaoui Er Raklaoui", "Alevín A"),
  jugador("Saad Reklaoui Er Raklaoui", "Alevín A"),
  jugador("Máximo Sánchez de Mora Kakovka", "Alevín A"),
  jugador("Alejandro Sgarbi Palmi", "Alevín A"),
  jugador("Cristhian David Padilla Rivas", "Alevín A"),
  jugador("Carlos David Fernández Hernández", "Alevín A", { estado: "sin_ficha", notas: "Falta la firma para enviar a federación" }),
  jugador("John Paul Hernández Llort", "Alevín A", { estado: "sin_ficha", notas: "Enviadas las firmas, falta el R.M. Está fuera" }),
];

// --- Alevín B ---------------------------------------------------------
const nuevosAlevinB = [
  jugador("Adriano Alvarado Tapia", "Alevín B"),
  jugador("Lucas Archelós Jaime", "Alevín B"),
  jugador("Thomas Arevalo Gereda", "Alevín B"),
  jugador("Taha Meriouli Dris", "Alevín B"),
  jugador("Sebastián Ignacio Prieto Vidal", "Alevín B"),
  jugador("Bruno Stoyan Samaniego Samaniego", "Alevín B"),
  jugador("Mohammed Ali Zeddouri", "Alevín B"),
  jugador("Eylan Fabregat Turón", "Alevín B", { estado: "sin_ficha", notas: "Falta R.M. y enviar a federación" }),
  jugador("Mathias Mijares Bonalde", "Alevín B", { estado: "sin_ficha", notas: "Falta R.M. En marcha, espera certificado de escolaridad en septiembre" }),
  jugador("Felipe Pagella", "Alevín B", { estado: "sin_ficha", notas: "Ha hecho el R.M. Espera certificado de escolaridad en septiembre" }),
  jugador("Hugo Muñoz Luque", "Alevín B", { estado: "sin_ficha", notas: "Falta R.M. y enviar a federación" }),
  jugador("Alejandro Uribe", "Alevín B", { estado: "sin_ficha", notas: "No ha contestado" }),
];

// --- Benjamín A ---------------------------------------------------------
const nuevosBenjaminA = [
  jugador("Antonio Barreda Huamán", "Benjamín A"),
  jugador("Eric Boniche Cerdá", "Benjamín A"),
  jugador("Alvaro Cobo Gordillo", "Benjamín A"),
  jugador("Sergio Escrig Clarós", "Benjamín A"),
  jugador("Alex Gómez Mateu", "Benjamín A"),
  jugador("Neyzan Gutierrez Muñoz", "Benjamín A"),
  jugador("Riyad Marfak", "Benjamín A"),
  jugador("Jon Martínez Martínez", "Benjamín A"),
  jugador("Víctor Ortega Roncero", "Benjamín A"),
  jugador("Daniil Safronov", "Benjamín A"),
  jugador("Dominic Valentín Secelean", "Benjamín A"),
  jugador("Dylan Delgado Gonzalo", "Benjamín A"),
  jugador("Martín Pinedo Hernández", "Benjamín A"),
  jugador("Deivi José Palencia Heredia", "Benjamín A", { estado: "sin_ficha", notas: "Falta documentación, no contesta" }),
];

// --- Prebenjamín ---------------------------------------------------------
const nuevosPrebenjamin = [
  jugador("Jesé Selma Jiménez", "Prebenjamín"),
  jugador("Manuel Tonda Hernández", "Prebenjamín"),
  jugador("Saulo García Callejas", "Prebenjamín"),
  jugador("Josué Pueyo Escudero", "Prebenjamín", { estado: "sin_ficha", notas: "Documentación parcial" }),
  jugador("Ángel Hernández Jiménez", "Prebenjamín", { estado: "sin_ficha", notas: "Falta R.M. y enviar licencia a la FFCV" }),
  jugador("Dylan Iordan Valentín", "Prebenjamín", { estado: "sin_ficha", notas: "Falta documentación" }),
  jugador("Lucas Barbi", "Prebenjamín", { estado: "sin_ficha", notas: "Sin responder" }),
  jugador("José Alejandro", "Prebenjamín", { estado: "sin_ficha", notas: "Sin responder" }),
];

const norm = (s) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

async function main() {
  console.log("Leyendo Banco de Jugadores actual...");
  const snap = await getDoc(doc(db, PREFIX + "_config", "banco_jugadores"));
  const bancoActual = snap.exists() ? (snap.data().jugadores || []) : [];

  fs.writeFileSync("backup-antes-de-importar-banco-4.json", JSON.stringify(bancoActual, null, 2));
  console.log("Copia de seguridad guardada en backup-antes-de-importar-banco-4.json");

  const existentes = new Set(bancoActual.map(j => norm(j.nombre)));
  const todosNuevos = [...nuevosAlevinA, ...nuevosAlevinB, ...nuevosBenjaminA, ...nuevosPrebenjamin];
  const aAnadir = todosNuevos.filter(j => !existentes.has(norm(j.nombre)));
  const saltados = todosNuevos.filter(j => existentes.has(norm(j.nombre)));

  const bancoNuevo = [...bancoActual, ...aAnadir];

  console.log(`\nBanco de Jugadores: ${bancoActual.length} -> ${bancoNuevo.length} jugadores (+${aAnadir.length})`);
  if (saltados.length > 0) {
    console.log(`Ya existían, no se han duplicado (${saltados.length}): ${saltados.map(j => j.nombre).join(", ")}`);
  }

  console.log("\nGuardando...");
  await setDoc(doc(db, PREFIX + "_config", "banco_jugadores"), { jugadores: bancoNuevo });
  console.log("Hecho. Revisa el Banco de Jugadores en la app — filtra por equipo para verlos.");
}

main().catch((e) => {
  console.error("Error al importar:", e.message);
  console.error("No se ha modificado nada si el error ha sido al leer o antes de guardar.");
  process.exit(1);
});
