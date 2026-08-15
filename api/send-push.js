const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });
  try {
    const { titulo, mensaje, destino, tipo, clubId } = req.body || {};
    if (!titulo || !mensaje) return res.status(400).json({ error: "Faltan datos" });

    const db = admin.firestore();
    const snap = await db.collection("pushTokens").where("clubId", "==", clubId || "magdalena").get();

    let docs = snap.docs;
    if (destino === "coordinadores") {
      docs = docs.filter(d => d.data().rol === "coordinador");
    } else if (destino && destino !== "todos") {
      docs = docs.filter(d => {
        const t = d.data();
        return (t.equipos || []).includes(destino) || t.rol === "coordinador";
      });
    }
    // Respetar las preferencias de "Mis notificaciones" de cada dispositivo
    // para este equipo en concreto (noticias / partidos). Si no hay
    // preferencia guardada, se manda igualmente (activado por defecto).
    if (tipo && tipo !== "general" && destino && destino !== "todos" && destino !== "coordinadores") {
      docs = docs.filter(d => {
        const t = d.data();
        if (t.rol === "coordinador") return true; // coordinación siempre recibe todo
        const pref = t.prefs?.[destino]?.[tipo];
        return pref !== false;
      });
    }
    const tokens = [...new Set(docs.map(d => d.data().token).filter(Boolean))];
    if (!tokens.length) return res.status(200).json({ ok: true, enviadas: 0 });

    const r = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: titulo, body: mensaje },
      webpush: {
        fcmOptions: { link: "https://cd-magdalena.vercel.app" },
        notification: { icon: "/pwa-192.png" },
      },
    });

    const invalidos = [];
    r.responses.forEach((x, i) => {
      if (!x.success && String(x.error?.code || "").includes("registration-token")) invalidos.push(tokens[i]);
    });
    await Promise.all(invalidos.map(t => db.collection("pushTokens").doc(t).delete()));

    return res.status(200).json({ ok: true, enviadas: r.successCount, fallidas: r.failureCount });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
