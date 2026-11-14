
import pandas as pd
import folium
from folium.plugins import MarkerCluster

import os

# Carpeta donde está este script (así funciona desde cualquier terminal)
ruta = os.path.dirname(os.path.abspath(__file__))

# =====================================
# 1. CARGAR DATOS
# =====================================

df = pd.read_csv(os.path.join(ruta, "incendios_modelo.csv"))

df = df.dropna(subset=["latitude", "longitude", "Incendio"])

# =====================================
# 2. CREAR MAPA
# =====================================

centro = [
    df["latitude"].mean(),
    df["longitude"].mean()
]

# OpenStreetMap y CARTO bloquean los mapas abiertos como archivo
# local (file:///C:/...). Por eso el mapa base principal es de Esri,
# que no pide clave. Las direcciones se escriben directamente para
# que funcione con cualquier versión de folium.
mapa = folium.Map(
    location=centro,
    zoom_start=5,
    tiles=None
)

folium.TileLayer(
    tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attr="Tiles &copy; Esri",
    name="Calles (Esri)"
).add_to(mapa)

folium.TileLayer(
    tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr="Tiles &copy; Esri",
    name="Satélite (Esri)",
    show=False
).add_to(mapa)

# Solo funciona si el mapa se abre desde login.py (servidor local)
folium.TileLayer(
    tiles="OpenStreetMap",
    name="OpenStreetMap",
    show=False
).add_to(mapa)

# Agrupar marcadores para mejorar el rendimiento
marcadores = MarkerCluster().add_to(mapa)

# =====================================
# 3. AGREGAR DETECCIONES
# =====================================

for _, fila in df.iterrows():

    if int(fila["Incendio"]) == 1:
        color = "green"
        confianza = "Nominal o alta"
    else:
        color = "red"
        confianza = "Baja"

    popup = f"""
    <b>Clasificación:</b> {confianza}<br>
    <b>Latitud:</b> {fila['latitude']:.2f}<br>
    <b>Longitud:</b> {fila['longitude']:.2f}<br>
    <b>Temperatura TI4:</b> {fila['bright_ti4']:.2f}<br>
    <b>Temperatura TI5:</b> {fila['bright_ti5']:.2f}<br>
    <b>FRP:</b> {fila['frp']:.2f}
    """

    folium.CircleMarker(
        location=[
            fila["latitude"],
            fila["longitude"]
        ],
        radius=5,
        color=color,
        fill=True,
        fill_color=color,
        fill_opacity=0.75,
        popup=folium.Popup(popup, max_width=250)
    ).add_to(marcadores)

# =====================================
# 4. GUARDAR MAPA
# =====================================

folium.LayerControl().add_to(mapa)

mapa.save(os.path.join(ruta, "mapa_incendios.html"))

print("Mapa generado: mapa_incendios.html")
