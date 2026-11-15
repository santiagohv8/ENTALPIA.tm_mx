/* =========================================================
   ENTALPIA - main.js
   Se carga en todas las páginas. Cada bloque revisa si
   los elementos existen antes de ejecutarse.
========================================================= */

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

        if (estado.estado === "listo") {
            cargarMapa();
            if (typeof cargarDatosReales === "function") cargarDatosReales();
        }
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

/* =========================
   MENÚ EN CELULAR
========================= */

const botonMenu = document.querySelector(".nav-toggle");

if (botonMenu && header) {
    const cambiarMenu = (abrir) => {
        header.classList.toggle("menu-abierto", abrir);
        botonMenu.setAttribute("aria-expanded", String(abrir));
        botonMenu.setAttribute("aria-label", abrir ? "Cerrar menú" : "Abrir menú");
    };

    botonMenu.addEventListener("click", () => {
        cambiarMenu(!header.classList.contains("menu-abierto"));
    });

    // Cerrar el menú al elegir una opción
    header.querySelectorAll("nav a, .nav-actions a, .nav-actions button").forEach((enlace) => {
        enlace.addEventListener("click", () => cambiarMenu(false));
    });

    // Cerrar si la pantalla vuelve a ser grande
    window.matchMedia("(min-width: 64.01em)").addEventListener("change", (consulta) => {
        if (consulta.matches) cambiarMenu(false);
    });
}


/* =========================
   BUZÓN DEL PIE DE PÁGINA (Formspree)
========================= */

document.querySelectorAll(".form-buzon").forEach((formulario) => {
    const estado = formulario.querySelector(".buzon-estado");
    const boton = formulario.querySelector("button[type='submit']");

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        estado.className = "buzon-estado";
        estado.textContent = "Enviando...";
        boton.disabled = true;

        try {
            const respuesta = await fetch(formulario.action, {
                method: "POST",
                body: new FormData(formulario),
                headers: { Accept: "application/json" }
            });

            if (!respuesta.ok) {
                const datos = await respuesta.json().catch(() => ({}));
                const detalle = datos.errors ? datos.errors.map((e) => e.message).join(" ") : "";
                throw new Error(detalle || "No se pudo enviar el mensaje.");
            }

            formulario.reset();
            estado.classList.add("ok");
            estado.textContent = "¡Gracias! Recibimos tu mensaje.";
        } catch (error) {
            estado.classList.add("error");
            estado.textContent = error.message.includes("fetch")
                ? "Sin conexión. Revisa tu internet e intenta de nuevo."
                : error.message;
        } finally {
            boton.disabled = false;
        }
    });
});


/* =========================
   ENCUESTA: GRÁFICAS EN VIVO
   Las respuestas llegan de servidor.py (/api/encuesta),
   que lee la hoja de Google Sheets del formulario.
   "busca" es un pedazo del texto de la pregunta, para
   encontrar su columna aunque cambie un poco la redacción.
========================= */

const PREGUNTAS_ENCUESTA = [
    {
        busca: "que tan preparado",
        titulo: "¿Qué tan preparados nos sentimos?",
        opciones: ["Nada preparado(a)", "Poco preparado(a)", "Más o menos", "Bastante preparado(a)", "Muy preparado(a)"],
        riesgo: ["Nada preparado(a)", "Poco preparado(a)"],
        ordenFijo: true
    },
    {
        busca: "lo primero que harias",
        titulo: "Si ves un incendio, ¿qué harías primero?",
        opciones: ["Llamar al 911", "Alejarme y avisar a las personas cercanas", "Intentar apagarlo yo mismo(a)",
                   "Grabarlo o tomarle fotos", "Publicarlo en redes sociales", "No sabría qué hacer"],
        riesgo: ["Intentar apagarlo yo mismo(a)", "Grabarlo o tomarle fotos", "Publicarlo en redes sociales", "No sabría qué hacer"],
        consejo: "Lo recomendado: alejarte, avisar y llamar al 911."
    },
    {
        busca: "a que numero llamar",
        titulo: "¿Sabemos a qué número llamar?",
        opciones: ["Sí, al 911", "Sí, directo a Bomberos o Protección Civil", "Creo que sí, pero no estoy seguro(a)", "No sé a quién llamar"],
        riesgo: ["Creo que sí, pero no estoy seguro(a)", "No sé a quién llamar"],
        consejo: "En México: 911. Incendios forestales: CONAFOR 800 737 00 00."
    },
    {
        busca: "extintor",
        titulo: "¿Tenemos extintor y sabemos usarlo?",
        opciones: ["Tengo extintor y sé usarlo", "Tengo extintor, pero no sé usarlo", "No tengo, pero sé usarlo", "No tengo y no sé usarlo"],
        riesgo: ["Tengo extintor, pero no sé usarlo", "No tengo y no sé usarlo"]
    },
    {
        busca: "plan de evacuacion",
        titulo: "¿Tenemos un plan de evacuación familiar?",
        opciones: ["Sí, y lo hemos practicado", "Sí, pero nunca lo hemos practicado", "No, nunca lo hemos platicado"],
        riesgo: ["No, nunca lo hemos platicado"],
        ordenFijo: true
    },
    {
        busca: "ayudan a prevenir",
        titulo: "¿Qué acciones creemos que previenen incendios?",
        multiple: true,
        opciones: ["No tirar colillas de cigarro al suelo", "No quemar basura ni hojas secas", "Limpiar la hierba seca alrededor de la casa",
                   "Apagar por completo fogatas y carnes asadas", "Revisar las instalaciones eléctricas y de gas",
                   "No dejar vidrios ni botellas en el monte", "No sé cómo prevenirlos"],
        riesgo: ["No sé cómo prevenirlos"],
        consejo: "Todas las acciones de la lista ayudan a prevenir incendios."
    },
    {
        busca: "de que tipo fue",
        titulo: "¿Qué tipo de incendios hemos visto o vivido?",
        multiple: true,
        opciones: ["Incendio forestal o en el monte", "Incendio de pastizal o en un lote baldío", "Incendio en una casa o edificio",
                   "Incendio de un vehículo", "Nunca he visto ni vivido uno"],
        riesgo: []
    },
    {
        busca: "cual es tu edad",
        titulo: "Edad de quienes respondieron",
        opciones: ["Menos de 18 años", "18 a 25 años", "26 a 40 años", "41 a 60 años", "Más de 60 años"],
        riesgo: [],
        ordenFijo: true
    }
];

const RESUMEN_ENCUESTA = [
    { busca: "has vivido un incendio de cerca", respuesta: "Sí", texto: "ha vivido un incendio de cerca" },
    { busca: "conoces a alguien", respuesta: "Sí", texto: "conoce a alguien que vivió un incendio" },
    { busca: "recibir alertas", respuesta: "Sí", texto: "quiere recibir alertas de riesgo" }
];

const seccionEncuesta = document.getElementById("encuesta");

if (seccionEncuesta) {
    const normalizarTexto = (texto) =>
        String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

    const aviso = seccionEncuesta.querySelector(".encuesta-aviso");
    const resumen = seccionEncuesta.querySelector(".encuesta-resumen");
    const rejilla = seccionEncuesta.querySelector(".encuesta-grid");
    const actualizado = seccionEncuesta.querySelector(".encuesta-actualizado");

    const mostrarAvisoEncuesta = (texto) => {
        aviso.replaceChildren();
        const p = document.createElement("p");
        p.textContent = texto;
        aviso.appendChild(p);
        aviso.hidden = false;
    };

    const crear = (etiqueta, clase, texto) => {
        const el = document.createElement(etiqueta);
        if (clase) el.className = clase;
        if (texto !== undefined) el.textContent = texto;
        return el;
    };

    const buscarColumna = (columnas, busca) =>
        columnas.findIndex((nombre) => normalizarTexto(nombre).includes(normalizarTexto(busca)));

    const porcentaje = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

    const contarPregunta = (pregunta, valores) => {
        const respondidas = valores.filter((v) => v.trim() !== "");
        const conteo = new Map(pregunta.opciones.map((o) => [o, 0]));
        let otras = 0;

        respondidas.forEach((valor) => {
            const limpio = normalizarTexto(valor);
            if (pregunta.multiple) {
                let alguna = false;
                pregunta.opciones.forEach((opcion) => {
                    if (limpio.includes(normalizarTexto(opcion))) {
                        conteo.set(opcion, conteo.get(opcion) + 1);
                        alguna = true;
                    }
                });
                if (!alguna) otras++;
            } else {
                const opcion = pregunta.opciones.find((o) => normalizarTexto(o) === limpio);
                if (opcion) conteo.set(opcion, conteo.get(opcion) + 1);
                else otras++;
            }
        });

        let filas = [...conteo.entries()].map(([opcion, n]) => ({ opcion, n }));
        if (otras) filas.push({ opcion: "Otra respuesta", n: otras });
        if (!pregunta.ordenFijo) filas.sort((a, b) => b.n - a.n);

        return { total: respondidas.length, filas };
    };

    const dibujarTarjeta = (pregunta, datos) => {
        const tarjeta = crear("article", "encuesta-card");
        tarjeta.appendChild(crear("h3", "", pregunta.titulo));

        const nota = `${datos.total} ${datos.total === 1 ? "respuesta" : "respuestas"}` +
            (pregunta.multiple ? " · se podía elegir varias" : "");
        tarjeta.appendChild(crear("p", "encuesta-nota", nota));

        const lista = crear("ul", "barras");
        datos.filas.forEach(({ opcion, n }) => {
            const pct = porcentaje(n, datos.total);
            const fila = crear("li", pregunta.riesgo.includes(opcion) ? "barra riesgo" : "barra");

            const texto = crear("div", "barra-texto");
            texto.appendChild(crear("span", "", opcion));
            texto.appendChild(crear("strong", "", `${pct}%`));
            texto.title = `${n} de ${datos.total}`;

            const pista = crear("div", "barra-pista");
            const relleno = crear("div", "barra-relleno");
            relleno.style.width = `${pct}%`;
            pista.appendChild(relleno);

            fila.append(texto, pista);
            lista.appendChild(fila);
        });
        tarjeta.appendChild(lista);

        if (pregunta.consejo) {
            tarjeta.appendChild(crear("p", "encuesta-consejo", pregunta.consejo));
        }

        return tarjeta;
    };

    const pintarEncuesta = ({ columnas, filas, actualizado: hora }) => {
        if (!filas.length) {
            mostrarAvisoEncuesta("Todavía no hay respuestas. ¡Sé la primera persona en contestar!");
            return;
        }

        // Resumen
        resumen.replaceChildren();
        const total = crear("div", "resumen-dato");
        total.append(crear("strong", "", filas.length), crear("span", "", filas.length === 1 ? "persona respondió" : "personas respondieron"));
        resumen.appendChild(total);

        RESUMEN_ENCUESTA.forEach((dato) => {
            const col = buscarColumna(columnas, dato.busca);
            if (col < 0) return;
            const valores = filas.map((f) => f[col]).filter((v) => v.trim() !== "");
            const si = valores.filter((v) => normalizarTexto(v) === normalizarTexto(dato.respuesta)).length;
            const caja = crear("div", "resumen-dato");
            caja.append(crear("strong", "", `${porcentaje(si, valores.length)}%`), crear("span", "", dato.texto));
            resumen.appendChild(caja);
        });

        // Gráficas
        rejilla.replaceChildren();
        PREGUNTAS_ENCUESTA.forEach((pregunta) => {
            const col = buscarColumna(columnas, pregunta.busca);
            if (col < 0) return;
            const datos = contarPregunta(pregunta, filas.map((f) => f[col] || ""));
            if (datos.total) rejilla.appendChild(dibujarTarjeta(pregunta, datos));
        });

        aviso.hidden = true;
        resumen.hidden = false;
        rejilla.hidden = false;
        if (hora) actualizado.textContent = `Datos actualizados: ${hora}`;
    };

    if (!HAY_SERVIDOR) {
        mostrarAvisoEncuesta("Las gráficas necesitan el servidor de Entalpia (python servidor.py).");
    } else {
        llamarApi("/api/encuesta")
            .then((datos) => {
                if (!datos.configurado) {
                    mostrarAvisoEncuesta("Las gráficas aparecerán aquí en cuanto se conecte la hoja de respuestas. Mientras, puedes contestar la encuesta.");
                } else {
                    pintarEncuesta(datos);
                }
            })
            .catch(() => mostrarAvisoEncuesta("No se pudieron cargar las respuestas en este momento. Intenta más tarde."));
    }
}


/* =========================
   DATOS REALES DEL MAPA
   Vienen de servidor.py (/api/estadisticas), que lee
   estadisticas.json generado por estadisticas.py.
========================= */

const seccionDatos = document.getElementById("datos");

function cargarDatosReales() {
    if (!seccionDatos) return;

    const aviso = seccionDatos.querySelector(".datos-aviso");
    const contenido = seccionDatos.querySelector(".datos-reales");
    const actualizado = seccionDatos.querySelector(".datos-actualizado");

    const avisar = (texto) => {
        aviso.replaceChildren(Object.assign(document.createElement("p"), { textContent: texto }));
        aviso.hidden = false;
        contenido.hidden = true;
    };

    if (!HAY_SERVIDOR) {
        avisar("Estos datos necesitan el servidor de Entalpia (python servidor.py).");
        return;
    }

    const num = (valor, decimales = 0) =>
        Number(valor).toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

    const poner = (clave, texto) => {
        const el = seccionDatos.querySelector(`[data-dato="${clave}"]`);
        if (el) el.textContent = texto;
    };

    llamarApi("/api/estadisticas")
        .then((d) => {
            if (!d.disponible) {
                avisar(d.actualizando
                    ? "Estamos descargando los datos satelitales. Vuelve en unos minutos."
                    : "Todavía no hay datos. Inicia sesión y pulsa \"Actualizar datos\" en el mapa de la demo.");
                return;
            }

            const [conf, confMin, confMax] = d.confianza_alta_pct;
            const [frp, frpMin, frpMax] = d.frp_mw;
            const [ti4, ti4Min, ti4Max] = d.brillo_ti4_k;
            const [dia] = d.dia_pct;
            const deCada100 = (pct) => Math.round(pct);

            poner("detecciones", num(d.detecciones));
            poner("acumuladas", d.acumuladas ? `Llevamos ${num(d.acumuladas)} guardados en nuestra base de datos.` : "");

            poner("confianza", `${deCada100(conf)} de 100`);
            poner("confianza-texto", "de esos puntos son casi seguro fuego real, según la NASA. El resto son señales dudosas.");
            poner("confianza-ic", `Margen: entre ${num(confMin, 1)}% y ${num(confMax, 1)}%`);

            poner("frp-mediana", `${num(d.frp_mediana_mw, 1)} MW`);
            poner("frp-texto",
                "La mayoría son fuegos pequeños: la mitad de los puntos suelta menos energía que esto. " +
                "Los MW (megawatts) miden cuánta energía en forma de calor suelta el fuego.");
            poner("frp-ic", `Promedio: ${num(frp, 1)} MW (margen: ${num(frpMin, 1)} a ${num(frpMax, 1)} MW). ` +
                "Es mayor porque unos pocos incendios grandes suben el promedio.");

            poner("brillo",
                `Vistos desde el espacio, en promedio unos ${num(ti4 - 273.15, 0)} °C. ` +
                "Parece poco para un fuego porque el satélite mide el promedio de un cuadro de unos 375 metros, " +
                "no solo las llamas.");
            poner("dia",
                `${deCada100(dia)} de cada 100 puntos se vieron de día y ${100 - deCada100(dia)} de noche. ` +
                "El satélite revisa en los dos horarios, así que el fuego no se esconde de noche.");

            poner("metodo-frp",
                `FRP (potencia radiativa del fuego): promedio ${num(frp, 2)} MW, IC 95% ${num(frpMin, 2)} – ${num(frpMax, 2)} MW; ` +
                `mediana ${num(d.frp_mediana_mw, 2)} MW. Temperatura de brillo (canal I4): ${num(ti4, 1)} K, ` +
                `IC 95% ${num(ti4Min, 1)} – ${num(ti4Max, 1)} K.`);
            poner("metodo-region", `Región analizada: ${d.fuente.region}. Muestra: ${num(d.detecciones)} detecciones.`);

            const bloqueModelo = seccionDatos.querySelector('[data-bloque="modelo"]');
            if (d.modelo) {
                const [ex, exMin, exMax] = d.modelo.exactitud;
                poner("exactitud", `${deCada100(ex)} de 100`);
                poner("exactitud-texto",
                    "Enseñamos a un programa a distinguir señales confiables de dudosas, y lo pusimos a prueba " +
                    `con ${num(d.modelo.n_prueba)} puntos que nunca había visto.`);
                poner("exactitud-ic", `Margen: entre ${num(exMin, 1)}% y ${num(exMax, 1)}%`);
                poner("metodo-modelo",
                    `Modelo: regresión logística entrenada con el 80% de las detecciones (${num(d.modelo.n_entrenamiento)}) ` +
                    `y evaluada con el 20% restante (${num(d.modelo.n_prueba)}). Exactitud ${num(ex, 1)}%, ` +
                    `exactitud balanceada ${num(d.modelo.exactitud_balanceada, 1)}%, AUC ${num(d.modelo.auc, 3)}.`);
                bloqueModelo.hidden = false;
            } else {
                bloqueModelo.hidden = true;
                poner("metodo-modelo", "");
            }

            actualizado.textContent = `Últimos datos de la NASA: ${d.actualizado}` +
                (d.actualizando ? " · actualizando ahora..." : "");
            aviso.hidden = true;
            contenido.hidden = false;
        })
        .catch(() => avisar("No se pudieron cargar los datos en este momento."));
}

cargarDatosReales();
