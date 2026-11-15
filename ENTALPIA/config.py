"""
=====================================================
 ENTALPIA - Configuración compartida
=====================================================
 La usan preparar_datos.py e historico.py.

 MAP_KEY: clave gratuita de NASA FIRMS.
   Se recomienda NO dejarla escrita aquí si el repositorio
   es público: define la variable de entorno FIRMS_MAP_KEY.
=====================================================
"""

import os

MAP_KEY = os.environ.get("FIRMS_MAP_KEY", "8a910e22264bc8011260f0aa9a093dcd")

# Rectángulo de México y alrededores: oeste, sur, este, norte
AREA = "-118.4,14.5,-86.7,32.7"

# Dirección de la API (solo se cambia para hacer pruebas)
URL_FIRMS = os.environ.get("FIRMS_URL_BASE", "https://firms.modaps.eosdis.nasa.gov")
