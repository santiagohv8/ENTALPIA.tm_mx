
import sqlite3
import pandas as pd
import os

# =====================================
# 1. RUTAS DE LOS ARCHIVOS
# =====================================

ruta = os.path.dirname(os.path.abspath(__file__))

archivo_csv = os.path.join(ruta, "incendios_modelo.csv")
archivo_db = os.path.join(ruta, "incendios.db")


# =====================================
# 2. CONECTAR A LA BASE DE DATOS
# =====================================

conexion = sqlite3.connect(archivo_db)

cursor = conexion.cursor()

print("Conectado a la base de datos.")


# =====================================
# 3. CREAR TABLA
# =====================================

cursor.execute("""
CREATE TABLE IF NOT EXISTS Incendios (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    latitude REAL NOT NULL,
    longitude REAL NOT NULL,

    bright_ti4 REAL,
    bright_ti5 REAL,

    scan REAL,
    track REAL,

    frp REAL,

    daynight INTEGER,

    Incendio INTEGER NOT NULL

)
""")


# =====================================
# 4. LEER ARCHIVO CSV
# =====================================

df = pd.read_csv(archivo_csv)

# Eliminar registros incompletos
df = df.dropna()


# =====================================
# 5. INSERTAR DATOS
# =====================================

cursor.execute("""
CREATE UNIQUE INDEX IF NOT EXISTS indice_detecciones
ON Incendios (
    latitude,
    longitude,
    bright_ti4,
    bright_ti5,
    scan,
    track,
    frp,
    daynight,
    Incendio
)
""")

consulta = """
INSERT OR IGNORE INTO Incendios (
    latitude,
    longitude,
    bright_ti4,
    bright_ti5,
    scan,
    track,
    frp,
    daynight,
    Incendio
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

datos = [
    tuple(fila)
    for fila in df[[
        "latitude",
        "longitude",
        "bright_ti4",
        "bright_ti5",
        "scan",
        "track",
        "frp",
        "daynight",
        "Incendio"
    ]].values
]

cursor.executemany(consulta, datos)

conexion.commit()


# =====================================
# 6. CONSULTAR REGISTROS
# =====================================

cursor.execute("SELECT COUNT(*) FROM Incendios")

cantidad = cursor.fetchone()[0]

print("\nBase de datos actualizada.")
print("Registros almacenados:", cantidad)


# =====================================
# 7. MOSTRAR ALGUNOS REGISTROS
# =====================================

cursor.execute("""
SELECT *
FROM Incendios
LIMIT 5
""")

registros = cursor.fetchall()

print("\nPrimeros registros:")

for registro in registros:
    print(registro)


# =====================================
# 8. CERRAR CONEXIÓN
# =====================================

conexion.close()

print("\nConexión cerrada.")
