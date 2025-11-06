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
        const manifestContent = require("child_process").execSync(
          `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
            `$zip = [System.IO.Compression.ZipFile]::OpenRead('${configuration.path}'); ` +
            `$entry = $zip.Entries | Where-Object { $_.FullName -eq 'AppxManifest.xml' }; ` +
            `$stream = $entry.Open(); ` +
            `$reader = New-Object System.IO.StreamReader($stream); ` +
            `$content = $reader.ReadToEnd(); ` +
            `$reader.Close(); $stream.Close(); $zip.Dispose(); ` +
            `Write-Output $content"`,
          { encoding: "utf8" },
        );

        // Extract and display the Publisher line
        const publisherMatch = manifestContent.match(/Publisher='([^']+)'/);
        if (publisherMatch) {
          console.log(`[*] APPX Manifest Publisher: ${publisherMatch[1]}`);
        } else {
          console.log(`[*] Could not find Publisher in manifest`);
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
