// Importa jugadores de Juvenil B y Cadete al BANCO DE JUGADORES
// (cdmagdalena_config/banco_jugadores), a partir de
// "ACTUALIZACION LICENCIAS 13-08". Esta vez al sitio correcto — el script
// anterior (import-jugadores-2.js) los metió por error en la Plantilla de
// esos equipos, no en el Banco.
//
// USO (desde la terminal de Codespaces, en la raíz del proyecto):
//   node import-banco-3.js
//
// Qué hace:
//   1. Lee el Banco de Jugadores actual (no toca nada todavía)
//   2. Guarda una copia de seguridad en backup-antes-de-importar-banco.json
//   3. Compara por nombre con quien YA está en el Banco, y SOLO añade los
//      que todavía no están (evita duplicados)
//   4. Cada jugador lleva su "Equipo de origen" puesto (Juvenil B / Cadete)
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

// Formato de jugador del Banco (nombres de campo en español, distinto del
// formato de la Plantilla).
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

// --- Juvenil B --------------------------------------------------------
const nuevosJuvenilB = [
  jugador("Ziad El Malky El Carrouni", "Juvenil B"),
  jugador("Luis Adriano Ibarra Avalos", "Juvenil B"),
  jugador("Juan Enrique Jarque González", "Juvenil B"),
  jugador("Mario Navarro Fababuj", "Juvenil B"),
  jugador("Mohamed Anes Rahmi", "Juvenil B"),
  jugador("Alex Ramos Campinas", "Juvenil B"),
  jugador("Pedro Ros de Camargo", "Juvenil B"),
  jugador("Rafael Socaciu", "Juvenil B"),
  jugador("José Vte Ariza Valcarcel", "Juvenil B"),
  jugador("César Alfredo Peña Gual", "Juvenil B"),
  jugador("Santiago Serra Vinuesa", "Juvenil B"),
  jugador("Messina Okatta Ofonbamu", "Juvenil B"),
  jugador("Rayan Ben Younes Samadi", "Juvenil B", { estado: "sin_ficha", notas: "Preparada, a falta de la firma para enviar a la FFCV" }),
  jugador("Mehdi Galleze", "Juvenil B", { estado: "sin_ficha", notas: "Preparada, a falta de la firma para enviar a la FFCV" }),
  jugador("Eric Valcarcel Capuz", "Juvenil B", { estado: "sin_ficha", notas: "Falta R.M. y enviar a federación" }),
  jugador("Saul Enrique Moreno Maso", "Juvenil B", { estado: "sin_ficha", notas: "Falta casi toda la documentación" }),
];

// --- Cadete -------------------------------------------------------------
const nuevosCadete = [
  jugador("Pablo Alanga Agudo", "Cadete"),
  jugador("Gerard Burdeus Agut", "Cadete"),
  jugador("Lucas Galindo Salazar", "Cadete"),
  jugador("Leonardo Andrei Ghinea", "Cadete"),
  jugador("Sergio Herrera Salazar", "Cadete"),
  jugador("Mohamed Yassin Marfak", "Cadete"),
  jugador("Mihai Adrián Matei", "Cadete"),
  jugador("Adrián Villasana Fonseca", "Cadete"),
  jugador("Alvaro Villasana Fonseca", "Cadete"),
  jugador("Ramzy Zerkak", "Cadete"),
  jugador("David Nicolae Mirita", "Cadete"),
  jugador("Carlos Nieves Benlloch", "Cadete"),
  jugador("Juan Esteban Valero Gómez", "Cadete"),
  jugador("Matías González Cabra", "Cadete"),
  jugador("Jhoneykeer Steek Romero Castillo", "Cadete"),
  jugador("Alejandro Giménez Beltrán", "Cadete", { estado: "sin_ficha", notas: "Falta foto y firmas. Falta R.M. y aprobación federación" }),
  jugador("Daniel Ruíz Sánchez", "Cadete", { estado: "sin_ficha", notas: "Preparada, a falta de la firma para enviar a la FFCV" }),
  jugador("Anwar Zene Jariri", "Cadete", { estado: "sin_ficha", notas: "Falta R.M. (fuera de España) y aprobación federación" }),
  jugador("Diego Mathias Krug Guzmán", "Cadete", { estado: "sin_ficha", notas: "En Alemania. Firma y foto nueva a la vuelta. Preparada, enviar a la FFCV" }),
  jugador("Julián Santiago", "Cadete", { estado: "sin_ficha", notas: "El móvil es cuenta de empresa, no ha respondido" }),
];

const norm = (s) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

async function main() {
  console.log("Leyendo Banco de Jugadores actual...");
  const snap = await getDoc(doc(db, PREFIX + "_config", "banco_jugadores"));
  const bancoActual = snap.exists() ? (snap.data().jugadores || []) : [];

  fs.writeFileSync("backup-antes-de-importar-banco.json", JSON.stringify(bancoActual, null, 2));
  console.log("Copia de seguridad guardada en backup-antes-de-importar-banco.json");

  const existentes = new Set(bancoActual.map(j => norm(j.nombre)));
  const todosNuevos = [...nuevosJuvenilB, ...nuevosCadete];
  const aAnadir = todosNuevos.filter(j => !existentes.has(norm(j.nombre)));
  const saltados = todosNuevos.filter(j => existentes.has(norm(j.nombre)));

  const bancoNuevo = [...bancoActual, ...aAnadir];

  console.log(`\nBanco de Jugadores: ${bancoActual.length} -> ${bancoNuevo.length} jugadores (+${aAnadir.length})`);
  if (saltados.length > 0) {
    console.log(`Ya existían, no se han duplicado (${saltados.length}): ${saltados.map(j => j.nombre).join(", ")}`);
  }

  console.log("\nGuardando...");
  await setDoc(doc(db, PREFIX + "_config", "banco_jugadores"), { jugadores: bancoNuevo });
  console.log("Hecho. Revisa el Banco de Jugadores en la app — filtra por 'Juvenil B' o 'Cadete' para verlos.");
}

main().catch((e) => {
  console.error("Error al importar:", e.message);
  console.error("No se ha modificado nada si el error ha sido al leer o antes de guardar.");
  process.exit(1);
});
