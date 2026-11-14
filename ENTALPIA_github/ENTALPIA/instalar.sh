#!/usr/bin/env bash
# ENTALPIA - Instalacion (macOS / Linux)
set -e
cd "$(dirname "$0")"

if [ ! -x venv/bin/python ]; then
    echo "Creando entorno virtual en la carpeta venv ..."
    python3 -m venv venv
fi

echo "Instalando librerias dentro de venv ..."
venv/bin/python -m pip install --upgrade pip
venv/bin/python -m pip install -r requirements.txt

echo
echo "Listo. Ahora ejecuta ./iniciar.sh"
