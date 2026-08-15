// Se ejecuta periódicamente desde un servicio externo gratuito (cron-job.org
// o similar) — Vercel en el plan gratuito no permite programar tareas más
// frecuentes que una vez al día, así que esta ruta se llama desde fuera.
//
// Revisa todos los partidos de todos los equipos y manda un aviso a quien
// siga ese equipo cuando falta aproximadamente 1 hora para que empiece.
// Cada partido se marca como "ya avisado" para no repetir el aviso en la
// siguiente pasada.

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

function ahoraEnMadrid() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const partes = {};
  fmt.formatToParts(new Date()).forEach(p => { partes[p.type] = p.value; });
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    minutosDelDia: parseInt(partes.hour, 10) * 60 + parseInt(partes.minute, 10),
  };
}

module.exports = async (req, res) => {
  // Solo aceptamos la llamada si trae el secreto correcto, para que no
  // pueda disparar avisos cualquiera que encuentre la URL.
  const secreto = req.headers["x-cron-secret"] || req.query.secret;
  if (secreto !== process.env.CRON_SECRET) return res.status(401).json({ error: "No autorizado" });

  try {
    const db = admin.firestore();
    const snap = await db.collection("cdmagdalena").doc("main").get();
    if (!snap.exists) return res.status(200).json({ ok: true, avisados: 0, motivo: "sin datos" });

    const data = JSON.parse(snap.data().json);
    const { fecha: hoy, minutosDelDia: ahoraMin } = ahoraEnMadrid();
    let avisados = 0;
    let cambios = false;

    for (const equipo of Object.keys(data)) {
      const matches = data[equipo]?.matches;
      if (!Array.isArray(matches)) continue;

      for (const m of matches) {
        if (!m.hora || m.fecha !== hoy || m.notificado1h) continue;
        const [h, min] = m.hora.split(":").map(Number);
        const minutosPartido = h * 60 + min;
        const faltan = minutosPartido - ahoraMin;
        if (faltan >= 0 && faltan <= 70) {
          const tokensSnap = await db.collection("pushTokens").where("clubId", "==", "magdalena").get();
          const tokens = [...new Set(
            tokensSnap.docs
              .filter(d => (d.data().equipos || []).includes(equipo) || d.data().rol === "coordinador")
              .filter(d => {
                const t = d.data();
                if (t.rol === "coordinador") return true;
                return t.prefs?.[equipo]?.partidos !== false;
              })
              .map(d => d.data().token)
              .filter(Boolean)
          )];
          if (tokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
              tokens,
              notification: {
                title: "⏰ En 1 hora — " + equipo,
                body: "CD La Magdalena vs " + m.rival + (m.lugar ? " en " + m.lugar : ""),
              },
              webpush: {
                fcmOptions: { link: "https://cd-magdalena.vercel.app" },
                notification: { icon: "/pwa-192.png" },
              },
            });
            avisados++;
          }
          m.notificado1h = true;
          cambios = true;
        }
      }
    }

    if (cambios) {
      await db.collection("cdmagdalena").doc("main").set({ json: JSON.stringify(data) });
    }

    return res.status(200).json({ ok: true, avisados });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
