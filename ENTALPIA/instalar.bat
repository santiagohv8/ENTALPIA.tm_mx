@echo off
cd /d "%~dp0"
echo ==========================================
echo   ENTALPIA - Instalacion
echo ==========================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo No se encontro Python.
    echo Instalalo desde https://www.python.org y marca "Add python.exe to PATH".
    pause
    exit /b 1
)

if not exist venv\Scripts\python.exe (
    echo Creando entorno virtual en la carpeta venv ...
    python -m venv venv
    if errorlevel 1 (
        echo No se pudo crear el entorno virtual.
        pause
        exit /b 1
    )
)

echo Instalando librerias dentro de venv ...
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo Hubo un error al instalar las librerias. Revisa tu conexion a internet.
    pause
    exit /b 1
)

echo.
echo Listo. Ahora abre iniciar.bat
pause
