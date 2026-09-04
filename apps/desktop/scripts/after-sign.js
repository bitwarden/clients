/* eslint-disable @typescript-eslint/no-require-imports, no-console */
require("dotenv").config();

const { notarize } = require("@electron/notarize");
const builder = require("electron-builder");

exports.default = run;

const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS == "true";

async function run(context) {
  if (IS_GITHUB_ACTIONS) {
    console.log(`::group::After sign (${builder.Arch[context.arch]})`);
  }
  console.log("## After sign");
  // console.log(context);

  const macBuild = context.electronPlatformName === "darwin";
  if (macBuild) {
    await notarizeBuild(context);
  }

  if (IS_GITHUB_ACTIONS) {
    console.log("::endgroup::");
  }
}

async function notarizeBuild(context) {
  if (["no", "off", "0", "disable", "false"].includes(process.env.APPLE_NOTARIZE?.toLowerCase())) {
    console.log(
      "### Notarizing: notarization disabled by APPLE_NOTARIZE environment variable. Skipping.",
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;

  console.log("### Notarizing " + appPath);
  if (process.env.APP_STORE_CONNECT_TEAM_ISSUER) {
    const appleApiIssuer = process.env.APP_STORE_CONNECT_TEAM_ISSUER;
    const appleApiKey = process.env.APP_STORE_CONNECT_AUTH_KEY_PATH;
    const appleApiKeyId = process.env.APP_STORE_CONNECT_AUTH_KEY_ID;
    return await notarize({
      tool: "notarytool",
      appPath: appPath,
      appleApiIssuer: appleApiIssuer,
      appleApiKey: appleApiKey,
      appleApiKeyId: appleApiKeyId,
    });
  } else {
    const appleId = process.env.APPLE_ID_USERNAME || process.env.APPLEID;
    const appleIdPassword = process.env.APPLE_ID_PASSWORD || `@keychain:AC_PASSWORD`;
    return await notarize({
      tool: "notarytool",
      appPath: appPath,
      teamId: "LTZ2PFU5D6",
      appleId: appleId,
      appleIdPassword: appleIdPassword,
    });
  }
}
