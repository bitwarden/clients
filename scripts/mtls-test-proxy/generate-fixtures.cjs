// Disposable local certificates only. Outputs are ignored under .flatpak/mtls-fixtures.
const { randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const directory = path.resolve(process.argv[2] ?? ".flatpak/mtls-fixtures");
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });

function openssl(...args) {
  const result = spawnSync("openssl", args, { cwd: directory, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`openssl failed with status ${result.status}`);
  }
}

const passwordFile = path.join(directory, "client-password");
fs.writeFileSync(passwordFile, randomBytes(24).toString("base64url"), { mode: 0o600 });

openssl(
  "req",
  "-x509",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  "ca.key",
  "-out",
  "ca.crt",
  "-days",
  "2",
  "-subj",
  "/CN=Bitwarden mTLS test CA",
  "-addext",
  "basicConstraints=critical,CA:TRUE",
);
openssl(
  "req",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  "server.key",
  "-out",
  "server.csr",
  "-subj",
  "/CN=localhost",
  "-addext",
  "subjectAltName=DNS:localhost,IP:127.0.0.1",
);
fs.writeFileSync(
  path.join(directory, "server.ext"),
  "subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n",
);
openssl(
  "x509",
  "-req",
  "-in",
  "server.csr",
  "-CA",
  "ca.crt",
  "-CAkey",
  "ca.key",
  "-CAcreateserial",
  "-out",
  "server.crt",
  "-days",
  "2",
  "-extfile",
  "server.ext",
);
openssl(
  "req",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  "client.key",
  "-out",
  "client.csr",
  "-subj",
  "/CN=Bitwarden mTLS test client",
);
fs.writeFileSync(path.join(directory, "client.ext"), "extendedKeyUsage=clientAuth\n");
openssl(
  "x509",
  "-req",
  "-in",
  "client.csr",
  "-CA",
  "ca.crt",
  "-CAkey",
  "ca.key",
  "-CAcreateserial",
  "-out",
  "client.crt",
  "-days",
  "2",
  "-extfile",
  "client.ext",
);
openssl(
  "pkcs12",
  "-export",
  "-inkey",
  "client.key",
  "-in",
  "client.crt",
  "-certfile",
  "ca.crt",
  "-out",
  "client.p12",
  "-passout",
  `file:${passwordFile}`,
);

console.log(`Fixtures ready in ${directory}`);
console.log(`Client bundle: ${path.join(directory, "client.p12")}`);
console.log(`Password file: ${passwordFile}`);
