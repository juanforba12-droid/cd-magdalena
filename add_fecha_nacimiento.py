import re

with open("src/App.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# ─── 1. PLANTILLA OFICIAL ───────────────────────────────────────────────────

# 1a. Añadir useState después de const [dni, setDni] = useState(""); (primera ocurrencia)
content = content.replace(
    '  const [dni, setDni] = useState("");\n  const [statsPlayer, setStatsPlayer] = useState(null);',
    '  const [dni, setDni] = useState("");\n  const [fechaNacimiento, setFechaNacimiento] = useState("");\n  const [statsPlayer, setStatsPlayer] = useState(null);',
    1  # solo primera ocurrencia
)

# 1b. Inicializar en open() - primera ocurrencia
content = content.replace(
    '    setDni(p ? (p.dni || "") : "");\n    setShowForm(true);\n  };\n\n  const save = () => {\n    if (!name.trim()) return;\n    const players = [...(data.players || [])];',
    '    setDni(p ? (p.dni || "") : "");\n    setFechaNacimiento(p ? (p.fechaNacimiento || "") : "");\n    setShowForm(true);\n  };\n\n  const save = () => {\n    if (!name.trim()) return;\n    const players = [...(data.players || [])];',
    1
)

# 1c. Incluir en playerData de save() - primera ocurrencia
content = content.replace(
    '    const playerData = { name, dorsal, positions, posicionPrincipal, ...(isCoord ? { telefono, dni } : {}) };',
    '    const playerData = { name, dorsal, positions, posicionPrincipal, ...(isCoord ? { telefono, dni, fechaNacimiento } : {}) };',
    1
)

# 1d. Añadir Input en el formulario JSX - después del campo DNI (primera ocurrencia)
content = content.replace(
    '              <Input label="DNI" value={dni} onChange={e => setDni(e.target.value)} />\n',
    '              <Input label="DNI" value={dni} onChange={e => setDni(e.target.value)} />\n              <Input label="Fecha de nacimiento" type="date" value={fechaNacimiento} onChange={e => setFechaNacimiento(e.target.value)} />\n',
    1
)

# ─── 2. PROBANDO ────────────────────────────────────────────────────────────

# 2a. Añadir useState en ProbandoContent después de const [dni, setDni]
content = content.replace(
    '  const [dni, setDni] = useState("");\n  const [fechaPrueba, setFechaPrueba] = useState(',
    '  const [dni, setDni] = useState("");\n  const [fechaNacimiento, setFechaNacimiento] = useState("");\n  const [fechaPrueba, setFechaPrueba] = useState(',
    1
)

# 2b. Inicializar en open() de ProbandoContent
content = content.replace(
    '    setDni(p ? (p.dni || "") : "");\n    setFechaPrueba(p ? (p.fechaPrueba ||',
    '    setDni(p ? (p.dni || "") : "");\n    setFechaNacimiento(p ? (p.fechaNacimiento || "") : "");\n    setFechaPrueba(p ? (p.fechaPrueba ||',
    1
)

# 2c. Incluir en playerData de ProbandoContent
content = content.replace(
    '    const playerData = { name, dorsal, positions, posicionPrincipal, telefono, dni, fechaPrueba, estadoPrueba, notas };',
    '    const playerData = { name, dorsal, positions, posicionPrincipal, telefono, dni, fechaNacimiento, fechaPrueba, estadoPrueba, notas };',
    1
)

# 2d. Añadir Input en formulario Probando - después de DNI (segunda ocurrencia del bloque dni)
# Buscamos el bloque específico de Probando que tiene fechaPrueba cerca
content = content.replace(
    '            <Input label="Teléfono" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />\n            <Input label="DNI" value={dni} onChange={e => setDni(e.target.value)} />\n',
    '            <Input label="Teléfono" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />\n            <Input label="DNI" value={dni} onChange={e => setDni(e.target.value)} />\n            <Input label="Fecha de nacimiento" type="date" value={fechaNacimiento} onChange={e => setFechaNacimiento(e.target.value)} />\n',
    1
)

with open("src/App.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("✅ fechaNacimiento añadido en Plantilla oficial y Probando")

# Verificación
count = content.count("fechaNacimiento")
print(f"   Ocurrencias de fechaNacimiento en el archivo: {count} (esperadas ~10)")
