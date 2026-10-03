// Disposable Electron probe; copied into an isolated Flatpak app during prototype testing.
const { X509Certificate, createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const fixtures = path.join(process.resourcesPath, "probe-fixtures");
const certificate = fs.readFileSync(path.join(fixtures, "client.crt"), "utf8");
const expectedFingerprint =
  process.env.MTLS_PROBE_FINGERPRINT ??
  createHash("sha256").update(new X509Certificate(certificate).raw).digest("hex");

app.on("select-client-certificate", (event, webContents, url, list, callback) => {
  event.preventDefault();
  const selected = list.find((offered) => {
    try {
      const der = new X509Certificate(offered.data).raw;
      return createHash("sha256").update(der).digest("hex") === expectedFingerprint;
    } catch {
      return false;
    }
  });
  console.log(
    "probe-selection",
    JSON.stringify({
      url: String(url),
      renderer: webContents !== null,
      offered: list.length,
      matched: selected !== undefined,
    }),
  );
  callback(selected);
});

const tokenPasswordFile = path.join(fixtures, "nss-password");
if (fs.existsSync(tokenPasswordFile)) {
  let retrySeen = false;
  app.setClientCertRequestPasswordHandler(async ({ hostname, tokenName, isRetry }) => {
    if (isRetry) {
      if (!retrySeen) {
        retrySeen = true;
        console.log("probe-token-unlock-rejected", JSON.stringify({ hostname, tokenName }));
      }
      process.exit(2);
    }
    console.log("probe-token-unlock", JSON.stringify({ hostname, tokenName }));
    return fs.readFileSync(tokenPasswordFile, "utf8");
  });
}

app.whenReady().then(async () => {
  if (process.env.MTLS_PROBE_SKIP_IMPORT !== "1") {
    const password = fs.readFileSync(path.join(fixtures, "client-password"), "utf8");
    const result = await new Promise((resolve) =>
      app.importCertificate({ certificate: path.join(fixtures, "client.p12"), password }, resolve),
    );
    console.log("probe-import", result);
    if (result !== 0) {
      app.quit();
      return;
    }
  }
  const window = new BrowserWindow({
    show: false,
    webPreferences: { partition: "persist:bitwarden" },
  });
  window.webContents.on("console-message", (_event, level, message) => {
    console.log("probe-console", level, message);
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    console.log("probe-load-failed", code, description);
  });
  await window
    .loadURL(process.env.MTLS_PROBE_URL ?? "https://localhost:8443/probe")
    .catch((error) => {
      console.log("probe-load-error", error.message);
    });
  setTimeout(() => app.quit(), 5000);
});
