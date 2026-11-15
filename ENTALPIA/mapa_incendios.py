
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

# Mapa oscuro por defecto, para combinar con la página web
folium.TileLayer(
    tiles="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attr="Tiles &copy; Esri",
    name="Oscuro (Esri)",
    max_zoom=16
).add_to(mapa)

folium.TileLayer(
    tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attr="Tiles &copy; Esri",
    name="Calles (Esri)",
    show=False
).add_to(mapa)

folium.TileLayer(
    tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr="Tiles &copy; Esri",
    name="Satélite (Esri)",
    show=False
).add_to(mapa)

# Solo funciona si el mapa se abre desde servidor.py (servidor local)
folium.TileLayer(
    tiles="OpenStreetMap",
    name="OpenStreetMap",
    show=False
).add_to(mapa)

# =====================================
# ESTILO (paleta de la página web)
# =====================================

COLOR_ALTA = "#00ff88"   # verde Entalpia
COLOR_BAJA = "#ff5c5c"

estilo = """
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
    body { background:#050505; }

    .leaflet-popup-content-wrapper {
        background:#0d0d0d;
        color:#ffffff;
        border:1px solid rgba(0,255,136,.25);
        border-radius:14px;
        box-shadow:0 10px 30px rgba(0,0,0,.6), 0 0 20px rgba(0,255,136,.08);
    }
    .leaflet-popup-tip { background:#0d0d0d; border:1px solid rgba(0,255,136,.25); }
    .leaflet-popup-content { margin:16px 18px; font-family:Inter, Arial, sans-serif; }
    .leaflet-container a.leaflet-popup-close-button { color:#b3b3b3; }
    .leaflet-container a.leaflet-popup-close-button:hover { color:#00ff88; }

    .ent-etiqueta {
        display:inline-block; margin-bottom:10px; padding:4px 10px;
        border-radius:20px; font-size:12px; font-weight:600;
    }
    .ent-alta { color:#00ff88; background:rgba(0,255,136,.1); border:1px solid rgba(0,255,136,.35); }
    .ent-baja { color:#ff8a8a; background:rgba(255,92,92,.1); border:1px solid rgba(255,92,92,.35); }

    .ent-popup table { border-collapse:collapse; font-size:13px; }
    .ent-popup td { padding:3px 0; }
    .ent-popup td:first-child { color:#b3b3b3; padding-right:16px; }
    .ent-popup td:last-child { text-align:right; font-weight:600; }

    .leaflet-control-layers {
        background:#0d0d0d !important; color:#ffffff;
        border:1px solid rgba(0,255,136,.25) !important; border-radius:12px !important;
    }
    .leaflet-bar a { background:#0d0d0d; color:#00ff88; border-color:rgba(0,255,136,.2); }
    .leaflet-bar a:hover { background:#121212; color:#00ff88; }
    .leaflet-control-attribution { background:rgba(5,5,5,.7) !important; color:#777; }
    .leaflet-control-attribution a { color:#9e9e9e; }

    /* Grupos de puntos */
    .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
        background-color:rgba(0,255,136,.18);
    }
    .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
        background-color:rgba(0,255,136,.75); color:#050505; font-weight:700;
    }
</style>
"""

mapa.get_root().header.add_child(folium.Element(estilo))

# Agrupar marcadores para mejorar el rendimiento
marcadores = MarkerCluster().add_to(mapa)

# =====================================
# 3. AGREGAR DETECCIONES
# =====================================

for _, fila in df.iterrows():

    if int(fila["Incendio"]) == 1:
        color = COLOR_ALTA
        confianza = "Nominal o alta"
        clase = "alta"
    else:
        color = COLOR_BAJA
        confianza = "Baja"
        clase = "baja"

    popup = f"""
    <div class="ent-popup">
        <span class="ent-etiqueta ent-{clase}">Confianza {confianza.lower()}</span>
        <table>
            <tr><td>Latitud</td><td>{fila['latitude']:.2f}</td></tr>
            <tr><td>Longitud</td><td>{fila['longitude']:.2f}</td></tr>
            <tr><td>Temperatura TI4</td><td>{fila['bright_ti4']:.2f} K</td></tr>
            <tr><td>Temperatura TI5</td><td>{fila['bright_ti5']:.2f} K</td></tr>
            <tr><td>FRP</td><td>{fila['frp']:.2f} MW</td></tr>
        </table>
    </div>
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
