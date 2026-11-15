"""
=====================================================
 ENTALPIA - Estadísticas reales para la página
=====================================================
 Calcula cifras a partir de las detecciones descargadas
 de NASA FIRMS (incendios_modelo.csv) y del modelo de
 regresión logística, con intervalos de confianza del
 95% usando la distribución normal.

 Genera: estadisticas.json  (lo lee servidor.py)

 Se ejecuta solo al pulsar "Actualizar datos", o a mano:
     python estadisticas.py
=====================================================
"""

import os
import json
import math
import sqlite3
from datetime import datetime

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import accuracy_score, balanced_accuracy_score, roc_auc_score

ruta = os.path.dirname(os.path.abspath(__file__))
archivo_csv = os.path.join(ruta, "incendios_modelo.csv")
archivo_db = os.path.join(ruta, "incendios.db")
archivo_json = os.path.join(ruta, "estadisticas.json")

Z = 1.96  # valor z para un nivel de confianza del 95%


# =====================================
# INTERVALOS DE CONFIANZA (DISTRIBUCIÓN NORMAL)
# =====================================

def ic_proporcion(exitos, n):
    """p ± z·√(p(1−p)/n), recortado al rango [0, 1]."""
    p = exitos / n
    error = Z * math.sqrt(p * (1 - p) / n)
    return p, max(0.0, p - error), min(1.0, p + error)


def ic_media(serie):
    """x̄ ± z·s/√n"""
    n = len(serie)
    media = float(serie.mean())
    error = Z * float(serie.std(ddof=1)) / math.sqrt(n)
    return media, media - error, media + error


def redondear(valores, decimales):
    return [round(v, decimales) for v in valores]


# =====================================
# 1. DATOS
# =====================================

df = pd.read_csv(archivo_csv).dropna()
n = len(df)

if n < 2:
    raise SystemExit("No hay suficientes detecciones para calcular estadísticas.")

acumulados = None
if os.path.exists(archivo_db):
    with sqlite3.connect(archivo_db) as conexion:
        acumulados = conexion.execute("SELECT COUNT(*) FROM Incendios").fetchone()[0]

descargado = datetime.fromtimestamp(os.path.getmtime(archivo_csv))

# =====================================
# 2. ESTADÍSTICAS DE LAS DETECCIONES
# =====================================

altas = int(df["Incendio"].sum())
p_alta = redondear([v * 100 for v in ic_proporcion(altas, n)], 1)

frp = redondear(ic_media(df["frp"]), 2)
ti4 = redondear(ic_media(df["bright_ti4"]), 1)
dia = redondear([v * 100 for v in ic_proporcion(int(df["daynight"].sum()), n)], 1)

# =====================================
# 3. MODELO DE REGRESIÓN LOGÍSTICA
#    (misma configuración que modRegresion_Logistica.py)
# =====================================

modelo_info = None
X = df[["latitude", "longitude", "bright_ti4", "bright_ti5", "scan", "track", "frp", "daynight"]]
y = df["Incendio"]

if y.nunique() == 2 and y.value_counts().min() >= 2:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    modelo = make_pipeline(
        StandardScaler(),
        LogisticRegression(class_weight="balanced", max_iter=1000)
    )
    modelo.fit(X_train, y_train)
    y_pred = modelo.predict(X_test)

    n_test = len(y_test)
    aciertos = int((y_pred == y_test).sum())
    exactitud = redondear([v * 100 for v in ic_proporcion(aciertos, n_test)], 1)

    modelo_info = {
        "exactitud": exactitud,                      # [valor, ic_min, ic_max] en %
        "exactitud_balanceada": round(balanced_accuracy_score(y_test, y_pred) * 100, 1),
        "auc": round(roc_auc_score(y_test, modelo.predict_proba(X_test)[:, 1]), 3),
        "n_prueba": n_test,
        "n_entrenamiento": len(y_train),
        "linea_base": round(max(y_test.mean(), 1 - y_test.mean()) * 100, 1),
    }

# =====================================
# 4. GUARDAR
# =====================================

resultado = {
    "disponible": True,
    "fuente": {
        "api": "NASA FIRMS Area API",
        "sensor": "VIIRS 375 m (satélite NOAA-21), tiempo casi real",
        "region": "México y alrededores (lon −118.4 a −86.7, lat 14.5 a 32.7)",
        "dias": 3,
    },
    "actualizado": descargado.strftime("%Y-%m-%d %H:%M"),
    "nivel_confianza": 95,
    "detecciones": n,
    "acumuladas": acumulados,
    "confianza_alta_pct": p_alta,          # [valor, ic_min, ic_max]
    "frp_mw": frp,
    "brillo_ti4_k": ti4,
    "frp_mediana_mw": round(float(df["frp"].median()), 2),
    "dia_pct": dia,
    "modelo": modelo_info,
}

with open(archivo_json, "w", encoding="utf-8") as f:
    json.dump(resultado, f, ensure_ascii=False, indent=2)

print("Estadísticas guardadas en estadisticas.json")
print(json.dumps(resultado, ensure_ascii=False, indent=2))
