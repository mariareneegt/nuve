// ==========================================
// PANEL DE EMPLEADO - NUVE
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

    // ======================================
    // ELEMENTOS PRINCIPALES
    // ======================================

    const menuItems = document.querySelectorAll(".menu-item");
    const views = document.querySelectorAll(".view");

    const pageTitle = document.getElementById("pageTitle");
    const toast = document.getElementById("toast");

    const logoutButton = document.getElementById("logoutButton");
    const employeeProfileToggle = document.getElementById("employeeProfileToggle");
    const employeeDropdown = document.getElementById("employeeDropdown");
    const profileLogout = document.getElementById("profileLogout");
    const employeeChangePassword = document.getElementById("employeeChangePassword");

    const goToPedidosButton = document.querySelector(
        '[data-go="pedidos"]'
    );


    // ======================================
    // TÍTULOS DE LAS VISTAS
    // ======================================

    const viewTitles = {
        inicio: "Panel general",
        pedidos: "Pedidos",
        productos: "Productos",
        cuenta: "Mi cuenta"
    };


    // ======================================
    // CAMBIAR DE VISTA
    // ======================================

    function changeView(viewName) {

        // Ocultar todas las vistas
        views.forEach(function (view) {
            view.classList.remove("active");
        });


        // Quitar selección del menú
        menuItems.forEach(function (item) {
            item.classList.remove("active");
        });


        // Buscar la vista seleccionada
        const selectedView = document.getElementById(
            "view-" + viewName
        );


        // Mostrarla
        if (selectedView) {
            selectedView.classList.add("active");
        }


        // Marcar botón del menú
        const selectedMenuItem = document.querySelector(
            '[data-view="' + viewName + '"]'
        );

        if (selectedMenuItem) {
            selectedMenuItem.classList.add("active");
        }


        // Cambiar título superior
        if (pageTitle && viewTitles[viewName]) {
            pageTitle.textContent = viewTitles[viewName];
        }


        // Volver arriba
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        // Cada sección siempre muestra datos actuales de la API.
        cargarDatosReales();
    }


    // ======================================
    // BOTONES DEL MENÚ
    // ======================================

    menuItems.forEach(function (item) {

        item.addEventListener("click", function () {

            const viewName = item.dataset.view;

            changeView(viewName);

        });

    });


    // ======================================
    // BOTÓN "VER TODOS"
    // ======================================

    if (goToPedidosButton) {

        goToPedidosButton.addEventListener(
            "click",
            function () {

                changeView("pedidos");

            }
        );

    }


    // ======================================
    // MOSTRAR MENSAJE
    // ======================================

    function showToast(message) {

        if (!toast) {
            return;
        }

        toast.textContent = message;

        toast.classList.add("show");


        setTimeout(function () {

            toast.classList.remove("show");

        }, 2500);

    }


    // ======================================
    // PEDIDOS DEL PANEL GENERAL
    // ======================================

    const startButtons = document.querySelectorAll(
        ".start-order"
    );


    startButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const orderCard = button.closest(".order-card");

            const status = orderCard.querySelector(".status");


            // Cambiar estado
            status.textContent = "En proceso";

            status.classList.remove("pending");

            status.classList.add("process");


            // Cambiar botón
            button.textContent = "Marcar completado";

            button.classList.remove("start-order");

            button.classList.add("complete-order");


            showToast(
                "Pedido enviado a preparación."
            );


            updateStatistics();

        });

    });


    // ======================================
    // COMPLETAR PEDIDOS
    // ======================================

    document.addEventListener("click", function (event) {

        const button = event.target.closest(
            ".complete-order"
        );


        if (!button) {
            return;
        }


        const orderCard = button.closest(".order-card");


        if (!orderCard) {
            return;
        }


        const status = orderCard.querySelector(".status");


        status.textContent = "Completado";

        status.classList.remove(
            "pending",
            "process"
        );

        status.classList.add("completed");


        button.textContent = "Completado";

        button.disabled = true;


        showToast(
            "Pedido marcado como completado."
        );


        updateStatistics();

    });


    // ======================================
    // ACTUALIZAR ESTADÍSTICAS
    // ======================================

    function updateStatistics() {

        const orderCards = document.querySelectorAll(
            "#view-inicio .order-card"
        );


        let pendientes = 0;
        let proceso = 0;
        let completados = 0;


        orderCards.forEach(function (card) {

            const status = card.querySelector(".status");


            if (status.classList.contains("pending")) {

                pendientes++;

            }


            if (status.classList.contains("process")) {

                proceso++;

            }


            if (status.classList.contains("completed")) {

                completados++;

            }

        });


        const statPendientes =
            document.getElementById("statPendientes");

        const statProceso =
            document.getElementById("statProceso");

        const statCompletados =
            document.getElementById("statCompletados");


        if (statPendientes) {
            statPendientes.textContent = pendientes;
        }


        if (statProceso) {
            statProceso.textContent = proceso;
        }


        if (statCompletados) {
            statCompletados.textContent = completados;
        }

    }


    // ======================================
    // BOTONES DE LA TABLA DE PEDIDOS
    // ======================================

    const tableButtons =
        document.querySelectorAll(".small-button");


    tableButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const row = button.closest("tr");

            const status = row.querySelector(".status");


            // PENDIENTE -> EN PROCESO

            if (
                status.classList.contains("pending")
            ) {

                status.textContent = "En proceso";

                status.classList.remove("pending");

                status.classList.add("process");

                button.textContent = "Completar";


                showToast(
                    "Pedido iniciado correctamente."
                );

                return;
            }


            // EN PROCESO -> COMPLETADO

            if (
                status.classList.contains("process")
            ) {

                status.textContent = "Completado";

                status.classList.remove("process");

                status.classList.add("completed");

                button.remove();


                showToast(
                    "Pedido completado correctamente."
                );

            }

        });

    });


    // ======================================
    // FILTROS DE PEDIDOS
    // ======================================

    const filters =
        document.querySelectorAll("#view-pedidos .filter");


    filters.forEach(function (filter) {

        filter.addEventListener("click", function () {

            // Cambiar filtro activo

            filters.forEach(function (item) {
                item.classList.remove("active");
            });


            filter.classList.add("active");


            const selectedFilter =
                filter.textContent.trim().toLowerCase();


            const rows =
                document.querySelectorAll(
                    "#view-pedidos tbody tr"
                );


            rows.forEach(function (row) {

                const status =
                    row.querySelector(".status");


                if (!status) {
                    return;
                }


                const statusText =
                    status.textContent
                        .trim()
                        .toLowerCase();


                if (selectedFilter === "todos") {

                    row.style.display = "";

                    return;

                }


                if (
                    selectedFilter === "pendientes" &&
                    statusText === "pendiente"
                ) {

                    row.style.display = "";

                    return;

                }


                if (
                    selectedFilter === "en proceso" &&
                    statusText === "en proceso"
                ) {

                    row.style.display = "";

                    return;

                }


                if (
                    selectedFilter === "completados" &&
                    statusText === "completado"
                ) {

                    row.style.display = "";

                    return;

                }


                row.style.display = "none";

            });

        });

    });


    // ======================================
    // CERRAR SESIÓN
    // ======================================

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            function () {

                const confirmLogout = confirm(
                    "¿Deseas cerrar sesión?"
                );


                if (confirmLogout) {
                    fetch("/api/logout", { method: "POST" })
                        .finally(function () {
                            sessionStorage.removeItem("nuveUser");
                            window.location.assign("/");
                        });

                }

            }
        );

    }


    // ======================================
    // FECHA ACTUAL
    // ======================================

    const currentDate =
        document.getElementById("currentDate");


    if (currentDate) {

        const today = new Date();


        const formattedDate =
            today.toLocaleDateString(
                "es-GT",
                {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                }
            );


        currentDate.textContent =
            formattedDate.charAt(0).toUpperCase() +
            formattedDate.slice(1);

    }


    // ======================================
    // INICIAR ESTADÍSTICAS
    // ======================================

    const escapar = function (valor) {
        return String(valor ?? "").replace(/[&<>"]/g, function (caracter) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[caracter];
        });
    };

    const formatoEstado = function (estado) {
        const estados = {
            PENDIENTE: ["Pendiente", "pending"],
            CONFIRMADO: ["Pendiente", "pending"],
            "EN PREPARACION": ["En proceso", "process"],
            LISTO: ["Completado", "completed"],
            ENTREGADO: ["Completado", "completed"],
            CANCELADO: ["Cancelado", "unavailable"]
        };
        return estados[estado] || [estado, "pending"];
    };

    const siguienteAccion = function (estado) {
        if (estado === "PENDIENTE" || estado === "CONFIRMADO") return ["EN PREPARACION", "Preparar"];
        if (estado === "EN PREPARACION") return ["LISTO", "Completar"];
        return null;
    };

    let versionCarga = 0;

    async function cargarDatosReales() {
        const cargaSolicitada = ++versionCarga;
        document.querySelectorAll("#view-inicio .stat-card strong").forEach(function (elemento) {
            elemento.textContent = "—";
        });
        document.querySelector(".orders-list").innerHTML = "<p>Cargando pedidos…</p>";
        document.querySelector("#view-pedidos tbody").innerHTML = "<tr><td colspan=6>Cargando pedidos…</td></tr>";
        document.querySelector("#view-productos tbody").innerHTML = "<tr><td colspan=5>Cargando productos…</td></tr>";
        try {
            const respuestas = await Promise.all([
                fetch("/api/empleado/perfil"),
                fetch("/api/pedidos"),
                fetch("/api/inventario")
            ]);
            const datos = await Promise.all(respuestas.map(function (respuesta) {
                if (!respuesta.ok) throw new Error("No se pudo cargar la información del panel.");
                return respuesta.json();
            }));
            const perfil = datos[0];
            const pedidos = datos[1];
            const inventario = datos[2];
            if (cargaSolicitada !== versionCarga) return;

            document.querySelectorAll(".employee-profile strong, .account-header h3, .account-information strong").forEach(function (elemento, indice) {
                if (indice === 0 || indice === 1 || indice === 2) elemento.textContent = perfil.nombre;
            });
            document.querySelector(".employee-profile span").textContent = perfil.puesto || "Empleado";
            const cuenta = document.querySelectorAll(".account-information strong");
            if (cuenta[1]) cuenta[1].textContent = perfil.puesto || "Empleado";
            if (cuenta[2]) cuenta[2].textContent = perfil.estado === "ACTIVO" ? "Activo" : "Inactivo";

            const pendientes = pedidos.filter(function (pedido) { return ["PENDIENTE", "CONFIRMADO"].includes(pedido.estado_pedido); }).length;
            const proceso = pedidos.filter(function (pedido) { return pedido.estado_pedido === "EN PREPARACION"; }).length;
            const completados = pedidos.filter(function (pedido) { return ["LISTO", "ENTREGADO"].includes(pedido.estado_pedido); }).length;
            document.getElementById("statPendientes").textContent = pendientes;
            document.getElementById("statProceso").textContent = proceso;
            document.getElementById("statCompletados").textContent = completados;
            document.querySelector("#view-inicio .stats-grid .stat-card:last-child strong").textContent = inventario.filter(function (item) { return Number(item.stock) > 0; }).length;

            const atencion = pedidos.filter(function (pedido) { return siguienteAccion(pedido.estado_pedido); }).slice(0, 5);
            document.querySelector(".orders-list").innerHTML = atencion.length ? atencion.map(function (pedido) {
                const estado = formatoEstado(pedido.estado_pedido);
                const accion = siguienteAccion(pedido.estado_pedido);
                return `<article class="order-card"><div class="order-number">#${escapar(pedido.id_pedido)}</div><div class="order-information"><strong>${escapar(pedido.cliente)}</strong><span>${escapar(pedido.modalidad_pago)} · Q${Number(pedido.total).toFixed(2)}</span></div><span class="status ${estado[1]}">${estado[0]}</span><button class="action-button remote-order-action" data-id="${pedido.id_pedido}" data-next="${accion[0]}">${accion[1]}</button></article>`;
            }).join("") : "<p>No hay pedidos que requieran atención.</p>";

            document.querySelector("#view-pedidos tbody").innerHTML = pedidos.map(function (pedido) {
                const estado = formatoEstado(pedido.estado_pedido);
                const accion = siguienteAccion(pedido.estado_pedido);
                return `<tr><td>#${escapar(pedido.id_pedido)}</td><td>${escapar(pedido.cliente)}</td><td>${escapar(pedido.modalidad_pago)}</td><td>Q${Number(pedido.total).toFixed(2)}</td><td><span class="status ${estado[1]}">${estado[0]}</span></td><td>${accion ? `<button class="small-button remote-order-action" data-id="${pedido.id_pedido}" data-next="${accion[0]}">${accion[1]}</button>` : "—"}</td></tr>`;
            }).join("") || "<tr><td colspan=6>No hay pedidos registrados.</td></tr>";

            document.querySelector("#view-productos tbody").innerHTML = inventario.map(function (producto) {
                const disponible = Number(producto.stock) > 0;
                return `<tr><td>${escapar(producto.producto)}</td><td>${escapar(producto.categoria)}</td><td>Q${Number(producto.precio).toFixed(2)}</td><td>${escapar(producto.stock)}</td><td><span class="status ${disponible ? "completed" : "unavailable"}">${disponible ? "Disponible" : "Agotado"}</span></td></tr>`;
            }).join("") || "<tr><td colspan=5>No hay productos registrados.</td></tr>";
            document.body.classList.remove("employee-loading");
        } catch (error) {
            if (cargaSolicitada !== versionCarga) return;
            document.querySelector(".orders-list").innerHTML = "<p>No se pudieron cargar los datos del panel.</p>";
            document.body.classList.remove("employee-loading");
            showToast(error.message);
        }
    }

    document.addEventListener("click", function (event) {
        const boton = event.target.closest(".remote-order-action");
        if (!boton) return;
        boton.disabled = true;
        fetch(`/api/pedidos/${boton.dataset.id}/estado`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado_pedido: boton.dataset.next })
        }).then(function (respuesta) {
            if (!respuesta.ok) throw new Error("No se pudo actualizar el pedido.");
            showToast("Pedido actualizado correctamente.");
            return cargarDatosReales();
        }).catch(function (error) {
            showToast(error.message);
            boton.disabled = false;
        });
    });

    function cerrarMenuPerfil() {
        if (!employeeDropdown || !employeeProfileToggle) return;
        employeeDropdown.hidden = true;
        employeeProfileToggle.setAttribute("aria-expanded", "false");
    }

    employeeProfileToggle?.addEventListener("click", function () {
        const abierto = employeeProfileToggle.getAttribute("aria-expanded") === "true";
        employeeDropdown.hidden = abierto;
        employeeProfileToggle.setAttribute("aria-expanded", String(!abierto));
    });

    employeeDropdown?.addEventListener("click", function (event) {
        const option = event.target.closest("[data-profile-view]");
        if (!option) return;
        changeView(option.dataset.profileView);
        cerrarMenuPerfil();
    });

    document.addEventListener("click", function (event) {
        if (employeeDropdown && !event.target.closest(".profile-menu")) cerrarMenuPerfil();
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") cerrarMenuPerfil();
    });

    profileLogout?.addEventListener("click", function () {
        logoutButton?.click();
    });

    employeeChangePassword?.addEventListener("click", function () {
        window.openPasswordDialog();
    });

    cargarDatosReales();


    console.log(
        "Panel de empleado Nuve cargado correctamente."
    );

});
