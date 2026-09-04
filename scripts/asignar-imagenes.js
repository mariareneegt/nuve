const fs = require("fs");
const path = require("path");
const pool = require("../db");

const normalizar = (valor) => String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Producto en la BD -> nombre descriptivo del archivo de imagen.
const imagenesPorProducto = {
    "Café americano": "Cafe americano",
    Cappuccino: "Cappuccino",
    Latte: "Latte",
    Moca: "Moca",
    "Chocolate caliente": "Chocolate caliente",
    "Frappé de café": "Frappe de cafe",
    "Té chai": "Te chai",
    "Limonada natural": "Limonada natural",
    "Smoothie de fresa": "Smoothie de fresa",
    "Jugo de naranja": "naranja",
    Cheesecake: "Cheesecake",
    Tiramisú: "tiramisu",
    "Brownie con chocolate": "Brownie con chocolate",
    "Galletas con chispas de chocolate": "Galletas con chispas",
    "Flan de caramelo": "Flan de Caramelo",
    "Tres leches": "tres leche",
    "Pie de limón": "pie de limon",
    "Donas glaseadas": "donas",
    Muffins: "muffins",
    "Crepas con fruta": "crepas",
    Chocolate: "chocolate",
    Vainilla: "vainilla",
    Fresa: "fresa",
    "Red velvet": "Red velvet",
    Zanahoria: "Zanahoria",
    Limón: "Limon",
    Café: "cafe",
    Oreo: "oreo",
    Coco: "coco",
    "Chocolate con avellana": "Chocolate con avellana",
    "Sándwich de jamón y queso": "Sandwich de Jamon y Queso",
    "Croissant de pollo": "Croissant de Pollo",
    "Panini de pollo y queso": "Panini de Pollo y Queso",
    "Bagel con huevo y queso": "Bagel con Huevo",
    "Ensalada César": "Cesar",
    "Wrap de pollo": "tortilla",
    "Tostadas con aguacate": "tostada",
    "Omelette con vegetales": "omelette",
    "Nachos con queso": "nacho",
    "Crepa de jamón y queso": "creppa"
};

const carpetaImagenes = path.join(__dirname, "..", "public", "cliente");
const archivos = fs.readdirSync(carpetaImagenes).filter((archivo) => /\.(png|jpe?g)$/i.test(archivo));
const porNombreNormalizado = new Map(archivos.map((archivo) => [normalizar(path.parse(archivo).name), archivo]));

(async () => {
    const client = await pool.connect();
    try {
        const productos = (await client.query("SELECT id_producto, nombre FROM productos ORDER BY id_producto")).rows;
        const pendientes = [];
        const asignaciones = productos.map((producto) => {
            const referencia = imagenesPorProducto[producto.nombre];
            const archivo = referencia && porNombreNormalizado.get(normalizar(referencia));
            if (!archivo) pendientes.push(producto.nombre);
            return { ...producto, archivo };
        });

        if (pendientes.length) {
            throw new Error(`No se encontró imagen para: ${pendientes.join(", ")}`);
        }

        await client.query("BEGIN");
        for (const asignacion of asignaciones) {
            await client.query(
                "UPDATE productos SET imagen = $1 WHERE id_producto = $2",
                [asignacion.archivo, asignacion.id_producto]
            );
        }
        await client.query("COMMIT");
        console.log(`${asignaciones.length} imágenes asociadas correctamente.`);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(`No se pudieron asociar las imágenes: ${error.message}`);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();
