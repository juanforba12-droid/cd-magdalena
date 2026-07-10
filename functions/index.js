const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

exports.enviarPush = onDocumentCreated("avisosPush/{id}", async (event) => {
  const aviso = event.data.data();
  const db = admin.firestore();

  const snap = await db.collection("pushTokens").where("clubId", "==", aviso.clubId || "magdalena").get();

  let docs = snap.docs;
  if (aviso.destino && aviso.destino !== "todos") {
    docs = docs.filter(d => {
      const t = d.data();
      return t.equipo === aviso.destino || t.rol === "coordinador";
    });
  }
  const tokens = [...new Set(docs.map(d => d.data().token).filter(Boolean))];
  if (!tokens.length) { console.log("Sin tokens para", aviso.destino); return; }

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: aviso.titulo, body: aviso.mensaje },
    webpush: {
      fcmOptions: { link: "https://cd-magdalena.vercel.app" },
      notification: { icon: "/pwa-192.png" },
    },
  });
  console.log("Enviadas:", res.successCount, "· Fallidas:", res.failureCount);

  const invalidos = [];
  res.responses.forEach((r, i) => {
    if (!r.success && String(r.error?.code || "").includes("registration-token")) invalidos.push(tokens[i]);
  });
  await Promise.all(invalidos.map(t => db.collection("pushTokens").doc(t).delete()));
});
