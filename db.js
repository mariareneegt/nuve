const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.delete("sslmode");
const caCertificate = process.env.AIVEN_CA_CERT
    ? process.env.AIVEN_CA_CERT.replace(/\\n/g, "\n")
    : fs.readFileSync(path.join(__dirname, "certs", "aiven-ca.pem"), "utf8");

const pool = new Pool({
    connectionString: databaseUrl.toString(),
    ssl: {
        ca: caCertificate,
        rejectUnauthorized: true
    }
});

module.exports = pool;
