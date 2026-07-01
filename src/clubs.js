export const CLUBS = [
  {
    id: "magdalena",
    nombre: "CD La Magdalena",
    nombreCorto: "La Magdalena",
    deporte: "Fútbol 11",
    ciudad: "Castellón de la Plana",
    color: "#111",
    colorAccent: "#dc2626",
    emoji: "⚽",
    firebaseConfig: {
      apiKey: "AIzaSyAnzUJZe1NQYbjWHeq1jqV2O118CDR0dBQ",
      authDomain: "cd-la-magdalena.firebaseapp.com",
      projectId: "cd-la-magdalena",
      storageBucket: "cd-la-magdalena.firebasestorage.app",
      messagingSenderId: "15940427840",
      appId: "1:15940427840:web:4e76b3c595b7394582ffa5"
    },
    firestorePrefix: "cdmagdalena",
    equipos: ["Escoleta","Prebenjamín","Benjamín C","Benjamín B","Benjamín A","Alevín B","Alevín A","Transición","Infantil B","Infantil A","Cadete","Juvenil"],
    passwords: {
      coordinador: "MGD2026",
      equipos: {
        "Escoleta":"KFW","Prebenjamín":"ZBN","Benjamín C":"TXR","Benjamín B":"PLH","Benjamín A":"DJV",
        "Alevín B":"WCQ","Alevín A":"NYS","Transición":"HQV","Infantil B":"RGK","Infantil A":"BTP",
        "Cadete":"XMJ","Juvenil":"FVL"
      }
    }
  },
  {
    id: "amics",
    nombre: "Amics Castelló BC",
    nombreCorto: "Amics Castelló",
    deporte: "Baloncesto",
    ciudad: "Castellón de la Plana",
    color: "#052e16",
    colorAccent: "#f97316",
    colorSecundario: "#16a34a",
    emoji: "🏀",
    firebaseConfig: {
      apiKey: "AIzaSyBXNq-oZDJfMLUY8C2zvv80o98N-ER-hKs",
      authDomain: "amics-castello-app.firebaseapp.com",
      projectId: "amics-castello-app",
      storageBucket: "amics-castello-app.firebasestorage.app",
      messagingSenderId: "803606875688",
      appId: "1:803606875688:web:bcb392a3005fb0f3f62f1d"
    },
    firestorePrefix: "amicscastello",
    equipos: ["Baby","Prebenjamín","Benjamín A","Benjamín B","Alevín A","Alevín B","Alevín C","Infantil A","Infantil B","Infantil C","Cadete A","Cadete B","Junior A","Junior B","Senior"],
    passwords: {
      coordinador: "AMICS2026",
      equipos: {
        "Baby":"BAB","Prebenjamín":"PRE","Benjamín A":"BJA","Benjamín B":"BJB",
        "Alevín A":"ALA","Alevín B":"ALB","Alevín C":"ALC",
        "Infantil A":"INA","Infantil B":"INB","Infantil C":"INC",
        "Cadete A":"CDA","Cadete B":"CDB","Junior A":"JNA","Junior B":"JNB","Senior":"SNR"
      }
    }
  }
,
  {
    id: "internacional",
    nombre: "Amics Castelló International",
    nombreCorto: "Amics International",
    deporte: "Baloncesto",
    ciudad: "Castellón de la Plana",
    color: "#052e16",
    colorAccent: "#f97316",
    colorSecundario: "#16a34a",
    emoji: "🌍",
    firebaseConfig: {
      apiKey: "AIzaSyCfxoAOo4E6bpfFe1N9_DkZvYl2yewijhI",
      authDomain: "academia-basket-app.firebaseapp.com",
      projectId: "academia-basket-app",
      storageBucket: "academia-basket-app.firebasestorage.app",
      messagingSenderId: "573776541077",
      appId: "1:573776541077:web:9da12db6d5c54dbcce329c"
    },
    firestorePrefix: "internacional",
    equipos: ["Sub-14","Sub-16","Sub-18","Senior"],
    passwords: {
      coordinador: "INTL2026",
      equipos: {
        "Sub-14":"S14","Sub-16":"S16","Sub-18":"S18","Senior":"SNR"
      }
    }
  }
];

export function getClub(id) {
  return CLUBS.find(c => c.id === id) || CLUBS[0];
}
// Sat Jun 27 21:53:48 UTC 2026
