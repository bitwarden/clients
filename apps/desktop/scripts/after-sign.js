/* eslint-disable @typescript-eslint/no-require-imports, no-console */
require("dotenv").config();
const path = require("path");

const { notarize } = require("@electron/notarize");
const { deepAssign } = require("builder-util");
const fse = require("fs-extra");

exports.default = run;

async function run(context) {
  console.log("## After sign");
  // console.log(context);

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;
  const macBuild = context.electronPlatformName === "darwin";
  const copySafariExtension = ["darwin", "mas"].includes(context.electronPlatformName);
  const isMasDevBuild =
    context.electronPlatformName === "mas" && context.targets.at(0)?.name === "mas-dev";
  // Only the beta channel ships the autofill extension. Bundling it into a build whose
  // app cannot serve it registers a credential provider that fails at runtime, so the
  // channel is checked here rather than relying on whether the .appex happens to be built.
  const isBetaBuild = context.packager.appInfo.id.endsWith(".beta");
  const copyAutofillExtension = (macBuild && isBetaBuild) || isMasDevBuild;

  let shouldResign = false;

  // cannot use extraFiles because it modifies the extensions .plist and makes it invalid
  if (copyAutofillExtension) {
    console.log("### Copying autofill extension");
    const extensionPath = path.join(__dirname, "../macos/dist/autofill-extension.appex");
    if (!fse.existsSync(extensionPath)) {
      if (isBetaBuild) {
        throw new Error(
          `Autofill extension not found at ${extensionPath}. Beta builds must ship it — ` +
            `run build:macos-extension:mac before packing.`,
        );
      }
      console.log("### Autofill extension not found - skipping");
    } else {
      if (!fse.existsSync(path.join(appPath, "Contents/PlugIns"))) {
        fse.mkdirSync(path.join(appPath, "Contents/PlugIns"));
      }
      fse.copySync(extensionPath, path.join(appPath, "Contents/PlugIns/autofill-extension.appex"));
      // The outer bundle's seal records nested code by cdhash, so an .appex copied in
      // after signing leaves it invalid ("a sealed resource is missing or invalid") and
      // notarization below rejects it. electron-builder signs mas targets again after
      // this hook returns, so only darwin builds have to re-seal here — re-signing a
      // mas build would be the redundant work removed in #18334.
      shouldResign = macBuild;
    }
  }

  if (copySafariExtension) {
    console.log("### Copying safari extension");
    // Copy Safari plugin to work-around https://github.com/electron-userland/electron-builder/issues/5552
    const plugIn = path.join(__dirname, "../PlugIns");
    if (!fse.existsSync(plugIn)) {
      console.log("### Safari extension not found - skipping");
    } else {
      if (!fse.existsSync(path.join(appPath, "Contents/PlugIns"))) {
        fse.mkdirSync(path.join(appPath, "Contents/PlugIns"));
      }
      fse.copySync(
        path.join(plugIn, "safari.appex"),
        path.join(appPath, "Contents/PlugIns/safari.appex"),
      );
      shouldResign = true;
    }
  }

  if (shouldResign) {
    // Resign to sign safari extension
    if (context.electronPlatformName === "mas") {
      const masBuildOptions = deepAssign(
        {},
        context.packager.platformSpecificBuildOptions,
        context.packager.config.mas,
      );
      if (context.targets.some((e) => e.name === "mas-dev")) {
        deepAssign(masBuildOptions, {
          type: "development",
        });
      }
      if (context.packager.packagerOptions.prepackaged == null) {
        await context.packager.sign(appPath, context.appOutDir, masBuildOptions, context.arch);
      }
    } else {
      await context.packager.signApp(context, true);
    }
  }

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
