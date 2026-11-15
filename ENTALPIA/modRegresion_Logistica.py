
import pandas as pd

import os

# Carpeta donde está este script (así funciona desde cualquier terminal)
ruta = os.path.dirname(os.path.abspath(__file__))

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
import matplotlib.pyplot as plt

from sklearn.metrics import (
    ConfusionMatrixDisplay,
    RocCurveDisplay,
    PrecisionRecallDisplay
)
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    classification_report
)

# =====================================
# 1. CARGAR DATOS
# =====================================

df = pd.read_csv(os.path.join(ruta, "incendios_modelo.csv"))

# =====================================
# 2. VARIABLES
# =====================================

X = df[[
    "latitude",
    "longitude",
    "bright_ti4",
    "bright_ti5",
    "scan",
    "track",
    "frp",
    "daynight"
]]

y = df["Incendio"]

# =====================================
# 3. DIVIDIR DATOS
# =====================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

# =====================================
# 4. CREAR MODELO
# =====================================

modelo = make_pipeline(
    StandardScaler(),
    LogisticRegression(
        class_weight="balanced",
        max_iter=1000
    )
)

modelo.fit(X_train, y_train)

# =====================================
# 5. PREDICCIONES
# =====================================

y_pred = modelo.predict(X_test)

ConfusionMatrixDisplay.from_predictions(
    y_test,
    y_pred,
    display_labels=["Baja confianza", "Alta confianza"],
    cmap="Blues"
)

plt.title("Matriz de confusión")
plt.show()

RocCurveDisplay.from_estimator(
    modelo,
    X_test,
    y_test
)

plt.title("Curva ROC")
plt.show()

PrecisionRecallDisplay.from_estimator(
    modelo,
    X_test,
    y_test
)

plt.title("Curva Precision-Recall")
plt.show()

# =====================================
# 6. RESULTADOS
# =====================================

print("\n=== REGRESIÓN LOGÍSTICA ===")

print("\nExactitud:")
print(round(accuracy_score(y_test, y_pred), 2))

print("\nMatriz de confusión:")
print(confusion_matrix(y_test, y_pred))

print("\nReporte de clasificación:")
print(classification_report(y_test, y_pred))

# =====================================
# 7. PROBABILIDADES
# =====================================

probabilidades = modelo.predict_proba(X_test)[:, 1]

print("\nPrimeras probabilidades:")

for i in range(min(10, len(probabilidades))):
    print(
        "Probabilidad:", round(probabilidades[i], 2),
        "| Clasificación real:", y_test.iloc[i],
        "| Predicción:", y_pred[i]
    )
