"""
=====================================================
 ENTALPIA - Historial de puntos de calor MODIS + VIIRS
=====================================================
 Descarga de NASA FIRMS las detecciones de los dos sensores
 que pide el reto y las guarda en historico.db:

   - MODIS (satélites Terra y Aqua, píxel de ~1 km)
   - VIIRS (satélite NOAA-20, píxel de 375 m)

 Para fechas antiguas usa los datos "SP" (procesamiento
 estándar, ya revisados por la NASA) y para las recientes
 los "NRT" (tiempo casi real).

 Es incremental: la primera vez descarga AÑOS_HISTORIAL
 años (tarda varios minutos); después solo lo nuevo.

 Uso:
     python historico.py
=====================================================
"""

import os
import io
import csv
import time
import sqlite3
import urllib.request
import urllib.error
from datetime import date, datetime, timedelta

from config import MAP_KEY, AREA, URL_FIRMS

# =====================================
# CONFIGURACIÓN
# =====================================

AÑOS_HISTORIAL = int(os.environ.get("ENTALPIA_ANIOS", 2))
DIAS_POR_PETICION = 5          # días que se piden en cada consulta a la API
PAUSA_SEGUNDOS = float(os.environ.get("ENTALPIA_PAUSA", 1))  # pausa entre consultas
DIAS_RECIENTES = 10            # estos últimos días se vuelven a pedir siempre

# Sensor -> (fuente histórica SP, fuente reciente NRT)
SENSORES = {
    "MODIS": ("MODIS_SP", "MODIS_NRT"),
    "VIIRS": ("VIIRS_NOAA20_SP", "VIIRS_NOAA20_NRT"),
}

# Filtro de calidad para que los dos sensores sean comparables:
#   MODIS da la confianza en 0-100; VIIRS en l (baja), n (nominal), h (alta)
CONFIANZA_MIN_MODIS = 30
CONFIANZA_VIIRS = {"n", "h"}

ruta = os.path.dirname(os.path.abspath(__file__))
archivo_db = os.path.join(ruta, "historico.db")


# =====================================
# BASE DE DATOS
# =====================================

def conectar():
    conexion = sqlite3.connect(archivo_db)
    conexion.executescript("""
        CREATE TABLE IF NOT EXISTS puntos (
            sensor     TEXT NOT NULL,
            fecha      TEXT NOT NULL,     -- AAAA-MM-DD (UTC)
            hora       TEXT,
            lat        REAL NOT NULL,
            lon        REAL NOT NULL,
            frp        REAL,
            confianza  TEXT,
            cy         INTEGER NOT NULL,  -- celda de ~1 km (lat x 100)
            cx         INTEGER NOT NULL,  -- celda de ~1 km (lon x 100)
            UNIQUE (sensor, fecha, hora, lat, lon)
        );
        CREATE INDEX IF NOT EXISTS idx_puntos_lugar ON puntos (lat, lon);
        CREATE INDEX IF NOT EXISTS idx_puntos_fecha ON puntos (sensor, fecha);

        -- Bloques de días ya descargados (sirve para saber qué falta
        -- y para distinguir "0 incendios" de "sin datos")
        CREATE TABLE IF NOT EXISTS bloques (
            sensor      TEXT NOT NULL,
            inicio      TEXT NOT NULL,
            dias        INTEGER NOT NULL,
            fuente      TEXT NOT NULL,
            filas       INTEGER NOT NULL,
            descargado  TEXT NOT NULL,
            PRIMARY KEY (sensor, inicio)
        );
    """)
    return conexion


# =====================================
# API DE FIRMS
# =====================================

def pedir(url):
    peticion = urllib.request.Request(url, headers={"User-Agent": "Entalpia/1.0"})
    with urllib.request.urlopen(peticion, timeout=120) as respuesta:
        return respuesta.read().decode("utf-8", errors="replace")


def disponibilidad():
    """Fechas mínima y máxima de cada fuente (SP y NRT)."""
    try:
        texto = pedir(f"{URL_FIRMS}/api/data_availability/csv/{MAP_KEY}/ALL")
        fechas = {}
        for fila in csv.DictReader(io.StringIO(texto)):
            fechas[fila["data_id"]] = (
                date.fromisoformat(fila["min_date"]),
                date.fromisoformat(fila["max_date"]),
            )
        return fechas
    except Exception as error:
        print(f"Aviso: no se pudo consultar la disponibilidad de datos ({error}).")
        return {}


def elegir_fuente(sensor, inicio, fin, fechas):
    sp, nrt = SENSORES[sensor]
    if sp in fechas:
        minimo, maximo = fechas[sp]
        if minimo <= inicio and fin <= maximo:
            return sp
        return nrt
    # Sin información de disponibilidad: SP para lo que tenga más de 3 meses
    return sp if fin < date.today() - timedelta(days=90) else nrt


def descargar_bloque(fuente, inicio, dias):
    url = f"{URL_FIRMS}/api/area/csv/{MAP_KEY}/{fuente}/{AREA}/{dias}/{inicio.isoformat()}"
    for intento in range(2):
        try:
            texto = pedir(url)
            break
        except (urllib.error.URLError, TimeoutError) as error:
            if intento == 1:
                raise
            print(f"   reintentando ({error})...")
            time.sleep(5)

    primera = texto.lstrip().split("\n", 1)[0].lower()
    if "latitude" not in primera:
        # La API responde texto de error (clave inválida, límite, etc.)
        raise ValueError(texto.strip()[:200])

    return list(csv.DictReader(io.StringIO(texto)))


def filtrar_y_convertir(sensor, filas):
    puntos = []
    for f in filas:
        try:
            lat = float(f["latitude"])
            lon = float(f["longitude"])
        except (KeyError, ValueError):
            continue

        confianza = str(f.get("confidence", "")).strip().lower()
        if sensor == "MODIS":
            try:
                if int(float(confianza)) < CONFIANZA_MIN_MODIS:
                    continue
            except ValueError:
                continue
        elif confianza[:1] not in CONFIANZA_VIIRS:
            continue

        try:
            frp = float(f.get("frp") or 0)
        except ValueError:
            frp = None

        puntos.append((
            sensor, f.get("acq_date", ""), str(f.get("acq_time", "")), lat, lon, frp,
            confianza, round(lat * 100), round(lon * 100),
        ))
    return puntos


# =====================================
# PROGRAMA PRINCIPAL
# =====================================

def main():
    conexion = conectar()
    fechas = disponibilidad()

    hoy = date.today()
    inicio_total = hoy - timedelta(days=365 * AÑOS_HISTORIAL)
    # Los bloques empiezan siempre en las mismas fechas (contadas desde
    # el 1 de enero de 2000), para reconocer cuáles ya se descargaron.
    inicio_total -= timedelta(days=(inicio_total - date(2000, 1, 1)).days % DIAS_POR_PETICION)
    limite_reciente = hoy - timedelta(days=DIAS_RECIENTES)

    ya = {
        (s, i) for s, i in conexion.execute("SELECT sensor, inicio FROM bloques")
    }

    total_nuevos = 0
    errores = 0

    for sensor in SENSORES:
        inicio = inicio_total
        while inicio <= hoy:
            dias = min(DIAS_POR_PETICION, (hoy - inicio).days + 1)
            fin = inicio + timedelta(days=dias - 1)

            # Los bloques viejos que ya están completos no se vuelven a pedir
            if (sensor, inicio.isoformat()) in ya and fin < limite_reciente:
                inicio += timedelta(days=DIAS_POR_PETICION)
                continue

            fuente = elegir_fuente(sensor, inicio, fin, fechas)
            try:
                filas = descargar_bloque(fuente, inicio, dias)
            except Exception as error:
                errores += 1
                print(f"{sensor} {inicio} ({fuente}): ERROR {error}")
                if errores >= 5 and total_nuevos == 0:
                    raise SystemExit("Demasiados errores seguidos. Revisa tu internet o tu MAP_KEY.")
                inicio += timedelta(days=DIAS_POR_PETICION)
                time.sleep(PAUSA_SEGUNDOS)
                continue

            puntos = filtrar_y_convertir(sensor, filas)
            antes = conexion.total_changes
            conexion.executemany(
                "INSERT OR IGNORE INTO puntos (sensor, fecha, hora, lat, lon, frp, confianza, cy, cx) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                puntos,
            )
            nuevos = conexion.total_changes - antes
            total_nuevos += nuevos

            conexion.execute(
                "INSERT OR REPLACE INTO bloques (sensor, inicio, dias, fuente, filas, descargado) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (sensor, inicio.isoformat(), dias, fuente, len(puntos),
                 datetime.now().isoformat(timespec="seconds")),
            )
            conexion.commit()

            print(f"{sensor} {inicio} ({fuente}): {len(puntos)} puntos, {nuevos} nuevos")

            inicio += timedelta(days=DIAS_POR_PETICION)
            time.sleep(PAUSA_SEGUNDOS)

    # Quitar puntos más antiguos que el periodo configurado
    conexion.execute("DELETE FROM puntos WHERE fecha < ?", (inicio_total.isoformat(),))
    conexion.execute("DELETE FROM bloques WHERE inicio < ?", (inicio_total.isoformat(),))
    conexion.commit()

    resumen = conexion.execute(
        "SELECT sensor, COUNT(*), MIN(fecha), MAX(fecha) FROM puntos GROUP BY sensor"
    ).fetchall()
    conexion.close()

    print("\nHistorial actualizado:")
    for sensor, n, minimo, maximo in resumen:
        print(f"  {sensor}: {n} puntos ({minimo} a {maximo})")
    print(f"  Nuevos en esta ejecución: {total_nuevos}")


if __name__ == "__main__":
    main()
