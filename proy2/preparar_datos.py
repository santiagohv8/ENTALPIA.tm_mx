
import pandas as pd

import os

# Carpeta donde está este script (así funciona desde cualquier terminal)
ruta = os.path.dirname(os.path.abspath(__file__))

# =====================================
# 1. DESCARGAR DATOS
# =====================================

MAP_KEY = "8a910e22264bc8011260f0aa9a093dcd"

url = (
    f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
    f"{MAP_KEY}/VIIRS_NOAA21_NRT/"
    f"-118.4,14.5,-86.7,32.7/3"
)

print("Descargando datos...")

df = pd.read_csv(url)

if df.empty:
    print("No hay detecciones.")
    exit()

# =====================================
# 2. PROCESAR VARIABLES
# =====================================

df["confidence"] = df["confidence"].str.lower()

# =====================================
# 3. CREAR VARIABLE DEPENDIENTE
# =====================================

df["Incendio"] = df["confidence"].map({
    "h": 1,
    "n": 1,
    "l": 0
})

# Eliminar registros sin clasificación
df = df.dropna(subset=["Incendio"])

# =====================================
# 4. SELECCIONAR VARIABLES
# =====================================

datos = df[[
    "latitude",
    "longitude",
    "bright_ti4",
    "bright_ti5",
    "scan",
    "track",
    "frp",
    "daynight",
    "Incendio"
]].copy()

# Convertir día/noche en variable numérica
datos["daynight"] = datos["daynight"].map({
    "D": 1,
    "N": 0
})

datos = datos.dropna()

# =====================================
# 5. GUARDAR DATASET
# =====================================

datos.to_csv(os.path.join(ruta, "incendios_modelo.csv"), index=False)

print("\nDataset creado: incendios_modelo.csv")
print("\nPrimeros registros:")
print(datos.head())

print("\nDistribución:")
print(datos["Incendio"].value_counts())

print("\nPorcentajes:")
print(
    (datos["Incendio"].value_counts(normalize=True) * 100).round(2)
)
