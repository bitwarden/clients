/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * Fix up the Appx manifest electron-builder generates, before makeappx packs it.
 *
 * Two things need fixing that electron-builder's config can't express. Both are the same
 * for every channel, so any channel can register this hook as-is — the only channel
 * specific input is the plugin config file the manifest itself names.
 *
 * - `${clsid:<file>}`: the COM class ID of the passkey provider. The manifest can't carry
 *   it literally, because the app reads the class ID at runtime from
 *   resources/windows_plugin_authenticator_config[.beta].json, and a package declaring a
 *   class ID the app never serves hijacks it from the app that does. electron-builder
 *   inlines custom-appx-extensions*.xml verbatim and expands no macros in it, so the
 *   extensions file names its channel's config and the class ID is resolved here.
 * - Comments: the template and the extensions file both document themselves, and none of
 *   that belongs in a shipped package. Removing them reserializes the document, so the
 *   packed manifest is normalized rather than formatted the way the sources are.
 *
 * The first fails the build when there is nothing to fix, so a manifest that quietly
 * stops needing it gets noticed rather than shipped.
 */
const fs = require("fs");
const path = require("path");

const { JSDOM } = require("jsdom");

const CLSID_MACRO = /\$\{clsid:([\w.-]+)\}/g;
// XMLSerializer emits no declaration, and Appx manifests are always UTF-8.
const XML_DECLARATION = '<?xml version="1.0" encoding="utf-8"?>\n';

const configDir = path.resolve(__dirname, "../resources");

function readClsid(configFile) {
  const configPath = path.join(configDir, configFile);
  const { clsid } = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!clsid) {
    throw new Error(`No plugin authenticator clsid found in ${configPath}`);
  }
  return clsid;
}

function resolveClsids(manifest, manifestPath) {
  if (!CLSID_MACRO.test(manifest)) {
    throw new Error(
      `No \${clsid:<file>} macro to resolve in ${manifestPath}. Check that appx.customExtensionsPath ` +
        `points at an extensions file declaring the COM server.`,
    );
  }
  CLSID_MACRO.lastIndex = 0;

  return manifest.replace(CLSID_MACRO, (_, configFile) => readClsid(configFile));
}

function removeComments(manifest, manifestPath) {
  const { window } = new JSDOM();
  const document = new window.DOMParser().parseFromString(manifest, "application/xml");
  const parseError = document.querySelector("parsererror");
  if (parseError) {
    throw new Error(`${manifestPath} is not well-formed XML: ${parseError.textContent}`);
  }

  const walker = document.createTreeWalker(document, window.NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) {
    comments.push(walker.currentNode);
  }
  comments.forEach((comment) => comment.remove());

  return XML_DECLARATION + new window.XMLSerializer().serializeToString(document) + "\n";
}

exports.default = function (manifestPath) {
  let manifest = fs.readFileSync(manifestPath, "utf8");
  manifest = resolveClsids(manifest, manifestPath);
  manifest = removeComments(manifest, manifestPath);
  fs.writeFileSync(manifestPath, manifest);
  console.log(`[*] Rewrote ${manifestPath} for packing`);
};
