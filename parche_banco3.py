# Parche: filtro por uno o varios equipos en el Banco de Jugadores
# Uso: python3 parche_banco3.py  (desde la raiz del repo)

with open('src/App.jsx', 'r') as f:
    src = f.read()

# 1. Estado del filtro de equipos
anchor_state = 'const [seleccion, setSeleccion] = React.useState([]);'
assert anchor_state in src, "No encontrado: estado seleccion"
src = src.replace(anchor_state, anchor_state + '''
  const [equiposFiltro, setEquiposFiltro] = React.useState([]);
  const toggleEquipoFiltro = (eq) => setEquiposFiltro(s => s.includes(eq) ? s.filter(x => x !== eq) : [...s, eq]);''', 1)

# 2. Aplicar el filtro a la lista
anchor_map = '{jugadoresFiltrados.map(j => ('
assert anchor_map in src, "No encontrado: map de jugadoresFiltrados"
src = src.replace(anchor_map, '{jugadoresFiltrados.filter(j => equiposFiltro.length === 0 || equiposFiltro.includes(j.equipoOrigen || "Sin equipo")).map(j => (', 1)

# 3. Pastillas de equipos encima de la lista
pills = '''        {(() => {
          const equiposDisponibles = [...new Set(jugadores.map(j => j.equipoOrigen || "Sin equipo"))].sort();
          if (equiposDisponibles.length <= 1) return null;
          return (
            <div className="mb-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Filtrar por equipo{equiposFiltro.length > 0 ? ` (${equiposFiltro.length})` : ""}</p>
              <div className="flex flex-wrap gap-1.5">
                {equiposDisponibles.map(eq => (
                  <button key={eq} onClick={() => toggleEquipoFiltro(eq)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${equiposFiltro.includes(eq) ? "bg-red-700 border-red-500 text-white font-semibold" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
                    {eq}
                  </button>
                ))}
                {equiposFiltro.length > 0 && (
                  <button onClick={() => setEquiposFiltro([])}
                    className="text-xs px-3 py-1.5 rounded-full border border-zinc-600 text-zinc-300 hover:text-white transition-all">
                    \u2715 Quitar filtro
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        '''
anchor_list = '{jugadoresFiltrados.filter(j => equiposFiltro.length === 0'
assert anchor_list in src, "No encontrado: lista filtrada"
src = src.replace(anchor_list, pills + anchor_list, 1)

with open('src/App.jsx', 'w') as f:
    f.write(src)
print("OK: filtro multi-equipo en el banco aplicado")
