"""
=====================================================
 ENTALPIA - Servidor web
=====================================================
 Reemplaza el menú de Tkinter. Sirve la página web
 (carpeta web/) y conecta sus botones con Python:

   - "Iniciar sesión"   -> usa usuarios/usuarios.db
   - "Desplegar Demo"   -> muestra mapa_incendios.html
   - "Actualizar datos" -> corre preparar_datos.py,
                           base_datos.py y mapa_incendios.py
                           (solo con sesión iniciada)

 Uso:
     python servidor.py
 y se abre http://localhost:8000 en el navegador.
=====================================================
"""

import os
import sys
import json
import time
import secrets
import threading
import subprocess
import webbrowser
import http.server
import functools
import csv
import io
import urllib.request
from http import HTTPStatus

# =====================================
# 1. RUTAS
# =====================================

ruta = os.path.dirname(os.path.abspath(__file__))
carpeta_web = os.path.join(ruta, "web")
archivo_mapa = os.path.join(ruta, "mapa_incendios.html")
archivo_csv = os.path.join(ruta, "incendios_modelo.csv")
archivo_estadisticas = os.path.join(ruta, "estadisticas.json")

sys.path.insert(0, os.path.join(ruta, "usuarios"))
import Base_Datos_Usuarios as usuarios  # noqa: E402

usuarios.crear_tabla()

PUERTO = int(os.environ.get("ENTALPIA_PUERTO", 8000))

# =====================================
# ENCUESTA (Google Forms -> Google Sheets)
# =====================================
# Pega aquí el enlace CSV de la hoja de respuestas:
#   Hoja de respuestas -> Archivo -> Compartir -> Publicar en la web
#   -> elegir la pestaña de respuestas -> formato CSV -> Publicar
# Debe verse parecido a:
#   https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=...&single=true&output=csv

ENCUESTA_CSV = os.environ.get("ENTALPIA_ENCUESTA_CSV", "https://docs.google.com/spreadsheets/d/e/2PACX-1vRJvqkv29ktJnDarr3cvRBKisTol8HuUhTpYAfImIxl9dKyyDKd_fKa68mmOXxU_M489wGyp5-ZteBj/pub?gid=663076312&single=true&output=csv")

# =====================================
# ACTUALIZACIÓN AUTOMÁTICA DEL MAPA
# =====================================
# Cada cuántas horas se descargan datos nuevos de NASA FIRMS
# mientras el servidor esté encendido (0 = solo con el botón).
# FIRMS publica datos nuevos de VIIRS unas cuantas veces al día.

ACTUALIZAR_CADA_HORAS = 3

# =====================================
# 2. SESIONES
# =====================================
# Se guardan en memoria: al reiniciar el servidor
# todos tienen que volver a iniciar sesión.

DURACION_SESION = 8 * 60 * 60          # 8 horas
MAX_INTENTOS = 5                       # intentos fallidos permitidos...
VENTANA_INTENTOS = 5 * 60              # ...cada 5 minutos

sesiones = {}                          # token -> {"usuario", "expira"}
intentos_fallidos = {}                 # ip -> [tiempos]
candado = threading.Lock()


def crear_sesion(usuario):
    token = secrets.token_urlsafe(32)
    with candado:
        sesiones[token] = {"usuario": usuario, "expira": time.time() + DURACION_SESION}
    return token


def usuario_de_sesion(token):
    if not token:
        return None
    with candado:
        datos = sesiones.get(token)
        if not datos:
            return None
        if datos["expira"] < time.time():
            del sesiones[token]
            return None
        return datos["usuario"]


def cerrar_sesion(token):
    with candado:
        sesiones.pop(token, None)


def demasiados_intentos(ip):
    ahora = time.time()
    with candado:
        recientes = [t for t in intentos_fallidos.get(ip, []) if ahora - t < VENTANA_INTENTOS]
        intentos_fallidos[ip] = recientes
        return len(recientes) >= MAX_INTENTOS


def registrar_fallo(ip):
    with candado:
        intentos_fallidos.setdefault(ip, []).append(time.time())


# =====================================
# 3. ACTUALIZAR DATOS (antes botones 1, 2 y 4 del menú)
# =====================================
# La regresión logística no se incluye porque abre ventanas
# de matplotlib; se sigue corriendo aparte:
#     python modRegresion_Logistica.py

PASOS = [
    ("Descargando y preparando datos", "preparar_datos.py"),
    ("Actualizando base de datos", "base_datos.py"),
    ("Calculando estadísticas", "estadisticas.py"),
    ("Generando mapa", "mapa_incendios.py"),
]

estado = {"estado": "inactivo", "paso": "", "mensaje": "", "actualizado": None}


def correr_pasos():
    for i, (descripcion, script) in enumerate(PASOS, start=1):
        with candado:
            estado.update(estado="ejecutando", paso=f"{i}/{len(PASOS)} {descripcion}...", mensaje="")

        try:
            resultado = subprocess.run(
                [sys.executable, os.path.join(ruta, script)],
                cwd=ruta, capture_output=True, text=True, timeout=600,
            )
        except subprocess.TimeoutExpired:
            with candado:
                estado.update(estado="error", mensaje=f"{script} tardó demasiado.")
            return

        if resultado.returncode != 0:
            ultimas = (resultado.stderr or resultado.stdout).strip().splitlines()[-3:]
            print(f"\n[ERROR] {script}\n{resultado.stderr}")
            with candado:
                estado.update(estado="error", mensaje=f"Falló {script}: " + " ".join(ultimas))
            return

    with candado:
        estado.update(estado="listo", paso="", mensaje="Mapa actualizado.",
                      actualizado=time.strftime("%Y-%m-%d %H:%M"))


def actualizacion_automatica():
    """Revisa cada 10 minutos si los datos ya tienen más de
    ACTUALIZAR_CADA_HORAS horas y, si es así, los actualiza."""
    while True:
        try:
            antiguedad = time.time() - os.path.getmtime(archivo_csv)
        except OSError:
            antiguedad = float("inf")

        if antiguedad > ACTUALIZAR_CADA_HORAS * 3600 and iniciar_actualizacion():
            print("Actualizando datos de NASA FIRMS automáticamente...")

        time.sleep(10 * 60)


def iniciar_actualizacion():
    with candado:
        if estado["estado"] == "ejecutando":
            return False
        estado.update(estado="ejecutando", paso="Iniciando...", mensaje="")
    threading.Thread(target=correr_pasos, daemon=True).start()
    return True


# =====================================
# 3b. RESPUESTAS DE LA ENCUESTA
# =====================================
# El navegador no puede leer el CSV de Google directamente
# (Google bloquea esas peticiones por CORS), así que el
# servidor lo descarga y lo entrega a la página.
# Se guarda 5 minutos para no consultar a Google en cada visita.

CACHE_ENCUESTA = 5 * 60

# Columnas que NO se envían a la página (respuestas abiertas
# o datos personales). Se comparan en minúsculas.
COLUMNAS_PRIVADAS = ("hace falta", "correo", "email", "nombre")

encuesta_cache = {"datos": None, "hora": 0}


def descargar_csv(url):
    peticion = urllib.request.Request(url, headers={"User-Agent": "Entalpia/1.0"})
    with urllib.request.urlopen(peticion, timeout=15) as respuesta:
        return respuesta.read().decode("utf-8-sig")


def leer_encuesta():
    if not ENCUESTA_CSV:
        return {"configurado": False}

    ahora = time.time()
    with candado:
        if encuesta_cache["datos"] and ahora - encuesta_cache["hora"] < CACHE_ENCUESTA:
            return encuesta_cache["datos"]

    texto = descargar_csv(ENCUESTA_CSV)
    filas = list(csv.reader(io.StringIO(texto)))

    if not filas:
        datos = {"configurado": True, "columnas": [], "filas": []}
    else:
        encabezados = filas[0]
        visibles = [
            i for i, nombre in enumerate(encabezados)
            if not any(p in nombre.lower() for p in COLUMNAS_PRIVADAS)
        ]
        datos = {
            "configurado": True,
            "columnas": [encabezados[i] for i in visibles],
            "filas": [
                [fila[i] if i < len(fila) else "" for i in visibles]
                for fila in filas[1:] if any(celda.strip() for celda in fila)
            ],
            "actualizado": time.strftime("%Y-%m-%d %H:%M"),
        }

    with candado:
        encuesta_cache.update(datos=datos, hora=ahora)
    return datos


# =====================================
# 4. PÁGINA PROVISIONAL SI NO HAY MAPA
# =====================================

SIN_MAPA = """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
 body{margin:0;height:100vh;display:grid;place-items:center;background:#0d0d0d;
      color:#b3b3b3;font-family:Inter,Arial,sans-serif;text-align:center;padding:20px}
 h1{color:#fff;font-size:1.4rem;margin-bottom:10px}
 span{color:#00ff88}
</style></head><body><div>
<h1>Todavía no hay un mapa generado</h1>
<p>Inicia sesión y pulsa <span>Actualizar datos</span> para descargar
las detecciones y crear el mapa.</p>
</div></body></html>"""


# =====================================
# 5. MANEJADOR DE PETICIONES
# =====================================

class Manejador(http.server.SimpleHTTPRequestHandler):

    # ---------- utilidades ----------

    def log_message(self, *args):
        pass

    def token(self):
        for parte in self.headers.get("Cookie", "").split(";"):
            nombre, _, valor = parte.strip().partition("=")
            if nombre == "sesion":
                return valor
        return None

    def responder_json(self, codigo, datos, cookie=None):
        cuerpo = json.dumps(datos).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(cuerpo)

    def leer_json(self):
        largo = int(self.headers.get("Content-Length", 0) or 0)
        if largo <= 0 or largo > 10_000:
            return {}
        try:
            return json.loads(self.rfile.read(largo).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    def origen_valido(self):
        # Evita que otra página web mande peticiones a este servidor
        origen = self.headers.get("Origin")
        return origen is None or origen == f"http://{self.headers.get('Host')}"

    # ---------- GET ----------

    def do_GET(self):
        ruta_url = self.path.split("?")[0]

        if ruta_url == "/mapa":
            return self.enviar_mapa()

        if ruta_url == "/api/sesion":
            usuario = usuario_de_sesion(self.token())
            return self.responder_json(200, {"usuario": usuario})

        if ruta_url == "/api/encuesta":
            try:
                return self.responder_json(200, leer_encuesta())
            except Exception as error:
                print(f"[ERROR] No se pudo leer la encuesta: {error}")
                return self.responder_json(502, {"error": "No se pudieron cargar las respuestas."})

        if ruta_url == "/api/estadisticas":
            return self.enviar_estadisticas()

        if ruta_url == "/api/estado":
            if not usuario_de_sesion(self.token()):
                return self.responder_json(401, {"error": "Inicia sesión."})
            with candado:
                copia = dict(estado)
            return self.responder_json(200, copia)

        # Todo lo demás: archivos de la carpeta web/
        super().do_GET()

    def enviar_estadisticas(self):
        try:
            with open(archivo_estadisticas, encoding="utf-8") as f:
                datos = json.load(f)
        except (OSError, ValueError):
            datos = {"disponible": False}

        with candado:
            datos["actualizando"] = estado["estado"] == "ejecutando"
        self.responder_json(200, datos)

    def enviar_mapa(self):
        if os.path.exists(archivo_mapa):
            with open(archivo_mapa, "rb") as f:
                cuerpo = f.read()
        else:
            cuerpo = SIN_MAPA.encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)

    # ---------- POST ----------

    def do_POST(self):
        if not self.origen_valido():
            return self.responder_json(403, {"error": "Origen no permitido."})

        ruta_url = self.path.split("?")[0]
        acciones = {
            "/api/login": self.api_login,
            "/api/registro": self.api_registro,
            "/api/logout": self.api_logout,
            "/api/actualizar": self.api_actualizar,
        }

        accion = acciones.get(ruta_url)
        if accion is None:
            return self.responder_json(404, {"error": "No encontrado."})
        accion()

    def api_login(self):
        ip = self.client_address[0]

        if demasiados_intentos(ip):
            return self.responder_json(429, {"error": "Demasiados intentos. Espera unos minutos."})

        datos = self.leer_json()
        usuario = str(datos.get("usuario", "")).strip()
        contrasena = str(datos.get("contrasena", ""))

        if not usuario or not contrasena:
            return self.responder_json(400, {"error": "Llena usuario y contraseña."})

        if not usuarios.verificar_usuario(usuario, contrasena):
            registrar_fallo(ip)
            return self.responder_json(401, {"error": "Usuario o contraseña incorrectos."})

        token = crear_sesion(usuario)
        cookie = f"sesion={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={DURACION_SESION}"
        self.responder_json(200, {"usuario": usuario}, cookie)

    def api_registro(self):
        datos = self.leer_json()
        ok, mensaje = usuarios.registrar_usuario(
            str(datos.get("usuario", "")),
            str(datos.get("correo", "")),
            str(datos.get("contrasena", ""))
        )
        self.responder_json(200 if ok else 400, {"ok": ok, "mensaje": mensaje} if ok else {"error": mensaje})

    def api_logout(self):
        cerrar_sesion(self.token())
        self.responder_json(200, {"ok": True}, "sesion=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")

    def api_actualizar(self):
        if not usuario_de_sesion(self.token()):
            return self.responder_json(401, {"error": "Inicia sesión para actualizar los datos."})

        if not iniciar_actualizacion():
            return self.responder_json(409, {"error": "Ya se están actualizando los datos."})

        self.responder_json(202, {"ok": True})


# =====================================
# 6. ARRANCAR
# =====================================

def main():
    if not os.path.isdir(carpeta_web):
        sys.exit(f"No se encontró la carpeta de la página: {carpeta_web}")

    manejador = functools.partial(Manejador, directory=carpeta_web)

    try:
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PUERTO), manejador)
    except OSError:
        # Puerto ocupado: el sistema elige uno libre
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), manejador)

    direccion = f"http://localhost:{httpd.server_address[1]}"
    print(f"ENTALPIA corriendo en {direccion}")
    print("Presiona Ctrl+C para detenerlo.")

    if "--no-abrir" not in sys.argv:
        webbrowser.open(direccion)

    # Si ya hay datos pero faltan las estadísticas, se calculan una vez
    if os.path.exists(archivo_csv) and not os.path.exists(archivo_estadisticas):
        threading.Thread(
            target=subprocess.run,
            args=([sys.executable, os.path.join(ruta, "estadisticas.py")],),
            kwargs={"cwd": ruta, "capture_output": True},
            daemon=True,
        ).start()

    if ACTUALIZAR_CADA_HORAS > 0 and "--sin-auto" not in sys.argv:
        threading.Thread(target=actualizacion_automatica, daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")


if __name__ == "__main__":
    main()