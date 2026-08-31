/* eslint-disable @typescript-eslint/no-require-imports, no-console */
require("dotenv").config();

const { notarize } = require("@electron/notarize");

exports.default = run;

async function run(context) {
  console.log("## After sign");
  // console.log(context);

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;
  const macBuild = context.electronPlatformName === "darwin";

  if (macBuild) {
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
}
