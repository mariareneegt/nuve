const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const pool = require("./db");
const path = require("path");
const crypto = require("crypto");

require("dotenv").config();

const app = express();
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET no está configurado: las sesiones se cerrarán al reiniciar el servidor.");
}

function crearSesion(usuario) {
    const payload = Buffer.from(JSON.stringify({
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        rol: usuario.rol,
        exp: Date.now() + 8 * 60 * 60 * 1000
    })).toString("base64url");
    const firma = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    return `${payload}.${firma}`;
}

function leerSesion(req) {
    const cookies = Object.fromEntries((req.headers.cookie || "").split(";").map(cookie => {
        const [clave, ...valor] = cookie.trim().split("=");
        return [clave, valor.join("=")];
    }).filter(([clave]) => clave));
    const [payload, firma] = (cookies.nuve_session || "").split(".");
    if (!payload || !firma) return null;
    const esperada = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
    try {
        const sesion = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return sesion.exp > Date.now() ? sesion : null;
    } catch (_) {
        return null;
    }
}

function requiereSesion(...roles) {
    return (req, res, next) => {
        const sesion = leerSesion(req);
        if (!sesion) return res.status(401).json({ error: "Debes iniciar sesión" });
        if (roles.length && !roles.includes(sesion.rol)) return res.status(403).json({ error: "No tienes permiso para esta acción" });
        req.usuario = sesion;
        next();
    };
}

function requierePagina(...roles) {
    return (req, res, next) => {
        const sesion = leerSesion(req);
        if (!sesion || (roles.length && !roles.includes(sesion.rol))) return res.redirect("/");
        req.usuario = sesion;
        next();
    };
}

app.use(cors());
app.use(express.json());

// La tienda es pública. Los paneles se entregan solo con una sesión y rol válidos.
app.use("/cliente", express.static(path.join(__dirname, "public", "cliente")));
app.use("/empleado", requierePagina("EMPLEADO"), express.static(path.join(__dirname, "public", "empleado")));
app.use(express.static(path.join(__dirname, "public")));

app.get("/admin/", requierePagina("ADMIN"), (req, res) => {
    res.sendFile(path.join(__dirname, "private", "admin.html"));
});

const PORT = process.env.PORT || 3000;

// Ruta principal
app.get("/api", (req, res) => {
    res.json({
        mensaje: "API de NUVE Pastelería & Repostería funcionando correctamente"
    });
});

app.get("/api/sesion", requiereSesion(), (req, res) => {
    res.json({ usuario: req.usuario });
});

app.get("/api/empleado/perfil", requiereSesion("EMPLEADO"), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.nombre, u.correo, u.telefono, u.rol, u.estado, e.puesto, e.fecha_contratacion
             FROM usuarios u
             LEFT JOIN empleados e ON e.id_usuario = u.id_usuario
             WHERE u.id_usuario = $1`,
            [req.usuario.id_usuario]
        );
        if (!result.rows.length) return res.status(404).json({ error: "Perfil no encontrado" });
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error al obtener el perfil del empleado:", error);
        res.status(500).json({ error: "Error al obtener el perfil" });
    }
});

app.post("/api/logout", (req, res) => {
    res.setHeader("Set-Cookie", "nuve_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    res.json({ mensaje: "Sesión cerrada" });
});

app.patch("/api/mi-cuenta/password", requiereSesion(), async (req, res) => {
    try {
        const { password_actual, password_nueva } = req.body;
        if (!password_actual || !password_nueva || password_nueva.length < 8) {
            return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
        }
        const result = await pool.query("SELECT password_hash FROM usuarios WHERE id_usuario = $1", [req.usuario.id_usuario]);
        const passwordValida = result.rows[0]?.password_hash && await bcrypt.compare(password_actual, result.rows[0].password_hash);
        if (!passwordValida) return res.status(401).json({ error: "La contraseña actual es incorrecta" });
        const passwordHash = await bcrypt.hash(password_nueva, 12);
        await pool.query("UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2", [passwordHash, req.usuario.id_usuario]);
        res.json({ mensaje: "Contraseña actualizada correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar la contraseña" });
    }
});

// ============================================================
// CATEGORÍAS
// ============================================================

// Obtener todas las categorías activas
app.get("/api/categorias", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT id_categoria, nombre, descripcion, estado
      FROM categorias
      WHERE estado = 'ACTIVO'
      ORDER BY id_categoria
    `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener categorías:", error);
        res.status(500).json({
            error: "Error al obtener categorías"
        });
    }
});

// ============================================================
// PRODUCTOS
// ============================================================

// Obtener todos los productos activos
app.get("/api/productos", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        p.id_producto,
        p.id_categoria,
        c.nombre AS categoria,
        p.nombre,
        p.descripcion,
        p.precio,
        p.stock,
        p.stock_minimo,
        p.imagen,
        p.destacado,
        p.estado
      FROM productos p
      INNER JOIN categorias c
        ON p.id_categoria = c.id_categoria
      WHERE p.estado = 'ACTIVO'
      ORDER BY c.id_categoria, p.id_producto
    `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener productos:", error);
        res.status(500).json({
            error: "Error al obtener productos"
        });
    }
});

// Obtener productos por categoría
app.get("/api/productos/categoria/:id_categoria", async (req, res) => {
    try {
        const { id_categoria } = req.params;

        const result = await pool.query(
            `
      SELECT
        p.id_producto,
        p.id_categoria,
        c.nombre AS categoria,
        p.nombre,
        p.descripcion,
        p.precio,
        p.stock,
        p.imagen,
        p.destacado,
        p.estado
      FROM productos p
      INNER JOIN categorias c
        ON p.id_categoria = c.id_categoria
      WHERE p.id_categoria = $1
        AND p.estado = 'ACTIVO'
      ORDER BY p.id_producto
      `,
            [id_categoria]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener productos por categoría:", error);
        res.status(500).json({
            error: "Error al obtener productos por categoría"
        });
    }
});

// Obtener un producto por ID
app.get("/api/productos/:id_producto", async (req, res) => {
    try {
        const { id_producto } = req.params;

        const result = await pool.query(
            `
      SELECT
        p.id_producto,
        p.id_categoria,
        c.nombre AS categoria,
        p.nombre,
        p.descripcion,
        p.precio,
        p.stock,
        p.stock_minimo,
        p.imagen,
        p.destacado,
        p.estado
      FROM productos p
      INNER JOIN categorias c
        ON p.id_categoria = c.id_categoria
      WHERE p.id_producto = $1
      `,
            [id_producto]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Producto no encontrado"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error al obtener producto:", error);
        res.status(500).json({
            error: "Error al obtener producto"
        });
    }
});

// Buscar productos por nombre
app.get("/api/productos-buscar", async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                error: "Debe enviar un término de búsqueda"
            });
        }

        const result = await pool.query(
            `
      SELECT
        p.id_producto,
        p.id_categoria,
        c.nombre AS categoria,
        p.nombre,
        p.descripcion,
        p.precio,
        p.stock,
        p.imagen,
        p.estado
      FROM productos p
      INNER JOIN categorias c
        ON p.id_categoria = c.id_categoria
      WHERE LOWER(p.nombre) LIKE LOWER($1)
        AND p.estado = 'ACTIVO'
      ORDER BY p.nombre
      `,
            [`%${q}%`]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error al buscar productos:", error);
        res.status(500).json({
            error: "Error al buscar productos"
        });
    }
});

// ============================================================
// INVENTARIO
// ============================================================

// Obtener vista de inventario
app.get("/api/inventario", requiereSesion("ADMIN", "EMPLEADO"), async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        id_producto,
        categoria,
        producto,
        precio,
        stock,
        stock_minimo,
        disponibilidad,
        estado
      FROM vista_inventario
      ORDER BY categoria, producto
    `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener inventario:", error);
        res.status(500).json({
            error: "Error al obtener inventario"
        });
    }
});

// ============================================================
// USUARIOS / LOGIN SIMPLE
// ============================================================

// Registrar cliente
app.post("/api/clientes/registro", async (req, res) => {
    const client = await pool.connect();

    try {
        const { nombre, correo, password, telefono, direccion } = req.body;

        if (!nombre || !correo || !password) {
            return res.status(400).json({
                error: "Nombre, correo y contraseña son obligatorios"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
        }

        await client.query("BEGIN");

        const passwordHash = await bcrypt.hash(password, 10);

        const usuarioResult = await client.query(
            `
      INSERT INTO usuarios
      (nombre, correo, password_hash, telefono, rol, estado)
      VALUES ($1, $2, $3, $4, 'CLIENTE', 'ACTIVO')
      RETURNING id_usuario, nombre, correo, telefono, rol, estado
      `,
            [nombre, correo, passwordHash, telefono || null]
        );

        const usuario = usuarioResult.rows[0];

        const clienteResult = await client.query(
            `
      INSERT INTO clientes
      (id_usuario, nombre, telefono, direccion)
      VALUES ($1, $2, $3, $4)
      RETURNING id_cliente, id_usuario, nombre, telefono, direccion
      `,
            [usuario.id_usuario, nombre, telefono || null, direccion || null]
        );

        await client.query("COMMIT");

        res.setHeader("Set-Cookie", [
            `nuve_session=${crearSesion(usuario)}`,
            "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=28800",
            process.env.NODE_ENV === "production" ? "Secure" : ""
        ].filter(Boolean).join("; "));

        res.status(201).json({
            mensaje: "Cliente registrado correctamente",
            usuario,
            cliente: clienteResult.rows[0]
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Error al registrar cliente:", error);

        if (error.code === "23505") {
            return res.status(400).json({
                error: "El correo ya está registrado"
            });
        }

        res.status(500).json({
            error: "Error al registrar cliente"
        });
    } finally {
        client.release();
    }
});

app.get("/api/clientes/perfil", requiereSesion("CLIENTE"), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id_cliente, c.nombre, c.telefono, c.direccion, u.correo
             FROM clientes c
             INNER JOIN usuarios u ON u.id_usuario = c.id_usuario
             WHERE c.id_usuario = $1`,
            [req.usuario.id_usuario]
        );
        if (!result.rows.length) return res.status(404).json({ error: "Perfil de cliente no encontrado" });
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error al obtener perfil de cliente:", error);
        res.status(500).json({ error: "Error al obtener el perfil de cliente" });
    }
});

app.patch("/api/clientes/perfil", requiereSesion("CLIENTE"), async (req, res) => {
    const client = await pool.connect();
    try {
        const { nombre, telefono, direccion } = req.body;
        if (!nombre || !telefono || !direccion) {
            return res.status(400).json({ error: "Nombre, teléfono y dirección son obligatorios" });
        }
        await client.query("BEGIN");
        await client.query(
            "UPDATE usuarios SET nombre = $1, telefono = $2 WHERE id_usuario = $3",
            [nombre.trim(), telefono.trim(), req.usuario.id_usuario]
        );
        const result = await client.query(
            `UPDATE clientes SET nombre = $1, telefono = $2, direccion = $3
             WHERE id_usuario = $4
             RETURNING id_cliente, nombre, telefono, direccion`,
            [nombre.trim(), telefono.trim(), direccion.trim(), req.usuario.id_usuario]
        );
        await client.query("COMMIT");
        res.json({ mensaje: "Perfil actualizado correctamente", cliente: result.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error al actualizar perfil de cliente:", error);
        res.status(500).json({ error: "Error al actualizar el perfil" });
    } finally {
        client.release();
    }
});

// Login básico
app.post("/api/login", async (req, res) => {
    try {
        const { correo, password } = req.body;

        if (!correo || !password) {
            return res.status(400).json({
                error: "Correo y contraseña son obligatorios"
            });
        }

        const result = await pool.query(
            `
      SELECT
        id_usuario,
        nombre,
        correo,
        password_hash,
        telefono,
        rol,
        estado
      FROM usuarios
      WHERE correo = $1
        AND estado = 'ACTIVO'
      `,
            [correo]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: "Credenciales incorrectas"
            });
        }

        const usuario = result.rows[0];

        if (!usuario.password_hash) {
            return res.status(401).json({
                error: "El usuario no tiene contraseña configurada"
            });
        }

        const passwordValida = await bcrypt.compare(password, usuario.password_hash);

        if (!passwordValida) {
            return res.status(401).json({
                error: "Credenciales incorrectas"
            });
        }

        delete usuario.password_hash;

        const sessionCookie = [
            `nuve_session=${crearSesion(usuario)}`,
            "HttpOnly",
            "SameSite=Lax",
            "Path=/",
            "Max-Age=28800",
            process.env.NODE_ENV === "production" ? "Secure" : ""
        ].filter(Boolean).join("; ");
        res.setHeader("Set-Cookie", sessionCookie);

        res.json({
            mensaje: "Inicio de sesión correcto",
            usuario
        });
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        res.status(500).json({
            error: "Error al iniciar sesión"
        });
    }
});

// ============================================================
// PEDIDOS
// ============================================================

// Crear pedido
app.post("/api/pedidos", requiereSesion("CLIENTE"), async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            id_cliente,
            modalidad_pago,
            forma_pago,
            productos
        } = req.body;

        if (!id_cliente || !modalidad_pago || !forma_pago || !productos || productos.length === 0) {
            return res.status(400).json({
                error: "Datos incompletos para crear el pedido"
            });
        }

        const clienteResult = await client.query(
            "SELECT id_cliente FROM clientes WHERE id_cliente = $1 AND id_usuario = $2",
            [id_cliente, req.usuario.id_usuario]
        );
        if (clienteResult.rows.length === 0) {
            return res.status(403).json({ error: "No puedes crear pedidos para otro cliente" });
        }

        await client.query("BEGIN");

        let total = 0;
        const detallesCalculados = [];

        for (const item of productos) {
            const productoResult = await client.query(
                `
        SELECT id_producto, nombre, precio, stock
        FROM productos
        WHERE id_producto = $1
          AND estado = 'ACTIVO'
        `,
                [item.id_producto]
            );

            if (productoResult.rows.length === 0) {
                throw new Error(`Producto no encontrado: ${item.id_producto}`);
            }

            const producto = productoResult.rows[0];

            if (producto.stock < item.cantidad) {
                throw new Error(`Stock insuficiente para el producto: ${producto.nombre}`);
            }

            const subtotal = Number(producto.precio) * Number(item.cantidad);
            total += subtotal;

            detallesCalculados.push({
                id_producto: producto.id_producto,
                cantidad: item.cantidad,
                precio_unitario: producto.precio,
                subtotal
            });
        }

        const pedidoResult = await client.query(
            `
      INSERT INTO pedidos
      (id_cliente, total, modalidad_pago, forma_pago, estado_pedido)
      VALUES ($1, $2, $3, $4, 'PENDIENTE')
      RETURNING *
      `,
            [id_cliente, total, modalidad_pago, forma_pago]
        );

        const pedido = pedidoResult.rows[0];

        for (const detalle of detallesCalculados) {
            await client.query(
                `
        INSERT INTO detalle_pedido
        (id_pedido, id_producto, cantidad, precio_unitario, subtotal)
        VALUES ($1, $2, $3, $4, $5)
        `,
                [
                    pedido.id_pedido,
                    detalle.id_producto,
                    detalle.cantidad,
                    detalle.precio_unitario,
                    detalle.subtotal
                ]
            );

            await client.query(
                `
        UPDATE productos
        SET stock = stock - $1
        WHERE id_producto = $2
        `,
                [detalle.cantidad, detalle.id_producto]
            );
        }

        await client.query("COMMIT");

        res.status(201).json({
            mensaje: "Pedido creado correctamente",
            pedido,
            detalle: detallesCalculados
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Error al crear pedido:", error);

        res.status(500).json({
            error: error.message || "Error al crear pedido"
        });
    } finally {
        client.release();
    }
});

// Obtener pedidos
app.get("/api/pedidos", requiereSesion("ADMIN", "EMPLEADO"), async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        p.id_pedido,
        p.id_cliente,
        c.nombre AS cliente,
        p.fecha_pedido,
        p.total,
        p.modalidad_pago,
        p.forma_pago,
        p.estado_pedido
      FROM pedidos p
      INNER JOIN clientes c
        ON p.id_cliente = c.id_cliente
      ORDER BY p.fecha_pedido DESC
    `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener pedidos:", error);
        res.status(500).json({
            error: "Error al obtener pedidos"
        });
    }
});

// Obtener detalle de un pedido
app.get("/api/pedidos/:id_pedido", requiereSesion("ADMIN", "EMPLEADO"), async (req, res) => {
    try {
        const { id_pedido } = req.params;

        const pedidoResult = await pool.query(
            `
      SELECT
        p.id_pedido,
        p.id_cliente,
        c.nombre AS cliente,
        p.fecha_pedido,
        p.total,
        p.modalidad_pago,
        p.forma_pago,
        p.estado_pedido
      FROM pedidos p
      INNER JOIN clientes c
        ON p.id_cliente = c.id_cliente
      WHERE p.id_pedido = $1
      `,
            [id_pedido]
        );

        if (pedidoResult.rows.length === 0) {
            return res.status(404).json({
                error: "Pedido no encontrado"
            });
        }

        const detalleResult = await pool.query(
            `
      SELECT
        d.id_detalle,
        d.id_producto,
        pr.nombre AS producto,
        d.cantidad,
        d.precio_unitario,
        d.subtotal
      FROM detalle_pedido d
      INNER JOIN productos pr
        ON d.id_producto = pr.id_producto
      WHERE d.id_pedido = $1
      ORDER BY d.id_detalle
      `,
            [id_pedido]
        );

        res.json({
            pedido: pedidoResult.rows[0],
            detalle: detalleResult.rows
        });
    } catch (error) {
        console.error("Error al obtener pedido:", error);
        res.status(500).json({
            error: "Error al obtener pedido"
        });
    }
});

// Actualizar estado de pedido
app.patch("/api/pedidos/:id_pedido/estado", requiereSesion("ADMIN", "EMPLEADO"), async (req, res) => {
    try {
        const { id_pedido } = req.params;
        const { estado_pedido } = req.body;

        const estadosPermitidos = [
            "PENDIENTE",
            "CONFIRMADO",
            "EN PREPARACION",
            "LISTO",
            "EN CAMINO",
            "ENTREGADO",
            "CANCELADO"
        ];

        if (!estadosPermitidos.includes(estado_pedido)) {
            return res.status(400).json({
                error: "Estado de pedido no válido"
            });
        }

        const result = await pool.query(
            `
      UPDATE pedidos
      SET estado_pedido = $1
      WHERE id_pedido = $2
      RETURNING *
      `,
            [estado_pedido, id_pedido]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Pedido no encontrado"
            });
        }

        res.json({
            mensaje: "Estado actualizado correctamente",
            pedido: result.rows[0]
        });
    } catch (error) {
        console.error("Error al actualizar estado:", error);
        res.status(500).json({
            error: "Error al actualizar estado"
        });
    }
});

// ============================================================
// DASHBOARD SIMPLE
// ============================================================

app.get("/api/dashboard", requiereSesion("ADMIN"), async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM categorias) AS total_categorias,
        (SELECT COUNT(*) FROM productos) AS total_productos,
        (SELECT COUNT(*) FROM usuarios) AS total_usuarios,
        (SELECT COUNT(*) FROM clientes) AS total_clientes,
        (SELECT COUNT(*) FROM empleados) AS total_empleados,
        (SELECT COUNT(*) FROM pedidos) AS total_pedidos,
        (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE estado_pedido <> 'CANCELADO') AS total_ventas
    `);

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error al obtener dashboard:", error);
        res.status(500).json({
            error: "Error al obtener dashboard"
        });
    }
});

app.get("/api/usuarios", requiereSesion("ADMIN"), async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id_usuario, nombre, correo, telefono, rol, estado FROM usuarios ORDER BY nombre"
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ error: "Error al obtener usuarios" });
    }
});

app.post("/api/admin/usuarios", requiereSesion("ADMIN"), async (req, res) => {
    const client = await pool.connect();
    try {
        const { nombre, correo, password, telefono, rol, puesto, fecha_contratacion } = req.body;
        const nombreLimpio = String(nombre || "").trim();
        const correoLimpio = String(correo || "").trim().toLowerCase();
        const telefonoLimpio = String(telefono || "").trim() || null;

        if (!nombreLimpio || !correoLimpio || !password) {
            return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios" });
        }
        if (String(password).length < 8) {
            return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
        }
        if (!["EMPLEADO", "ADMIN"].includes(rol)) {
            return res.status(400).json({ error: "Solo puedes registrar empleados o administradores desde este panel" });
        }
        if (rol === "EMPLEADO" && !String(puesto || "").trim()) {
            return res.status(400).json({ error: "El puesto es obligatorio para un empleado" });
        }

        await client.query("BEGIN");
        const passwordHash = await bcrypt.hash(String(password), 10);
        const userResult = await client.query(
            `INSERT INTO usuarios (nombre, correo, password_hash, telefono, rol, estado)
             VALUES ($1, $2, $3, $4, $5, 'ACTIVO')
             RETURNING id_usuario, nombre, correo, telefono, rol, estado`,
            [nombreLimpio, correoLimpio, passwordHash, telefonoLimpio, rol]
        );
        const usuario = userResult.rows[0];

        if (rol === "EMPLEADO") {
            await client.query(
                `INSERT INTO empleados (id_usuario, nombre, telefono, puesto, fecha_contratacion)
                 VALUES ($1, $2, $3, $4, $5)`,
                [usuario.id_usuario, usuario.nombre, usuario.telefono, String(puesto).trim(), fecha_contratacion || null]
            );
        }

        await client.query("COMMIT");
        res.status(201).json({ mensaje: `${rol === "ADMIN" ? "Administrador" : "Empleado"} registrado correctamente`, usuario });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error al registrar usuario administrativo:", error);
        if (error.code === "23505") return res.status(400).json({ error: "El correo ya está registrado" });
        res.status(500).json({ error: "Error al registrar el usuario" });
    } finally {
        client.release();
    }
});

app.get("/api/admin/productos", requiereSesion("ADMIN"), async (req, res) => {
    try {
        const result = await pool.query(`SELECT p.id_producto, p.nombre, p.precio, p.stock, p.estado, c.nombre AS categoria FROM productos p INNER JOIN categorias c ON c.id_categoria = p.id_categoria ORDER BY c.nombre, p.nombre`);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Error al obtener productos" }); }
});

app.patch("/api/admin/productos/:id_producto", requiereSesion("ADMIN"), async (req, res) => {
    try {
        const idProducto = Number(req.params.id_producto);
        const { precio, sumar_stock, estado } = req.body;
        if (!Number.isInteger(idProducto) || !["ACTIVO", "INACTIVO"].includes(estado) || Number(precio) < 0 || !Number.isInteger(Number(sumar_stock)) || Number(sumar_stock) < 0) return res.status(400).json({ error: "Datos de producto no válidos" });
        const result = await pool.query("UPDATE productos SET precio = $1, stock = stock + $2, estado = $3 WHERE id_producto = $4 RETURNING id_producto, nombre, precio, stock, estado", [precio, sumar_stock, estado, idProducto]);
        if (!result.rows.length) return res.status(404).json({ error: "Producto no encontrado" });
        res.json({ mensaje: "Producto actualizado correctamente", producto: result.rows[0] });
    } catch (error) { res.status(500).json({ error: "Error al actualizar producto" }); }
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
    console.log(`API de NUVE ejecutándose en puerto ${PORT}`);
});
