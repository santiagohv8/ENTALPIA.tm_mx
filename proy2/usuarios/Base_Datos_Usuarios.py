
import sqlite3
import hashlib
import os
import secrets

# =====================================
# 1. RUTA DE LA BASE DE DATOS
# =====================================
# Los usuarios se guardan en una base de datos aparte (usuarios.db),
# separada de la base de los incendios (incendios.db).
# El archivo se crea solo la primera vez.

ruta = os.path.dirname(os.path.abspath(__file__))
archivo_db = os.path.join(ruta, "usuarios.db")

ITERACIONES = 200_000


# =====================================
# 2. CREAR TABLA DE USUARIOS
# =====================================

def crear_tabla():

    conexion = sqlite3.connect(archivo_db)
    cursor = conexion.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Usuarios (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        usuario TEXT NOT NULL UNIQUE,

        sal TEXT NOT NULL,
        contrasena_hash TEXT NOT NULL,

        fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP

    )
    """)

    conexion.commit()
    conexion.close()


# =====================================
# 3. CIFRAR CONTRASEÑA
# =====================================
# Nunca se guarda la contraseña en texto plano.
# Se guarda un "hash" con una "sal" aleatoria por usuario.

def cifrar_contrasena(contrasena, sal):

    return hashlib.pbkdf2_hmac(
        "sha256",
        contrasena.encode("utf-8"),
        bytes.fromhex(sal),
        ITERACIONES
    ).hex()


# =====================================
# 4. REGISTRAR USUARIO
# =====================================

def registrar_usuario(usuario, contrasena):

    usuario = usuario.strip()

    if len(usuario) < 3:
        return False, "El usuario debe tener al menos 3 caracteres."

    if len(contrasena) < 6:
        return False, "La contraseña debe tener al menos 6 caracteres."

    sal = secrets.token_hex(16)
    contrasena_hash = cifrar_contrasena(contrasena, sal)

    conexion = sqlite3.connect(archivo_db)
    cursor = conexion.cursor()

    try:
        cursor.execute(
            "INSERT INTO Usuarios (usuario, sal, contrasena_hash) VALUES (?, ?, ?)",
            (usuario, sal, contrasena_hash)
        )
        conexion.commit()
        return True, "Usuario registrado correctamente."

    except sqlite3.IntegrityError:
        return False, "Ese usuario ya existe."

    finally:
        conexion.close()


# =====================================
# 5. VERIFICAR INICIO DE SESIÓN
# =====================================

def verificar_usuario(usuario, contrasena):

    conexion = sqlite3.connect(archivo_db)
    cursor = conexion.cursor()

    cursor.execute(
        "SELECT sal, contrasena_hash FROM Usuarios WHERE usuario = ?",
        (usuario.strip(),)
    )

    resultado = cursor.fetchone()
    conexion.close()

    if resultado is None:
        return False

    sal, contrasena_hash = resultado

    # Comparación segura
    return secrets.compare_digest(
        cifrar_contrasena(contrasena, sal),
        contrasena_hash
    )


# =====================================
# 6. EJECUCIÓN DIRECTA
# =====================================
# Si se ejecuta este archivo solo, crea la tabla
# y permite registrar un usuario desde la consola.

if __name__ == "__main__":

    import getpass

    crear_tabla()
    print("Tabla Usuarios lista en usuarios.db")

    nuevo = input("\nNuevo usuario (Enter para salir): ")

    if nuevo:
        clave = getpass.getpass("Contraseña: ")
        ok, mensaje = registrar_usuario(nuevo, clave)
        print(mensaje)
