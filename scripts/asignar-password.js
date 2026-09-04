const bcrypt = require("bcryptjs");
const pool = require("../db");

const [correo, password] = process.argv.slice(2);
if (!correo || !password || password.length < 8) {
    console.error("Uso: npm run asignar-password -- correo@nuve.com contraseña-de-8-caracteres-o-más");
    process.exit(1);
}

(async () => {
    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const result = await pool.query(
            "UPDATE usuarios SET password_hash = $1 WHERE correo = $2 AND estado = 'ACTIVO' RETURNING nombre, correo, rol",
            [passwordHash, correo.toLowerCase()]
        );
        if (!result.rows.length) throw new Error("No existe un usuario activo con ese correo");
        const usuario = result.rows[0];
        console.log(`Contraseña actualizada para ${usuario.nombre} (${usuario.rol}).`);
    } catch (error) {
        console.error(`No se pudo actualizar la contraseña: ${error.message}`);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
