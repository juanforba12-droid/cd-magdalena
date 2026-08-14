// Importa jugadores de Juvenil B y Cadete al documento cdmagdalena/main,
// a partir de "ACTUALIZACION LICENCIAS 13-08".
//
// USO (desde la terminal de Codespaces, en la raíz del proyecto):
//   node import-jugadores-2.js
//
// Qué hace:
//   1. Lee el documento actual completo (no toca nada todavía)
//   2. Guarda una copia de seguridad en backup-antes-de-importar-2.json
//   3. Compara por nombre con los jugadores que YA hay en cada equipo, y
//      SOLO añade los que todavía no están (evita duplicados)
//   4. Los jugadores marcados "LICENCIAS PENDIENTES" en el PDF se añaden
//      con estado "Sin ficha"
//   5. Imprime un resumen de antes/después y de a quién se ha saltado por
//      estar ya metido
//   6. Guarda el resultado
//
// No hay teléfono en el documento origen, así que se importan solo con
// nombre (y estado, para los pendientes de licencia).

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

// --- Juvenil B --------------------------------------------------------
const nuevosJuvenilB = [
  // Licencia tramitada
  jugador("Ziad El Malky El Carrouni"),
  jugador("Luis Adriano Ibarra Avalos"),
  jugador("Juan Enrique Jarque González"),
  jugador("Mario Navarro Fababuj"),
  jugador("Mohamed Anes Rahmi"),
  jugador("Alex Ramos Campinas"),
  jugador("Pedro Ros de Camargo"),
  jugador("Rafael Socaciu"),
  jugador("José Vte Ariza Valcarcel"),
  jugador("César Alfredo Peña Gual"),
  jugador("Santiago Serra Vinuesa"),
  jugador("Messina Okatta Ofonbamu"),
  // Licencias pendientes -> Sin ficha
  jugador("Rayan Ben Younes Samadi", { status: "sin_ficha" }),
  jugador("Mehdi Galleze", { status: "sin_ficha" }),
  jugador("Eric Valcarcel Capuz", { status: "sin_ficha" }),
  jugador("Saul Enrique Moreno Maso", { status: "sin_ficha" }),
];

// --- Cadete -------------------------------------------------------------
const nuevosCadete = [
  // Licencia tramitada
  jugador("Pablo Alanga Agudo"),
  jugador("Gerard Burdeus Agut"),
  jugador("Lucas Galindo Salazar"),
  jugador("Leonardo Andrei Ghinea"),
  jugador("Sergio Herrera Salazar"),
  jugador("Mohamed Yassin Marfak"),
  jugador("Mihai Adrián Matei"),
  jugador("Adrián Villasana Fonseca"),
  jugador("Alvaro Villasana Fonseca"),
  jugador("Ramzy Zerkak"),
  jugador("David Nicolae Mirita"),
  jugador("Carlos Nieves Benlloch"),
  jugador("Juan Esteban Valero Gómez"),
  jugador("Matías González Cabra"),
  jugador("Jhoneykeer Steek Romero Castillo"),
  // Licencias pendientes -> Sin ficha
  jugador("Alejandro Giménez Beltrán", { status: "sin_ficha" }),
  jugador("Daniel Ruíz Sánchez", { status: "sin_ficha" }),
  jugador("Anwar Zene Jariri", { status: "sin_ficha" }),
  jugador("Diego Mathias Krug Guzmán", { status: "sin_ficha" }),
  jugador("Julián Santiago", { status: "sin_ficha" }),
];

const norm = (s) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

async function main() {
  console.log("Leyendo datos actuales...");
  const snap = await getDoc(doc(db, "cdmagdalena", "main"));
  if (!snap.exists()) {
    console.error("No se ha encontrado el documento cdmagdalena/main. Nada que hacer.");
    process.exit(1);
  }
  const dataActual = JSON.parse(snap.data().json);

  fs.writeFileSync("backup-antes-de-importar-2.json", JSON.stringify(dataActual, null, 2));
  console.log("Copia de seguridad guardada en backup-antes-de-importar-2.json");

  const equipos = [
    { nombre: "Juvenil B", nuevos: nuevosJuvenilB },
    { nombre: "Cadete", nuevos: nuevosCadete },
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
  await setDoc(doc(db, "cdmagdalena", "main"), { json: JSON.stringify(dataActual) });
  console.log("Hecho. Revisa la Plantilla de Juvenil B y Cadete en la app.");
}

main().catch((e) => {
  console.error("Error al importar:", e.message);
  console.error("No se ha modificado nada si el error ha sido al leer o antes de guardar.");
  process.exit(1);
});
