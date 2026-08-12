// Importa jugadores de Amateur y Juvenil A al documento cdmagdalena/main.
//
// USO (desde la terminal de Codespaces, en la raíz del proyecto):
//   node import-jugadores.js
//
// Qué hace:
//   1. Lee el documento actual completo (no toca nada todavía)
//   2. Guarda una copia de seguridad en backup-antes-de-importar.json
//   3. Añade los jugadores nuevos SOLO a Amateur y Juvenil A, sin tocar
//      entrenamientos, partidos, asistencia ni el resto de equipos
//   4. Imprime un resumen de antes/después
//   5. Guarda el resultado
//
// Si algo sale mal, el archivo de backup tiene el estado exacto de antes
// para poder restaurarlo a mano.

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

// Jugador vacío base: mismo formato que crea la app al añadir uno a mano.
const jugador = (name, telefono, extra = {}) => ({
  id: Date.now() + Math.floor(Math.random() * 100000),
  name,
  dorsal: "",
  positions: [],
  posicionPrincipal: "",
  telefono: telefono || "",
  dni: "",
  fechaNacimiento: "",
  ...extra,
});

// --- Amateur (del PDF "JUGADORE_F11-_3FFCV.pdf") -----------------------
// Fila sin nombre (solo teléfono 638496641) descartada.
const nuevosAmateur = [
  jugador("Sergi Catalán Martínez", "658743673"),
  jugador("Marc Julbe Arayo", "630859736"),
  jugador("Alejandro Selma Monserrat", "685396961"),
  jugador("Oscar Delgado Selma", "649204121"),
  jugador("Sergio Delgado Selma", "666726821"),
  jugador("Jorge Zamora Selma", ""),
  jugador("Hadj Merjouli Dris", "640764115"),
  jugador("Yanis Merjouli Dris", "614388978"),
  jugador("José Manuel Gutierro Felip", ""),
  jugador("Pablo Petre Cerdá", "643448736"),
  jugador("Aritz García Abascal", ""),
  jugador("Adrián Cervera Martínez", "620902434"),
  jugador("Pablo Marco Agustí", "691018926"),
  jugador("Adil Ennour Idrissi Lidueña", "631160073"),
  jugador("Pablo Aguirre Babiloni", "686778844"),
  jugador("Héctor Algarra Valero", "697458455"),
  jugador("Yones El Ghoufairi Sadik", "611143539"),
  // Estos 3 llevaban un asterisco (*) en el PDF original. Se marcan como
  // "sin ficha" por probable falta de documentación — revísalo, si el
  // asterisco significa otra cosa cámbialo en la app con dos toques.
  jugador("Pietro Pini", "607116673", { status: "sin_ficha" }),
  jugador("Bakary Sarr", "", { status: "sin_ficha" }),
  jugador("Fabián", "643134543", { status: "sin_ficha" }),
  jugador("Erik Agost Vidal", ""),
];

// --- Juvenil A (del PDF "JUGADORES_F11-_3FFCV_JUVENIL_A.pdf") ----------
// Filas totalmente vacías (solo "3FFCV JUVENIL A" sin nombre) descartadas.
// Una fila con solo teléfono (641853162, sin nombre) también descartada.
const nuevosJuvenilA = [
  jugador("Mohamed Bounouna Lahniche", "624643976"),
  jugador("Nathan Gabriell Herrman", "611668032"),
  jugador("Cristo Omojaide Okojie", "643928863"),
  // Tenía dos teléfonos (madre y "Josema"); se usa el primero, como pediste.
  jugador("José María Yima Muadakuku", "722317117"),
  jugador("Ángel Muñoz García", "642155369"),
  jugador("Unai Aymerich Rodríguez", ""),
];

async function main() {
  console.log("Leyendo datos actuales...");
  const snap = await getDoc(doc(db, "cdmagdalena", "main"));
  if (!snap.exists()) {
    console.error("No se ha encontrado el documento cdmagdalena/main. Nada que hacer.");
    process.exit(1);
  }
  const dataActual = JSON.parse(snap.data().json);

  fs.writeFileSync("backup-antes-de-importar.json", JSON.stringify(dataActual, null, 2));
  console.log("Copia de seguridad guardada en backup-antes-de-importar.json");

  const equipos = [
    { nombre: "Amateur", nuevos: nuevosAmateur },
    { nombre: "Juvenil A", nuevos: nuevosJuvenilA },
  ];

  for (const { nombre, nuevos } of equipos) {
    const actual = dataActual[nombre] || { players: [], trainings: [], matches: [], attendance: [] };
    const antes = (actual.players || []).length;
    actual.players = [...(actual.players || []), ...nuevos];
    dataActual[nombre] = actual;
    console.log(`${nombre}: ${antes} jugadores -> ${actual.players.length} jugadores (+${nuevos.length})`);
  }

  console.log("Guardando...");
  await setDoc(doc(db, "cdmagdalena", "main"), { json: JSON.stringify(dataActual) });
  console.log("Hecho. Revisa la Plantilla de Amateur y Juvenil A en la app.");
}

main().catch((e) => {
  console.error("Error al importar:", e.message);
  console.error("No se ha modificado nada si el error ha sido al leer o antes de guardar.");
  process.exit(1);
});
