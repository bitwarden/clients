/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * Fix up the Appx manifest electron-builder generates, before makeappx packs it.
 *
 * Three things need fixing that electron-builder's config can't express. All are the same
 * for every channel, so any channel can register this hook as-is — the only channel
 * specific input is the plugin config file the manifest itself names. scripts/appx-cross-build.ps1
 * runs this on its own manifest too.
 *
 * - `${clsid:<file>}`: the COM class ID of the passkey provider. The manifest can't carry
 *   it literally, because the app reads the class ID at runtime from
 *   resources/windows_plugin_authenticator_config[.beta].json, and a package declaring a
 *   class ID the app never serves hijacks it from the app that does. electron-builder
 *   inlines custom-appx-extensions*.xml verbatim and expands no macros in it, so the
 *   extensions file names its channel's config and the class ID is resolved here.
 * - Registry virtualization: the app's run-time writes to HKCU land in a private hive only the
 *   package can see, so browsers would never find the native messaging hosts the app
 *   registers. The manifest unvirtualizes those keys: only them on Windows 11, and all of
 *   HKCU on Windows 10, which has no finer-grained option. The key list must match
 *   getWindowsNMHS() in src/main/native-messaging.main.ts. Windows ignores both declarations
 *   unless appx.maxVersionTested in the electron-builder config is recent enough, rather than
 *   defaulting to appx.minVersion.
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

const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
const FOUNDATION_NAMESPACE = "http://schemas.microsoft.com/appx/manifest/foundation/windows10";
const NAMESPACES = {
  rescap: "http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities",
  desktop6: "http://schemas.microsoft.com/appx/manifest/desktop/windows10/6",
  virtualization: "http://schemas.microsoft.com/appx/manifest/virtualization/windows10",
};
const NATIVE_MESSAGING_HOST_KEYS = [
  "SOFTWARE\\Mozilla\\NativeMessagingHosts\\com.8bit.bitwarden",
  "SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.8bit.bitwarden",
  "SOFTWARE\\Chromium\\NativeMessagingHosts\\com.8bit.bitwarden",
  "SOFTWARE\\Microsoft\\Edge\\NativeMessagingHosts\\com.8bit.bitwarden",
  "SOFTWARE\\Vivaldi\\NativeMessagingHosts\\com.8bit.bitwarden",
  "SOFTWARE\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\com.8bit.bitwarden",
];

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

function parse(window, manifest, manifestPath) {
  const document = new window.DOMParser().parseFromString(manifest, "application/xml");
  const parseError = document.querySelector("parsererror");
  if (parseError) {
    throw new Error(`${manifestPath} is not well-formed XML: ${parseError.textContent}`);
  }
  return document;
}

function childElement(parent, localName, manifestPath) {
  const element = Array.from(parent.children).find(
    (child) => child.namespaceURI === FOUNDATION_NAMESPACE && child.localName === localName,
  );
  if (!element) {
    throw new Error(`No <${localName}> in ${manifestPath}`);
  }
  return element;
}

function unvirtualizeNativeMessagingHosts(document, manifestPath) {
  const root = document.documentElement;
  const create = (prefix, localName, textContent) => {
    const element = document.createElementNS(NAMESPACES[prefix], `${prefix}:${localName}`);
    if (textContent != null) {
      element.textContent = textContent;
    }
    return element;
  };

  // Older Windows versions skip what they don't support, rather than rejecting the package.
  for (const [prefix, namespace] of Object.entries(NAMESPACES)) {
    root.setAttributeNS(XMLNS_NAMESPACE, `xmlns:${prefix}`, namespace);
  }
  const ignorable = new Set((root.getAttribute("IgnorableNamespaces") ?? "").split(/\s+/));
  Object.keys(NAMESPACES).forEach((prefix) => ignorable.add(prefix));
  ignorable.delete("");
  root.setAttribute("IgnorableNamespaces", Array.from(ignorable).join(" "));

  const properties = childElement(root, "Properties", manifestPath);
  // Windows 10 1903+. Windows 11 ignores it in favor of the excluded keys below.
  properties.appendChild(create("desktop6", "RegistryWriteVirtualization", "disabled"));
  const excludedKeys = create("virtualization", "ExcludedKeys");
  for (const key of NATIVE_MESSAGING_HOST_KEYS) {
    excludedKeys.appendChild(create("virtualization", "ExcludedKey", `HKEY_CURRENT_USER\\${key}`));
  }
  const registryWriteVirtualization = create("virtualization", "RegistryWriteVirtualization");
  registryWriteVirtualization.appendChild(excludedKeys);
  properties.appendChild(registryWriteVirtualization);

  const capability = create("rescap", "Capability");
  capability.setAttribute("Name", "unvirtualizedResources");
  childElement(root, "Capabilities", manifestPath).appendChild(capability);
}

function removeComments(window, document) {
  const walker = document.createTreeWalker(document, window.NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walker.nextNode()) {
    comments.push(walker.currentNode);
  }
  comments.forEach((comment) => comment.remove());
}

exports.default = function (manifestPath) {
  const { window } = new JSDOM();
  const document = parse(
    window,
    resolveClsids(fs.readFileSync(manifestPath, "utf8"), manifestPath),
    manifestPath,
  );
  unvirtualizeNativeMessagingHosts(document, manifestPath);
  removeComments(window, document);
  fs.writeFileSync(
    manifestPath,
    XML_DECLARATION + new window.XMLSerializer().serializeToString(document) + "\n",
  );
  console.log(`[*] Rewrote ${manifestPath} for packing`);
};
