/* =========================================================
   ENTALPIA - main.js
   Se carga en todas las páginas. Cada bloque revisa si
   los elementos existen antes de ejecutarse.
========================================================= */

/* =========================
   DATOS DE LA GRÁFICA
   ⚠ DATOS DE EJEMPLO: reemplazar con los datos procesados
   por el equipo de análisis. Solo hay que cambiar
   "etiquetas" y "valores" (misma cantidad en ambos) y
   poner esEjemplo en false.
========================= */

const DATOS_GRAFICA = {
    etiquetas: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    valores:   [42, 58, 96, 164, 212, 178, 121, 88, 64, 51, 47, 39],
    unidad: "focos de calor",
    esEjemplo: true
};


/* =========================
   HEADER AL HACER SCROLL
========================= */

const header = document.querySelector(".header");

if (header) {
    const actualizarHeader = () => {
        header.style.background = window.scrollY > 80
            ? "rgba(0,0,0,.95)"
            : "rgba(0,0,0,.75)";
    };

    window.addEventListener("scroll", actualizarHeader);
    actualizarHeader();
}


/* =========================
   AVISO EMERGENTE (TOAST)
========================= */

function mostrarAviso(texto) {
    let toast = document.querySelector(".toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.className = "toast";
        toast.setAttribute("role", "status");
        document.body.appendChild(toast);
    }

    toast.textContent = texto;
    toast.classList.add("visible");

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("visible"), 2800);
}


/* =========================
   CONEXIÓN CON EL SERVIDOR (servidor.py)
   Si la página se abre como archivo (file://) no hay
   servidor, así que el login y el mapa no funcionan.
========================= */

const HAY_SERVIDOR = location.protocol.startsWith("http");

async function llamarApi(ruta, datos) {
    const opciones = datos === undefined
        ? { credentials: "same-origin" }
        : {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        };

    const respuesta = await fetch(ruta, opciones);
    let cuerpo = {};
    try { cuerpo = await respuesta.json(); } catch (e) { /* sin cuerpo */ }

    if (!respuesta.ok) {
        throw new Error(cuerpo.error || "Ocurrió un error. Intenta de nuevo.");
    }
    return cuerpo;
}

const SIN_SERVIDOR = "Para usar esta función abre la página con: python servidor.py";


/* =========================
   VENTANAS EMERGENTES (MODALES)
========================= */

function crearModal(id, clase, contenido) {
    const modal = document.createElement("div");
    modal.className = `modal ${clase}`;
    modal.id = id;
    modal.hidden = true;
    modal.innerHTML = `<div class="modal-panel" role="dialog" aria-modal="true">${contenido}</div>`;
    document.body.appendChild(modal);

    modal.addEventListener("click", (evento) => {
        if (evento.target === modal || evento.target.closest("[data-cerrar]")) {
            cerrarModal(modal);
        }
    });

    return modal;
}

function abrirModal(modal) {
    modal.hidden = false;
    document.body.classList.add("modal-abierto");
    requestAnimationFrame(() => modal.classList.add("visible"));
}

function cerrarModal(modal) {
    modal.classList.remove("visible");
    document.body.classList.remove("modal-abierto");
    setTimeout(() => { modal.hidden = true; }, 200);
}

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
        document.querySelectorAll(".modal.visible").forEach(cerrarModal);
    }
});


/* =========================
   SESIÓN DE USUARIO
========================= */

let usuarioActual = null;
const escuchasSesion = [];

function actualizarSesion(usuario) {
    usuarioActual = usuario;

    document.querySelectorAll(".btn-login").forEach((boton) => {
        boton.textContent = usuario ? "Cerrar sesión" : "Iniciar sesión";
        boton.classList.toggle("conectado", Boolean(usuario));

        let saludo = boton.parentElement.querySelector(".nav-user");
        if (usuario) {
            if (!saludo) {
                saludo = document.createElement("span");
                saludo.className = "nav-user";
                boton.before(saludo);
            }
            saludo.textContent = `Hola, ${usuario}`;
        } else if (saludo) {
            saludo.remove();
        }
    });

    escuchasSesion.forEach((funcion) => funcion(usuario));
}

const modalLogin = crearModal("modal-login", "modal-login", `
    <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">×</button>
    <span class="logo-modal">ENTALPIA</span>
    <h2 id="login-titulo">Iniciar sesión</h2>
    <p class="modal-texto" id="login-subtitulo">Accede para actualizar los datos del mapa.</p>

    <form id="form-login" novalidate>
        <label class="campo">
            <span>Usuario</span>
            <input type="text" name="usuario" autocomplete="username" required>
        </label>
        <label class="campo" id="campo-correo" hidden>
            <span>Correo electrónico</span>
            <input type="email" name="correo" autocomplete="email">
        </label>
        <label class="campo">
            <span>Contraseña</span>
            <input type="password" name="contrasena" autocomplete="current-password" required>
        </label>

        <p class="form-error" role="alert" hidden></p>

        <button type="submit" class="btn-primary btn-ancho" id="login-enviar">Iniciar sesión</button>
    </form>

    <p class="modal-cambio">
        <span id="login-pregunta">¿No tienes cuenta?</span>
        <button type="button" class="btn-enlace" id="login-cambiar">Registrarse</button>
    </p>
`);

const formLogin = modalLogin.querySelector("#form-login");
const errorLogin = modalLogin.querySelector(".form-error");
let modoRegistro = false;

function ponerModoLogin(registro) {
    modoRegistro = registro;
    modalLogin.querySelector("#login-titulo").textContent = registro ? "Crear cuenta" : "Iniciar sesión";
    modalLogin.querySelector("#login-subtitulo").textContent = registro
        ? "Usuario de al menos 3 caracteres, tu correo y una contraseña de al menos 6."
        : "Accede para actualizar los datos del mapa.";
    modalLogin.querySelector("#login-enviar").textContent = registro ? "Registrarse" : "Iniciar sesión";
    modalLogin.querySelector("#login-pregunta").textContent = registro ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
    modalLogin.querySelector("#login-cambiar").textContent = registro ? "Iniciar sesión" : "Registrarse";
    formLogin.contrasena.autocomplete = registro ? "new-password" : "current-password";
    modalLogin.querySelector("#campo-correo").hidden = !registro;
    errorLogin.hidden = true;
}

modalLogin.querySelector("#login-cambiar").addEventListener("click", () => ponerModoLogin(!modoRegistro));

formLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    errorLogin.hidden = true;

    if (!HAY_SERVIDOR) {
        errorLogin.textContent = SIN_SERVIDOR;
        errorLogin.hidden = false;
        return;
    }

    const datos = {
        usuario: formLogin.usuario.value.trim(),
        contrasena: formLogin.contrasena.value
    };

    if (!datos.usuario || !datos.contrasena) {
        errorLogin.textContent = "Llena usuario y contraseña.";
        errorLogin.hidden = false;
        return;
    }

    const correo = formLogin.correo.value.trim();

    if (modoRegistro && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        errorLogin.textContent = "Escribe un correo electrónico válido.";
        errorLogin.hidden = false;
        return;
    }

    const boton = modalLogin.querySelector("#login-enviar");
    boton.disabled = true;

    try {
        if (modoRegistro) {
            await llamarApi("/api/registro", { ...datos, correo });
        }
        const respuesta = await llamarApi("/api/login", datos);

        formLogin.reset();
        ponerModoLogin(false);
        cerrarModal(modalLogin);
        actualizarSesion(respuesta.usuario);
        mostrarAviso(`Bienvenido, ${respuesta.usuario}`);
    } catch (error) {
        errorLogin.textContent = error.message;
        errorLogin.hidden = false;
    } finally {
        boton.disabled = false;
    }
});

document.querySelectorAll(".btn-login").forEach((boton) => {
    boton.addEventListener("click", async () => {
        if (!usuarioActual) {
            ponerModoLogin(false);
            abrirModal(modalLogin);
            setTimeout(() => formLogin.usuario.focus(), 50);
            return;
        }

        try { await llamarApi("/api/logout", {}); } catch (e) { /* ya estaba cerrada */ }
        actualizarSesion(null);
        mostrarAviso("Sesión cerrada.");
    });
});

if (HAY_SERVIDOR) {
    llamarApi("/api/sesion")
        .then((respuesta) => actualizarSesion(respuesta.usuario))
        .catch(() => actualizarSesion(null));
}


/* =========================
   DEMO: MAPA DE DETECCIONES
========================= */

const modalMapa = crearModal("modal-mapa", "modal-mapa", `
    <div class="mapa-encabezado">
        <div>
            <span class="eyebrow eyebrow-left">Demostración en vivo</span>
            <h2>Mapa de detecciones</h2>
            <p class="modal-texto">Datos satelitales VIIRS (NOAA-21) de NASA FIRMS · México y alrededores</p>
        </div>

        <div class="mapa-acciones">
            <span class="mapa-estado" aria-live="polite"></span>
            <button type="button" class="btn-secondary btn-chico" id="mapa-actualizar" hidden>Actualizar datos</button>
            <a href="/mapa" target="_blank" rel="noopener" class="btn-secondary btn-chico" id="mapa-pestana">Abrir en pestaña ↗</a>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">×</button>
        </div>
    </div>

    <div class="mapa-cuerpo">
        <iframe title="Mapa de detecciones de incendios" id="mapa-iframe"></iframe>
        <div class="mapa-cargando"><span class="spinner"></span>Cargando mapa...</div>
        <div class="mapa-sin-servidor" hidden>
            <strong>El mapa necesita el servidor de Entalpia</strong>
            <span>Abre la terminal en la carpeta del proyecto y ejecuta <code>python servidor.py</code></span>
        </div>
    </div>

    <div class="mapa-leyenda">
        <span><i class="punto punto-alta"></i>Confianza nominal o alta</span>
        <span><i class="punto punto-baja"></i>Confianza baja</span>
        <span class="leyenda-nota">Haz clic en un punto para ver sus datos. Los números agrupan detecciones cercanas.</span>
    </div>
`);

const iframeMapa = modalMapa.querySelector("#mapa-iframe");
const cargandoMapa = modalMapa.querySelector(".mapa-cargando");
const botonActualizar = modalMapa.querySelector("#mapa-actualizar");
const estadoMapa = modalMapa.querySelector(".mapa-estado");

iframeMapa.addEventListener("load", () => {
    if (iframeMapa.src) cargandoMapa.hidden = true;
});

function cargarMapa() {
    cargandoMapa.hidden = false;
    iframeMapa.src = `/mapa?v=${Date.now()}`;
}

function abrirMapa() {
    if (!HAY_SERVIDOR) {
        cargandoMapa.hidden = true;
        modalMapa.querySelector(".mapa-sin-servidor").hidden = false;
        modalMapa.querySelector("#mapa-pestana").hidden = true;
    } else if (!iframeMapa.src) {
        cargarMapa();
    }
    abrirModal(modalMapa);
}

escuchasSesion.push((usuario) => {
    botonActualizar.hidden = !usuario;
    if (!usuario) estadoMapa.textContent = "";
});

botonActualizar.addEventListener("click", async () => {
    try {
        await llamarApi("/api/actualizar", {});
    } catch (error) {
        estadoMapa.textContent = error.message;
        return;
    }

    botonActualizar.disabled = true;
    estadoMapa.className = "mapa-estado trabajando";
    estadoMapa.textContent = "Iniciando...";

    const revisar = async () => {
        let estado;
        try {
            estado = await llamarApi("/api/estado");
        } catch (error) {
            estadoMapa.textContent = error.message;
            botonActualizar.disabled = false;
            return;
        }

        if (estado.estado === "ejecutando") {
            estadoMapa.textContent = estado.paso;
            setTimeout(revisar, 1500);
            return;
        }

        botonActualizar.disabled = false;
        estadoMapa.className = `mapa-estado ${estado.estado === "error" ? "error" : "listo"}`;
        estadoMapa.textContent = estado.mensaje;

        if (estado.estado === "listo") cargarMapa();
    };

    setTimeout(revisar, 800);
});

document.querySelectorAll("[data-abrir-mapa]").forEach((boton) => {
    boton.addEventListener("click", (evento) => {
        evento.preventDefault();
        abrirMapa();
    });
});

if (location.hash === "#demo") abrirMapa();


/* =========================
   GRÁFICA DE DATOS (canvas, sin librerías)
========================= */

const canvasGrafica = document.getElementById("grafica-incendios");

if (canvasGrafica) {
    const etiquetaEjemplo = document.querySelector(".chart-tag");
    if (etiquetaEjemplo && !DATOS_GRAFICA.esEjemplo) {
        etiquetaEjemplo.hidden = true;
    }

    let barraActiva = -1;

    const dibujarGrafica = () => {
        const ctx = canvasGrafica.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const ancho = canvasGrafica.clientWidth;
        const alto = canvasGrafica.clientHeight;

        canvasGrafica.width = ancho * dpr;
        canvasGrafica.height = alto * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, ancho, alto);

        const estilos = getComputedStyle(document.documentElement);
        const verde = estilos.getPropertyValue("--green-primary").trim() || "#00ff88";

        const margen = { arriba: 30, derecha: 10, abajo: 36, izquierda: 48 };
        const areaAncho = ancho - margen.izquierda - margen.derecha;
        const areaAlto = alto - margen.arriba - margen.abajo;

        const { etiquetas, valores } = DATOS_GRAFICA;
        const maximo = Math.max(...valores, 1);
        const paso = Math.pow(10, Math.floor(Math.log10(maximo))) / 2;
        const tope = Math.ceil(maximo / paso) * paso;

        // Líneas guía y eje Y
        ctx.font = "12px Inter, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        let lineas = Math.round(tope / paso);
        if (lineas > 6) lineas = Math.ceil(lineas / 2);
        for (let i = 0; i <= lineas; i++) {
            const valor = (tope / lineas) * i;
            const y = margen.arriba + areaAlto - (valor / tope) * areaAlto;

            ctx.strokeStyle = "rgba(255,255,255,.07)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(margen.izquierda, y);
            ctx.lineTo(ancho - margen.derecha, y);
            ctx.stroke();

            ctx.fillStyle = "#7a7a7a";
            ctx.fillText(Math.round(valor), margen.izquierda - 10, y);
        }

        // Barras
        const espacio = areaAncho / valores.length;
        const anchoBarra = Math.min(espacio * 0.6, 48);

        valores.forEach((valor, i) => {
            const x = margen.izquierda + espacio * i + (espacio - anchoBarra) / 2;
            const altoBarra = (valor / tope) * areaAlto;
            const y = margen.arriba + areaAlto - altoBarra;
            const activa = i === barraActiva;

            ctx.fillStyle = activa ? verde : "rgba(0,255,136,.55)";
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y, anchoBarra, altoBarra, [6, 6, 0, 0]);
            } else {
                ctx.rect(x, y, anchoBarra, altoBarra);
            }
            ctx.fill();

            // Etiqueta eje X
            ctx.fillStyle = activa ? "#ffffff" : "#8a8a8a";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(etiquetas[i], x + anchoBarra / 2, margen.arriba + areaAlto + 12);

            // Valor sobre la barra activa
            if (activa) {
                ctx.fillStyle = "#ffffff";
                ctx.font = "600 13px Inter, sans-serif";
                ctx.textBaseline = "bottom";
                ctx.fillText(`${valor} ${DATOS_GRAFICA.unidad}`, x + anchoBarra / 2, y - 8);
                ctx.font = "12px Inter, sans-serif";
            }
        });

        canvasGrafica._geometria = { margen, espacio };
    };

    canvasGrafica.addEventListener("mousemove", (evento) => {
        const geo = canvasGrafica._geometria;
        if (!geo) return;

        const rect = canvasGrafica.getBoundingClientRect();
        const x = evento.clientX - rect.left - geo.margen.izquierda;
        const indice = Math.floor(x / geo.espacio);
        const nuevo = indice >= 0 && indice < DATOS_GRAFICA.valores.length ? indice : -1;

        if (nuevo !== barraActiva) {
            barraActiva = nuevo;
            dibujarGrafica();
        }
    });

    canvasGrafica.addEventListener("mouseleave", () => {
        barraActiva = -1;
        dibujarGrafica();
    });

    window.addEventListener("resize", dibujarGrafica);
    dibujarGrafica();
}


/* =========================
   VIDEO DE USO
   Si todavía no existe assets/video-uso.mp4 se muestra
   un recuadro de "Próximamente".
========================= */

const contenedorVideo = document.querySelector(".video-wrapper");

if (contenedorVideo) {
    const video = contenedorVideo.querySelector("video");
    const fuente = video.querySelector("source");
    const sinVideo = () => contenedorVideo.classList.add("sin-video");

    if (fuente) fuente.addEventListener("error", sinVideo);
    video.addEventListener("error", sinVideo);

    if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        sinVideo();
    }
}


/* =========================
   FOTOS DEL EQUIPO
   Si la foto no existe se muestran las iniciales.
========================= */

document.querySelectorAll(".team-photo img").forEach((foto) => {
    const sinFoto = () => foto.closest(".team-photo").classList.add("sin-foto");

    if (foto.complete && foto.naturalWidth === 0) {
        sinFoto();
    } else {
        foto.addEventListener("error", sinFoto);
    }
});


/* =========================
   AYUDA Y SOPORTE: BUSCADOR Y FILTROS
========================= */

const panelAyuda = document.querySelector(".help-layout");

if (panelAyuda) {
    const buscador = document.getElementById("buscador-ayuda");
    const formulario = document.getElementById("form-buscador");
    const filtros = [...document.querySelectorAll(".filter-panel input[type='checkbox']")];
    const botonLimpiar = document.querySelector(".filter-clear");
    const elementos = [...document.querySelectorAll("[data-categoria]")];
    const sinResultados = document.querySelector(".no-results");
    const tituloTemas = document.getElementById("titulo-temas");
    const tituloFaq = document.getElementById("titulo-faq");

    const normalizar = (texto) =>
        texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

    const aplicarFiltros = () => {
        const consulta = normalizar(buscador.value);
        const categorias = filtros.filter((f) => f.checked).map((f) => f.value);

        let tarjetas = 0;
        let preguntas = 0;

        elementos.forEach((el) => {
            const coincideCategoria = !categorias.length || categorias.includes(el.dataset.categoria);
            const coincideTexto = !consulta || normalizar(el.textContent).includes(consulta);
            const visible = coincideCategoria && coincideTexto;

            el.hidden = !visible;

            if (visible && el.classList.contains("help-card")) tarjetas++;
            if (visible && el.classList.contains("faq-item")) preguntas++;
        });

        tituloTemas.hidden = tarjetas === 0;
        tituloFaq.hidden = preguntas === 0;
        sinResultados.hidden = tarjetas + preguntas > 0;
        botonLimpiar.hidden = categorias.length === 0;
    };

    buscador.addEventListener("input", aplicarFiltros);
    filtros.forEach((f) => f.addEventListener("change", aplicarFiltros));

    formulario.addEventListener("submit", (evento) => {
        evento.preventDefault();
        aplicarFiltros();
    });

    botonLimpiar.addEventListener("click", () => {
        filtros.forEach((f) => (f.checked = false));
        aplicarFiltros();
    });

    // Al dar clic en una tarjeta se abre su pregunta frecuente
    const abrirPregunta = (selector) => {
        if (!selector || selector === "#") return;
        const pregunta = document.querySelector(selector);
        if (pregunta && pregunta.tagName === "DETAILS") {
            pregunta.hidden = false;
            pregunta.open = true;
        }
    };

    document.querySelectorAll(".help-card[href^='#']").forEach((tarjeta) => {
        tarjeta.addEventListener("click", () => abrirPregunta(tarjeta.getAttribute("href")));
    });

    window.addEventListener("hashchange", () => abrirPregunta(location.hash));
    abrirPregunta(location.hash);

    aplicarFiltros();
}