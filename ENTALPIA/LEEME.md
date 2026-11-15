# ENTALPIA

Página web de prevención y alerta de incendios con datos satelitales (NASA FIRMS, VIIRS NOAA-21).

## Cómo correrlo

Necesitas Python 3.10 o más reciente ([python.org](https://www.python.org); en Windows marca **"Add python.exe to PATH"** al instalar).

**Windows**

1. Doble clic en `instalar.bat` (solo la primera vez). Crea la carpeta `venv/` e instala ahí todas las librerías de `requirements.txt`.
2. Doble clic en `iniciar.bat`. Se abre `http://localhost:8000` en el navegador.

**macOS / Linux**

```bash
./instalar.sh     # solo la primera vez
./iniciar.sh
```

Las librerías quedan solo dentro de `venv/`, no se instalan en el resto de la computadora. Para borrarlas, basta con eliminar esa carpeta. `venv/` no se sube a GitHub (está en `.gitignore`); cada quien la crea con el instalador.

La página **no** funciona completa si abres `web/index.html` con doble clic: el login y el mapa necesitan el servidor.

Para correr un script suelto con las librerías del entorno:

```bash
venv\Scripts\python modRegresion_Logistica.py     # Windows
venv/bin/python modRegresion_Logistica.py         # macOS / Linux
```

## Qué hace cada botón de la página

| Botón | Qué hace |
|---|---|
| **Iniciar sesión** | Inicia sesión o registra un usuario en `usuarios/usuarios.db`. |
| **Desplegar Demo** | Abre el mapa (`mapa_incendios.html`) en una ventana emergente. |
| **Actualizar datos** (dentro del mapa, con sesión iniciada) | Corre `preparar_datos.py` → `base_datos.py` → `estadisticas.py` → `mapa_incendios.py` y recarga el mapa y las cifras. |

La regresión logística abre ventanas de matplotlib, así que se corre aparte (ver arriba).

## Datos reales y actualización automática

Mientras `servidor.py` esté encendido, descarga datos nuevos de NASA FIRMS cada 3 horas (se cambia en `ACTUALIZAR_CADA_HORAS`, 0 = solo con el botón). Cada actualización recalcula `estadisticas.json`: detecciones, % de confianza, FRP promedio, temperatura de brillo y exactitud del modelo, con intervalos de confianza del 95% (distribución normal). Para recalcular a mano: `venv\Scripts\python estadisticas.py`.

## Gráficas de la encuesta (Google Forms)

1. Abre el formulario en Google Forms → pestaña **Respuestas** → **Vincular con Hojas de cálculo**.
2. En la hoja que se crea: **Archivo → Compartir → Publicar en la web**, elige la pestaña de respuestas, formato **Valores separados por comas (.csv)** y **Publicar**.
3. Copia el enlace y pégalo en `servidor.py`, en la línea `ENCUESTA_CSV = ...` (entre las comillas).
4. Reinicia el servidor. Las gráficas se actualizan solas (el servidor vuelve a leer la hoja cada 5 minutos).

Las respuestas abiertas (la pregunta 12) y cualquier columna de correo o nombre **no** se envían a la página.

## Estructura

```
ENTALPIA/
├── instalar.bat / .sh       ← crea venv/ e instala librerías
├── iniciar.bat / .sh        ← arranca el servidor con venv/
├── requirements.txt         ← lista de librerías
├── venv/                    ← (se crea al instalar)
├── servidor.py              ← arranca todo
├── preparar_datos.py        ← descarga datos de NASA FIRMS
├── base_datos.py            ← guarda en incendios.db
├── modRegresion_Logistica.py
├── estadisticas.py          ← cifras con intervalo de confianza
├── mapa_incendios.py        ← genera mapa_incendios.html
├── usuarios/
│   └── Base_Datos_Usuarios.py
└── web/                     ← página (index.html, css, js, pages, assets)
```
