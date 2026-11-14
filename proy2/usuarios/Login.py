
import os
import sys
import subprocess
import webbrowser
import threading
import functools
import http.server
import tkinter as tk
from tkinter import messagebox

import Base_Datos_Usuarios as usuarios

# =====================================
# 1. CONFIGURACIÓN
# =====================================

ruta = os.path.dirname(os.path.abspath(__file__))

usuarios.crear_tabla()


def ejecutar_script(nombre):
    # Se ejecuta en la carpeta del proyecto para que
    # encuentre incendios_modelo.csv
    subprocess.Popen([sys.executable, os.path.join(ruta, nombre)], cwd=ruta)


# Servidor local: los proveedores de mapas bloquean los archivos
# abiertos como file:///C:/..., pero aceptan http://localhost
servidor = {"puerto": None}


def iniciar_servidor():

    if servidor["puerto"] is not None:
        return servidor["puerto"]

    # Solo se permite abrir el mapa (no usuarios.db ni otros archivos)
    class SoloMapa(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path.split("?")[0] != "/mapa_incendios.html":
                self.send_error(404)
                return
            super().do_GET()

        def log_message(self, *args):
            pass

    manejador = functools.partial(SoloMapa, directory=ruta)

    # Puerto 0 = el sistema elige uno libre
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), manejador)

    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    servidor["puerto"] = httpd.server_address[1]
    return servidor["puerto"]


def abrir_mapa():
    archivo = os.path.join(ruta, "mapa_incendios.html")

    if not os.path.exists(archivo):
        messagebox.showwarning(
            "Mapa", "Primero genera el mapa con el botón 'Generar mapa'."
        )
        return

    puerto = iniciar_servidor()
    webbrowser.open(f"http://localhost:{puerto}/mapa_incendios.html")


# =====================================
# 2. MENÚ PRINCIPAL (después del login)
# =====================================

def abrir_menu(usuario):

    ventana_login.withdraw()

    menu = tk.Toplevel()
    menu.title("Detección de incendios")
    menu.geometry("360x380")
    menu.resizable(False, False)

    tk.Label(
        menu, text=f"Bienvenido, {usuario}", font=("Arial", 14, "bold")
    ).pack(pady=15)

    botones = [
        ("1. Descargar y preparar datos", lambda: ejecutar_script("../preparar_datos.py")),
        ("2. Actualizar base de datos", lambda: ejecutar_script("../base_datos.py")),
        ("3. Regresión logística", lambda: ejecutar_script("../modRegresion_Logistica.py")),
        ("4. Generar mapa", lambda: ejecutar_script("../mapa_incendios.py")),
        ("5. Abrir mapa", abrir_mapa),
    ]

    for texto, accion in botones:
        tk.Button(menu, text=texto, width=32, command=accion).pack(pady=4)

    def cerrar_sesion():
        menu.destroy()
        entrada_contrasena.delete(0, tk.END)
        ventana_login.deiconify()

    tk.Button(
        menu, text="Cerrar sesión", width=32, fg="white", bg="#b33a3a",
        command=cerrar_sesion
    ).pack(pady=15)

    menu.protocol("WM_DELETE_WINDOW", ventana_login.destroy)


# =====================================
# 3. ACCIONES DEL LOGIN
# =====================================

intentos = {"fallidos": 0}
MAX_INTENTOS = 3


def iniciar_sesion():

    usuario = entrada_usuario.get()
    contrasena = entrada_contrasena.get()

    if not usuario or not contrasena:
        messagebox.showwarning("Inicio de sesión", "Llena usuario y contraseña.")
        return

    if usuarios.verificar_usuario(usuario, contrasena):
        intentos["fallidos"] = 0
        abrir_menu(usuario.strip())
    else:
        intentos["fallidos"] += 1
        restantes = MAX_INTENTOS - intentos["fallidos"]

        if restantes <= 0:
            messagebox.showerror("Inicio de sesión", "Demasiados intentos. Se cerrará el programa.")
            ventana_login.destroy()
        else:
            messagebox.showerror(
                "Inicio de sesión",
                f"Usuario o contraseña incorrectos.\nIntentos restantes: {restantes}"
            )


def registrar():

    ok, mensaje = usuarios.registrar_usuario(
        entrada_usuario.get(), entrada_contrasena.get()
    )

    if ok:
        messagebox.showinfo("Registro", mensaje + "\nYa puedes iniciar sesión.")
    else:
        messagebox.showerror("Registro", mensaje)


# =====================================
# 4. VENTANA DE INICIO DE SESIÓN
# =====================================

ventana_login = tk.Tk()
ventana_login.title("Inicio de sesión")
ventana_login.geometry("320x260")
ventana_login.resizable(False, False)

tk.Label(
    ventana_login, text="Sistema de incendios", font=("Arial", 14, "bold")
).pack(pady=15)

tk.Label(ventana_login, text="Usuario").pack()
entrada_usuario = tk.Entry(ventana_login, width=28)
entrada_usuario.pack(pady=3)

tk.Label(ventana_login, text="Contraseña").pack()
entrada_contrasena = tk.Entry(ventana_login, width=28, show="*")
entrada_contrasena.pack(pady=3)

tk.Button(
    ventana_login, text="Iniciar sesión", width=20, command=iniciar_sesion
).pack(pady=(12, 4))

tk.Button(
    ventana_login, text="Registrarse", width=20, command=registrar
).pack()

# Enter también inicia sesión
ventana_login.bind("<Return>", lambda evento: iniciar_sesion())
entrada_usuario.focus()

ventana_login.mainloop()
