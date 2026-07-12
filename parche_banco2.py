# Parche v2: seleccion multiple en el Banco de Jugadores
# Uso: python3 parche_banco2.py  (desde la raiz del repo)

with open('src/App.jsx', 'r') as f:
    src = f.read()

# 1. Estado de seleccion multiple
anchor_state = 'const [menuBanco, setMenuBanco] = React.useState(null);'
assert anchor_state in src, "No encontrado: estado menuBanco"
src = src.replace(anchor_state, anchor_state + '\n  const [seleccion, setSeleccion] = React.useState([]);\n  const toggleSel = (id) => setSeleccion(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);', 1)

# 2. Checkbox en cada fila
old_row = '''          <div key={j.id} onClick={() => setMenuBanco(j)}
            className="flex items-center gap-3 py-3 border-b border-zinc-800 last:border-0 cursor-pointer active:bg-zinc-800/50 transition-colors">
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">'''
assert old_row in src, "No encontrado: fila del banco"
new_row = '''          <div key={j.id} onClick={() => setMenuBanco(j)}
            className="flex items-center gap-3 py-3 border-b border-zinc-800 last:border-0 cursor-pointer active:bg-zinc-800/50 transition-colors">
            <input type="checkbox" checked={seleccion.includes(j.id)}
              onClick={e => e.stopPropagation()}
              onChange={() => toggleSel(j.id)}
              className="w-5 h-5 accent-red-600 shrink-0 cursor-pointer" />
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">'''
src = src.replace(old_row, new_row, 1)

# 3. Barra de acciones flotante
anchor_modal = '      {/* Ficha del jugador del banco */}'
assert anchor_modal in src, "No encontrado: ficha del banco"
barra = '''      {/* Barra de acciones de seleccion multiple */}
      {seleccion.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 inset-x-3 md:inset-x-auto md:right-6 z-50 bg-zinc-800 border border-zinc-600 rounded-2xl shadow-2xl p-3 flex items-center gap-2 flex-wrap md:max-w-md">
          <span className="text-white text-sm font-semibold px-1">{seleccion.length} seleccionado{seleccion.length > 1 ? "s" : ""}</span>
          <div className="flex gap-2 ml-auto">
            {onAddToEquipo && <Btn small onClick={() => {
              const elegidos = jugadores.filter(j => seleccion.includes(j.id));
              onAddToEquipo(elegidos);
              setSeleccion([]);
            }}>\u2795 Al equipo</Btn>}
            <Btn small variant="danger" onClick={() => {
              if (!window.confirm("\u00bfEliminar " + seleccion.length + " jugador(es) del banco?")) return;
              const restantes = jugadores.filter(j => !seleccion.includes(j.id));
              save(restantes);
              setSeleccion([]);
            }}>\U0001f5d1\ufe0f</Btn>
            <Btn small variant="ghost" onClick={() => setSeleccion([])}>\u2715</Btn>
          </div>
        </div>
      )}

'''
src = src.replace(anchor_modal, barra + anchor_modal, 1)

# 4. onAddToEquipo acepta lista
old_render = '''{tab === "banco" && isCoord && <BancoJugadoresSection clubActual={clubActual} onAddToEquipo={(j) => {
        if (!window.confirm("\u00bfA\u00f1adir a " + j.nombre + " a la plantilla de " + team + "?")) return;
        const yaEsta = (data.players || []).some(p => (p.name || "").toLowerCase() === (j.nombre || "").toLowerCase() || (j.dni && p.dni === j.dni));
        if (yaEsta) { alert(j.nombre + " ya est\u00e1 en la plantilla de " + team); return; }
        const nuevo = {
          id: Date.now(),
          name: j.nombre || "",
          dni: j.dni || "",
          telefono: j.telefono || "",
          posicionPrincipal: j.posicion || "",
          fechaNac: j.fechaNac || "",
          status: "disponible",
        };
        onSave({ ...data, players: [...(data.players || []), nuevo] });
        setTab("oficial");
      }} />}'''
assert old_render in src, "No encontrado: render banco con onAddToEquipo"
new_render = '''{tab === "banco" && isCoord && <BancoJugadoresSection clubActual={clubActual} onAddToEquipo={(js) => {
        const lista = Array.isArray(js) ? js : [js];
        if (!window.confirm("\u00bfA\u00f1adir " + (lista.length === 1 ? "a " + lista[0].nombre : lista.length + " jugadores") + " a la plantilla de " + team + "?")) return;
        const nuevos = [];
        const duplicados = [];
        lista.forEach((j, idx) => {
          const yaEsta = (data.players || []).some(p => (p.name || "").toLowerCase() === (j.nombre || "").toLowerCase() || (j.dni && p.dni === j.dni));
          if (yaEsta) { duplicados.push(j.nombre); return; }
          nuevos.push({
            id: Date.now() + idx,
            name: j.nombre || "",
            dni: j.dni || "",
            telefono: j.telefono || "",
            posicionPrincipal: j.posicion || "",
            fechaNac: j.fechaNac || "",
            status: "disponible",
          });
        });
        if (nuevos.length) onSave({ ...data, players: [...(data.players || []), ...nuevos] });
        if (duplicados.length) alert("Ya estaban en " + team + ": " + duplicados.join(", "));
        if (nuevos.length) setTab("oficial");
      }} />}'''
src = src.replace(old_render, new_render, 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("OK: seleccion multiple en el banco aplicada")
