#!/usr/bin/env bash
cd "$(dirname "$0")"

if [ ! -x venv/bin/python ]; then
    echo "Primero ejecuta ./instalar.sh"
    exit 1
fi

venv/bin/python servidor.py
