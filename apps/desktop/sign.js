/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const child_process = require("child_process");

exports.default = async function (configuration) {
  const ext = configuration.path.split(".").at(-1);
  if (parseInt(process.env.ELECTRON_BUILDER_SIGN) === 1 && ["exe", "dll", "node"].includes(ext)) {
    console.log(`[*] Signing file: ${configuration.path}`);
    child_process.execFileSync(
      "azuresigntool",
      // prettier-ignore
      [
        "sign",
        "-v",
        "-kvu", process.env.SIGNING_VAULT_URL,
        "-kvi", process.env.SIGNING_CLIENT_ID,
        "-kvt", process.env.SIGNING_TENANT_ID,
        "-kvs", process.env.SIGNING_CLIENT_SECRET,
        "-kvc", process.env.SIGNING_CERT_NAME,
        "-fd", configuration.hash,
        "-du", configuration.site,
        "-tr", "http://timestamp.digicert.com",
        configuration.path,
      ],
      {
        stdio: "inherit",
      },
    );
  } else if (
    process.env.ELECTRON_BUILDER_SIGN_CERT &&
    ["exe", "dll", "node", "appx"].includes(ext)
  ) {
    console.log(`[*] Signing file: ${configuration.path}`);
    if (process.platform !== "win32") {
      console.warn(
        "Signing Windows executables on non-Windows platforms is not supported. Not signing.",
      );
      return;
    }
    const certFile = process.env.ELECTRON_BUILDER_SIGN_CERT;
    const certPw = process.env.ELECTRON_BUILDER_SIGN_CERT_PW;
    if (!certPw) {
      throw new Error(
        "The certificate file password must be set in ELECTRON_BUILDER_SIGN_CERT_PW in order to sign files.",
      );
    }
    try {
      child_process.execFileSync(
        "signtool.exe",
        ["sign", "/fd", "SHA256", "/a", "/f", certFile, "/p", certPw, configuration.path],
        {
          stdio: "inherit",
        },
      );
      console.info(`Signed ${configuration.path} successfully.`);
    } catch (error) {
      throw new Error(
        `Failed to sign ${configuration.path}: ${error.message}\n` +
          `Check that ELECTRON_BUILDER_SIGN_CERT points to a valid PKCS12 file ` +
          `and ELECTRON_BUILDER_SIGN_CERT_PW is correct.`,
      );
    }
  }
};
