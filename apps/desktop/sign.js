/* eslint-disable @typescript-eslint/no-require-imports, no-console */

exports.default = async function (configuration) {
  if (
    parseInt(process.env.ELECTRON_BUILDER_SIGN) === 1 &&
    (configuration.path.endsWith(".exe") ||
      configuration.path.endsWith(".appx") ||
      configuration.path.endsWith(".msix"))
  ) {
    console.log(`[*] Signing file: ${configuration.path}`);

    // If signing APPX/MSIX, inspect the manifest Publisher before signing
    if (configuration.path.endsWith(".appx") || configuration.path.endsWith(".msix")) {
      try {
        const path = require("path");
        const fs = require("fs");

        // Extract architecture from filename (e.g., "Bitwarden-2025.10.2-x64.appx" -> "x64")
        const filename = path.basename(configuration.path);
        const archMatch = filename.match(/-(x64|arm64|ia32)\.(appx|msix)$/);

        if (archMatch) {
          const arch = archMatch[1];
          const distDir = path.dirname(configuration.path);
          const manifestPath = path.join(distDir, `__appx-${arch}`, "AppxManifest.xml");

          if (fs.existsSync(manifestPath)) {
            const manifestContent = fs.readFileSync(manifestPath, "utf8");

            // Extract and display the Publisher line
            const publisherMatch = manifestContent.match(/Publisher='([^']+)'/);
            if (publisherMatch) {
              console.log(`[*] APPX Manifest Publisher: ${publisherMatch[1]}`);
            }
          } else {
            console.log(`[!] Manifest not found at: ${manifestPath}`);
          }
        }
      } catch (error) {
        console.log(`[!] Failed to read manifest: ${error.message}`);
      }
    }

    require("child_process").execSync(
      `azuresigntool sign -v ` +
        `-kvu ${process.env.SIGNING_VAULT_URL} ` +
        `-kvi ${process.env.SIGNING_CLIENT_ID} ` +
        `-kvt ${process.env.SIGNING_TENANT_ID} ` +
        `-kvs ${process.env.SIGNING_CLIENT_SECRET} ` +
        `-kvc ${process.env.SIGNING_CERT_NAME} ` +
        `-fd ${configuration.hash} ` +
        `-du ${configuration.site} ` +
        `-tr http://timestamp.digicert.com ` +
        `"${configuration.path}"`,
      {
        stdio: "inherit",
      },
    );
  } else if (process.env.ELECTRON_BUILDER_SIGN_CERT) {
    const certFile = process.env.ELECTRON_BUILDER_SIGN_CERT;
    const certPw = process.env.ELECTRON_BUILDER_SIGN_CERT_PW;
    console.log(`[*] Signing file: ${configuration.path} with ${certFile}`);
    require("child_process").execSync(
      "signtool.exe sign" +
        " /fd SHA256" +
        " /a" +
        ` /f "${certFile}"` +
        ` /p "${process.env.ELECTRON_BUILDER_SIGN_CERT_PW}"` +
        ` "${configuration.path}"`,
      {
        stdio: "inherit",
      },
    );
  }
};
