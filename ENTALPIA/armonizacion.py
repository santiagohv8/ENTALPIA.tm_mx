"""
=====================================================
 ENTALPIA - Armonización MODIS + VIIRS
=====================================================
 Convierte los puntos de historico.db en un calendario
 diario de actividad de quema que se puede comparar entre
 sensores. Lo usa servidor.py (/api/calendario).

 Por qué hace falta:
   VIIRS tiene píxeles de 375 m y MODIS de ~1 km. Un mismo
   incendio aparece como varios puntos en VIIRS y como uno
   en MODIS, así que sumar puntos exagera la actividad.

 Cómo armonizamos (3 pasos):
   1. Misma regla de conteo: cada punto se asigna a una
      celda de 0.01° (~1 km, el tamaño de un píxel MODIS) y
      contamos celdas con fuego por día, no puntos.
   2. Misma escala: en los días que ambos sensores
      observaron, calculamos el factor
          k = Σ celdas MODIS / Σ celdas VIIRS
      y convertimos VIIRS a "equivalente MODIS" (k · VIIRS).
   3. Serie única: el valor armonizado de cada día es el
      promedio de los sensores disponibles ese día.

 Días inusuales: z = (x − μ) / σ, comparando cada día con
 todos los días del mismo mes en el historial. z ≥ 2 es
 inusual (menos del ~2.5% de los días en una normal).

 Solo usa la biblioteca estándar de Python.
=====================================================
"""

import math
import sqlite3
from datetime import date, timedelta

MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
         "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

UMBRAL_Z = 2.0

# Regiones predefinidas (rectángulos aproximados): oeste, sur, este, norte
REGIONES = [
    {"id": "mexico", "nombre": "México y alrededores", "bbox": [-118.4, 14.5, -86.7, 32.7]},
    {"id": "noroeste", "nombre": "Noroeste (Baja California, Sonora)", "bbox": [-117.2, 22.8, -108.4, 32.7]},
    {"id": "norte", "nombre": "Norte (Chihuahua, Durango, Coahuila)", "bbox": [-109.1, 22.5, -100.0, 31.8]},
    {"id": "noreste", "nombre": "Noreste (Nuevo León, Tamaulipas)", "bbox": [-101.2, 22.2, -97.1, 27.8]},
    {"id": "occidente", "nombre": "Occidente (Jalisco, Michoacán, Nayarit, Colima)", "bbox": [-105.8, 17.9, -101.0, 23.1]},
    {"id": "centro", "nombre": "Centro (CDMX, Edomex, Puebla, Hidalgo, Morelos)", "bbox": [-100.6, 17.9, -97.0, 21.7]},
    {"id": "golfo", "nombre": "Golfo (Veracruz, Tabasco)", "bbox": [-98.7, 17.1, -91.0, 22.5]},
    {"id": "sur", "nombre": "Sur (Guerrero, Oaxaca)", "bbox": [-102.2, 15.6, -93.8, 18.9]},
    {"id": "chiapas", "nombre": "Chiapas", "bbox": [-94.2, 14.5, -90.3, 18.0]},
    {"id": "yucatan", "nombre": "Península de Yucatán", "bbox": [-92.5, 17.8, -86.7, 21.7]},
]


def region_por_id(id_region):
    return next((r for r in REGIONES if r["id"] == id_region), REGIONES[0])


# =====================================
# UTILIDADES ESTADÍSTICAS
# =====================================

def media(valores):
    return sum(valores) / len(valores) if valores else 0.0


def desviacion(valores):
    if len(valores) < 2:
        return 0.0
    m = media(valores)
    return math.sqrt(sum((v - m) ** 2 for v in valores) / (len(valores) - 1))


def correlacion(xs, ys):
    if len(xs) < 3:
        return None
    mx, my = media(xs), media(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return sxy / (sx * sy) if sx and sy else None


def rango_fechas(inicio, dias):
    d = date.fromisoformat(inicio)
    return [(d + timedelta(days=i)).isoformat() for i in range(dias)]


# =====================================
# CÁLCULO PRINCIPAL
# =====================================

def calcular(archivo_db, bbox, anio=None):
    oeste, sur, este, norte = bbox

    with sqlite3.connect(f"file:{archivo_db}?mode=ro", uri=True) as conexion:
        # Días cubiertos por cada sensor (para distinguir 0 de "sin datos")
        cubiertos = {"MODIS": set(), "VIIRS": set()}
        for sensor, inicio, dias in conexion.execute("SELECT sensor, inicio, dias FROM bloques"):
            if sensor in cubiertos:
                cubiertos[sensor].update(rango_fechas(inicio, dias))

        filas = conexion.execute(
            """
            SELECT fecha, sensor, COUNT(*), COUNT(DISTINCT cy * 100000 + cx), COALESCE(SUM(frp), 0)
            FROM puntos
            WHERE lon BETWEEN ? AND ? AND lat BETWEEN ? AND ?
            GROUP BY fecha, sensor
            """,
            (oeste, este, sur, norte),
        ).fetchall()

    hoy = date.today().isoformat()
    for sensor in cubiertos:
        cubiertos[sensor] = {d for d in cubiertos[sensor] if d <= hoy}

    todos_los_dias = sorted(cubiertos["MODIS"] | cubiertos["VIIRS"])
    if not todos_los_dias:
        return {"disponible": False}

    # --- Conteos por día ---------------------------------------------------
    dia = {d: {"mp": 0, "mc": 0, "vp": 0, "vc": 0} for d in todos_los_dias}
    for fecha, sensor, puntos, celdas, _frp in filas:
        if fecha not in dia:
            continue
        if sensor == "MODIS":
            dia[fecha]["mp"], dia[fecha]["mc"] = puntos, celdas
        elif sensor == "VIIRS":
            dia[fecha]["vp"], dia[fecha]["vc"] = puntos, celdas

    # --- Paso 2: factor k con los días que observaron ambos sensores -------
    traslape = [d for d in todos_los_dias if d in cubiertos["MODIS"] and d in cubiertos["VIIRS"]]
    suma_mc = sum(dia[d]["mc"] for d in traslape)
    suma_vc = sum(dia[d]["vc"] for d in traslape)
    suma_mp = sum(dia[d]["mp"] for d in traslape)
    suma_vp = sum(dia[d]["vp"] for d in traslape)
    k = (suma_mc / suma_vc) if suma_vc else 1.0

    # --- Paso 3: serie armonizada -----------------------------------------
    for d in todos_los_dias:
        valores = []
        if d in cubiertos["MODIS"]:
            valores.append(dia[d]["mc"])
        if d in cubiertos["VIIRS"]:
            valores.append(k * dia[d]["vc"])
        dia[d]["a"] = media(valores)

    # Acuerdo entre sensores (días con alguna actividad)
    activos = [d for d in traslape if dia[d]["mc"] or dia[d]["vc"]]
    r_puntos = correlacion([dia[d]["mp"] for d in activos], [dia[d]["vp"] for d in activos])
    r_celdas = correlacion([dia[d]["mc"] for d in activos], [k * dia[d]["vc"] for d in activos])
    error_antes = media([abs(dia[d]["vp"] - dia[d]["mp"]) for d in activos])
    error_despues = media([abs(k * dia[d]["vc"] - dia[d]["mc"]) for d in activos])

    # --- Climatología por mes y días inusuales -----------------------------
    por_mes = {m: [] for m in range(1, 13)}
    for d in todos_los_dias:
        por_mes[int(d[5:7])].append(dia[d]["a"])
    clima = {m: (media(v), desviacion(v)) for m, v in por_mes.items()}

    for d in todos_los_dias:
        mu, sigma = clima[int(d[5:7])]
        dia[d]["z"] = (dia[d]["a"] - mu) / sigma if sigma else 0.0

    promedios_mes = [(m, clima[m][0]) for m in range(1, 13) if por_mes[m]]
    criticos = [m for m, _ in sorted(promedios_mes, key=lambda x: -x[1])[:3]]

    # --- Año elegido --------------------------------------------------------
    anios = sorted({int(d[:4]) for d in todos_los_dias})
    if anio not in anios:
        anio = anios[-1]

    del_anio = [d for d in todos_los_dias if int(d[:4]) == anio]
    dias_json = [
        {
            "f": d,
            "mo": dia[d]["mp"] if d in cubiertos["MODIS"] else None,
            "vi": dia[d]["vp"] if d in cubiertos["VIIRS"] else None,
            "a": round(dia[d]["a"], 1),
            "z": round(dia[d]["z"], 2),
        }
        for d in del_anio
    ]

    meses_json = []
    for m in range(1, 13):
        ds = [d for d in del_anio if int(d[5:7]) == m]
        if not ds:
            continue
        meses_json.append({
            "m": m,
            "nombre": MESES[m - 1],
            "modis": sum(dia[d]["mp"] for d in ds if d in cubiertos["MODIS"]),
            "viirs": sum(dia[d]["vp"] for d in ds if d in cubiertos["VIIRS"]),
            "armonizado": round(sum(dia[d]["a"] for d in ds), 1),
            "promedio_historico": round(clima[m][0] * len(ds), 1),
        })

    inusuales = [x for x in dias_json if x["z"] >= UMBRAL_Z and x["a"] > 0]
    maximo = max(dias_json, key=lambda x: x["a"]) if dias_json else None

    return {
        "disponible": True,
        "anio": anio,
        "anios": anios,
        "periodo": [todos_los_dias[0], todos_los_dias[-1]],
        "dias": dias_json,
        "meses": meses_json,
        "resumen": {
            "dias_observados": len(dias_json),
            "dias_con_actividad": sum(1 for x in dias_json if x["a"] > 0),
            "dia_maximo": maximo,
            "inusuales": len(inusuales),
            "meses_criticos": [MESES[m - 1] for m in criticos],
        },
        "armonizacion": {
            "k": round(k, 3),
            "dias_traslape": len(traslape),
            "razon_puntos": round(suma_vp / suma_mp, 2) if suma_mp else None,
            "razon_celdas": round(suma_vc / suma_mc, 2) if suma_mc else None,
            "r_puntos": round(r_puntos, 3) if r_puntos is not None else None,
            "r_armonizado": round(r_celdas, 3) if r_celdas is not None else None,
            "diferencia_antes": round(error_antes, 1),
            "diferencia_despues": round(error_despues, 1),
            "umbral_z": UMBRAL_Z,
            "puntos_modis": sum(dia[d]["mp"] for d in todos_los_dias),
            "puntos_viirs": sum(dia[d]["vp"] for d in todos_los_dias),
        },
    }
