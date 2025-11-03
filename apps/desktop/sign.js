/* eslint-disable @typescript-eslint/no-require-imports, no-console */

exports.default = async function (configuration) {
  if (parseInt(process.env.ELECTRON_BUILDER_SIGN) === 1 && configuration.path.slice(-4) == ".exe") {
    console.log(`[*] Signing file: ${configuration.path}`);
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
    const certFile = process.env.ELECTRON_BUILDER_SIGN_CERT
    const certPw = process.env.ELECTRON_BUILDER_SIGN_CERT_PW
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

