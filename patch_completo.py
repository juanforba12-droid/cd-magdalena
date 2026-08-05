import sys

path = "src/App.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()


def apply(old, new, content):
    count = content.count(old)
    if count != 1:
        print(f"ERROR: se esperaba 1 coincidencia, se encontraron {count}")
        print(old[:150])
        sys.exit(1)
    return content.replace(old, new, 1)


edits = [
    # 1) Hook reutilizable para el botón "atrás" de Android
    (
        'const TEAMS = ["Escoleta", "Prebenjamín", "Benjamín C", "Benjamín B", "Benjamín A", "Alevín B", "Alevín A", "Transición", "Infantil B", "Infantil A", "Cadete", "Juvenil"];',
        'const TEAMS = ["Escoleta", "Prebenjamín", "Benjamín C", "Benjamín B", "Benjamín A", "Alevín B", "Alevín A", "Transición", "Infantil B", "Infantil A", "Cadete", "Juvenil"];\n'
        '\n'
        '// Hook reutilizable: mientras una pantalla a pantalla completa esté abierta,\n'
        '// intercepta el botón/gesto "atrás" de Android para que cierre SOLO esa\n'
        '// pantalla en vez de salir de toda la app. En iPhone no hace falta (no hay\n'
        '// gesto de "atrás" del sistema), así que ahí simplemente no actúa.\n'
        'function useCloseOnBack(abierto, onClose) {\n'
        '  const cerradoPorAtras = useRef(false);\n'
        '  useEffect(() => {\n'
        '    if (!abierto) return;\n'
        '    cerradoPorAtras.current = false;\n'
        '    window.history.pushState({ overlay: true }, "");\n'
        '    const handler = () => { cerradoPorAtras.current = true; onClose(); };\n'
        '    window.addEventListener("popstate", handler);\n'
        '    return () => {\n'
        '      window.removeEventListener("popstate", handler);\n'
        '      // Si se cerró con el botón "Cerrar" (no con "atrás"), quitamos la\n'
        '      // entrada de historial que habíamos añadido para no dejarla huérfana.\n'
        '      if (!cerradoPorAtras.current) window.history.back();\n'
        '    };\n'
        '    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo re-ejecutar al abrir/cerrar, no en cada render\n'
        '  }, [abierto]);\n'
        '}'
    ),
    # 2) Conectar el hook al visor de fichas PDF
    (
        '  const [fichaVisor, setFichaVisor] = useState(null);',
        '  const [fichaVisor, setFichaVisor] = useState(null);\n'
        '  useCloseOnBack(!!fichaVisor, () => { if (fichaVisor) { URL.revokeObjectURL(fichaVisor.blobUrl); setFichaVisor(null); } });'
    ),
    # 3) navigator.share: comprobar canShare para archivos, no solo share()
    (
        '              {navigator.share && (\n'
        '                <button onClick={async () => {\n'
        '                  try {\n'
        '                    const file = new File([fichaVisor.blob], fichaVisor.nombre, { type: "application/pdf" });\n'
        '                    await navigator.share({ files: [file], title: fichaVisor.nombre });\n'
        '                  } catch(e) { if (e.name !== "AbortError") alert("Error: " + e.message); }\n'
        '                }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white text-sm font-semibold">\n'
        '                  📤 Compartir\n'
        '                </button>\n'
        '              )}',

        '              {navigator.share && (\n'
        '                <button onClick={async () => {\n'
        '                  const file = new File([fichaVisor.blob], fichaVisor.nombre, { type: "application/pdf" });\n'
        '                  if (!navigator.canShare || !navigator.canShare({ files: [file] })) {\n'
        '                    alert("Este móvil no permite compartir archivos directamente.\\n\\nDescarga el PDF y compártelo desde tu galería o gestor de archivos.");\n'
        '                    return;\n'
        '                  }\n'
        '                  try {\n'
        '                    await navigator.share({ files: [file], title: fichaVisor.nombre });\n'
        '                  } catch(e) { if (e.name !== "AbortError") alert("No se ha podido compartir el archivo."); }\n'
        '                }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white text-sm font-semibold">\n'
        '                  📤 Compartir\n'
        '                </button>\n'
        '              )}'
    ),
    # 4) Pizarra: touch-action none para que dibujar/arrastrar no haga scroll en Android
    (
        '      <div ref={fieldRef} className="relative w-full rounded-xl overflow-hidden select-none pizarra-field"\n'
        '        style={{ paddingBottom:"65%", background:"#1a6b2e", cursor: tool==="pencil"?"crosshair":tool==="erase"?"cell":"crosshair" }}',

        '      <div ref={fieldRef} className="relative w-full rounded-xl overflow-hidden select-none pizarra-field"\n'
        '        style={{ paddingBottom:"65%", background:"#1a6b2e", cursor: tool==="pencil"?"crosshair":tool==="erase"?"cell":"crosshair", touchAction:"none" }}'
    ),
    # 5) Conectar el hook al editor de Tácticas Animadas
    (
        '  const [jugadores, setJugadores] = useState(tactica.jugadores.map(j => ({ ...j, tipo: j.tipo || "local" })));',
        '  const [jugadores, setJugadores] = useState(tactica.jugadores.map(j => ({ ...j, tipo: j.tipo || "local" })));\n'
        '  useCloseOnBack(true, onCancelar);'
    ),
    # 6) MP4: comprobar soporte real ANTES de arrancar, no solo que exista VideoEncoder
    (
        '    if (typeof VideoEncoder === "undefined") {\n'
        '      alert("Tu navegador no soporta grabación de vídeo MP4.\\n\\nUsa Chrome o Safari actualizados. Puedes usar el botón GIF como alternativa.");\n'
        '      return;\n'
        '    }\n'
        '\n'
        '    setGrabando(true);\n'
        '\n'
        '    // Canvas de alta resolución para renderizar (2x del canvas visible)\n'
        '    const SCALE = 2;\n'
        '    const W = FIELD_W * SCALE;\n'
        '    const H = FIELD_H * SCALE;\n'
        '    const FPS = 60;\n'
        '    const MS_POR_FRAME = 1000 / FPS;\n'
        '\n'
        '    // Canvas offscreen a 2x resolución',

        '    if (typeof VideoEncoder === "undefined") {\n'
        '      alert("Tu navegador no soporta grabación de vídeo MP4.\\n\\nUsa Chrome o Safari actualizados. Puedes usar el botón GIF como alternativa.");\n'
        '      return;\n'
        '    }\n'
        '\n'
        '    // Canvas de alta resolución para renderizar (2x del canvas visible)\n'
        '    const SCALE = 2;\n'
        '    const W = FIELD_W * SCALE;\n'
        '    const H = FIELD_H * SCALE;\n'
        '    const FPS = 60;\n'
        '    const MS_POR_FRAME = 1000 / FPS;\n'
        '\n'
        '    const CODEC_CONFIG = {\n'
        '      codec: "avc1.4d0028",  // H.264 Main Profile Level 4.0 — alta calidad\n'
        '      width: W,\n'
        '      height: H,\n'
        '      bitrate: 6_000_000,    // 6 Mbps — calidad alta\n'
        '      framerate: FPS,\n'
        '    };\n'
        '\n'
        '    // Muchos móviles Android (sobre todo gama media/baja) no soportan por\n'
        '    // hardware este códec/resolución. Comprobarlo ANTES de arrancar evita que\n'
        '    // "Exportando..." se quede colgado sin avisar al usuario.\n'
        '    try {\n'
        '      const soporte = await VideoEncoder.isConfigSupported(CODEC_CONFIG);\n'
        '      if (!soporte.supported) {\n'
        '        alert("Este móvil no puede grabar vídeo MP4 con esta calidad.\\n\\nUsa el botón GIF como alternativa.");\n'
        '        return;\n'
        '      }\n'
        '    } catch {\n'
        '      alert("Tu navegador no soporta grabación de vídeo MP4.\\n\\nUsa Chrome o Safari actualizados. Puedes usar el botón GIF como alternativa.");\n'
        '      return;\n'
        '    }\n'
        '\n'
        '    setGrabando(true);\n'
        '\n'
        '    // Canvas offscreen a 2x resolución'
    ),
    # 7) MP4: reutilizar CODEC_CONFIG en vez de repetirlo
    (
        '    encoder.configure({\n'
        '      codec: "avc1.4d0028",  // H.264 Main Profile Level 4.0 — alta calidad\n'
        '      width: W,\n'
        '      height: H,\n'
        '      bitrate: 6_000_000,    // 6 Mbps — calidad alta\n'
        '      framerate: FPS,\n'
        '    });',

        '    encoder.configure(CODEC_CONFIG);'
    ),
    # 8) MP4: abrir try alrededor de la codificación real (defensa extra)
    (
        '    const muxer = new Muxer({\n'
        '      target: new ArrayBufferTarget(),\n'
        '      video: { codec: "avc", width: W, height: H },\n'
        '      fastStart: "in-memory",\n'
        '    });',

        '    try {\n'
        '    const muxer = new Muxer({\n'
        '      target: new ArrayBufferTarget(),\n'
        '      video: { codec: "avc", width: W, height: H },\n'
        '      fastStart: "in-memory",\n'
        '    });'
    ),
    # 9) MP4: cerrar con catch/finally para que "grabando" nunca se quede colgado
    (
        '    // Redibujar canvas visible en posición inicial\n'
        '    const ctx = canvasRef.current.getContext("2d");\n'
        '    dibujarCampo(ctx);\n'
        '    dibujarJugadores(ctx, jugadores);\n'
        '    dibujarJugadores(ctx, rivales);\n'
        '    dibujarBalon(ctx, balon);\n'
        '    setGrabando(false);\n'
        '  };',

        '    } catch (e) {\n'
        '      console.error(e);\n'
        '      alert("No se ha podido exportar el vídeo en este móvil.\\n\\nUsa el botón GIF como alternativa.");\n'
        '    } finally {\n'
        '      // Redibujar canvas visible en posición inicial\n'
        '      const ctx = canvasRef.current.getContext("2d");\n'
        '      dibujarCampo(ctx);\n'
        '      dibujarJugadores(ctx, jugadores);\n'
        '      dibujarJugadores(ctx, rivales);\n'
        '      dibujarBalon(ctx, balon);\n'
        '      setGrabando(false);\n'
        '    }\n'
        '  };'
    ),
    # 10) Categorías: ResumenSection usa la lista real de equipos
    (
        'function ResumenSection({ db }) {\n'
        '  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0]);',

        'function ResumenSection({ db, teams = TEAMS }) {\n'
        '  const [selectedTeam, setSelectedTeam] = useState(teams[0]);'
    ),
    # 11) Categorías: selector de botones de ResumenSection
    (
        '      <div className="flex flex-wrap gap-2">\n'
        '        {TEAMS.map(t => (\n'
        '          <button key={t} onClick={() => setSelectedTeam(t)}\n'
        '            className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedTeam === t ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}\n'
        '          >{t}</button>\n'
        '        ))}\n'
        '      </div>\n'
        '\n'
        '      {/* Summary stats */}',

        '      <div className="flex flex-wrap gap-2">\n'
        '        {teams.map(t => (\n'
        '          <button key={t} onClick={() => setSelectedTeam(t)}\n'
        '            className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedTeam === t ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}\n'
        '          >{t}</button>\n'
        '        ))}\n'
        '      </div>\n'
        '\n'
        '      {/* Summary stats */}'
    ),
    # 12) Categorías: EntrenadoresSection usa la lista real de equipos
    (
        'function EntrenadoresSection({ db, onSaveTeam, coordProfile }) {\n'
        '  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0]);',

        'function EntrenadoresSection({ db, onSaveTeam, coordProfile, teams = TEAMS }) {\n'
        '  const [selectedTeam, setSelectedTeam] = useState(teams[0]);'
    ),
    # 13) Categorías: selector de botones de EntrenadoresSection
    (
        '      {/* Team selector */}\n'
        '      <div className="flex flex-wrap gap-2">\n'
        '        {TEAMS.map(t => (\n'
        '          <button key={t} onClick={() => setSelectedTeam(t)}\n'
        '            className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedTeam === t ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}\n'
        '          >{t}</button>\n'
        '        ))}',

        '      {/* Team selector */}\n'
        '      <div className="flex flex-wrap gap-2">\n'
        '        {teams.map(t => (\n'
        '          <button key={t} onClick={() => setSelectedTeam(t)}\n'
        '            className={`px-3 py-1.5 rounded text-sm border transition-all ${selectedTeam === t ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}\n'
        '          >{t}</button>\n'
        '        ))}'
    ),
    # 14) Categorías: pasar teams={teamsToUse} al renderizar ambas secciones
    (
        '            {activeSection === "resumen" && isCoord && (\n'
        '              <ResumenSection db={db} />\n'
        '            )}\n'
        '            {activeSection === "entrenadores" && isCoord && (\n'
        '              <EntrenadoresSection db={db} onSaveTeam={(team, data) => updateTeamData(team, data)} coordProfile={coordProfile} />\n'
        '            )}',

        '            {activeSection === "resumen" && isCoord && (\n'
        '              <ResumenSection db={db} teams={teamsToUse} />\n'
        '            )}\n'
        '            {activeSection === "entrenadores" && isCoord && (\n'
        '              <EntrenadoresSection db={db} onSaveTeam={(team, data) => updateTeamData(team, data)} coordProfile={coordProfile} teams={teamsToUse} />\n'
        '            )}'
    ),
]

for old, new in edits:
    content = apply(old, new, content)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Patch aplicado correctamente: {len(edits)} cambios.")
