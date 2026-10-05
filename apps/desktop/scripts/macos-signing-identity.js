/* eslint-disable @typescript-eslint/no-require-imports */
const child_process = require("child_process");

exports.macOsSigningIdentity = macOsSigningIdentity;

/**
 * The code signing identity that the parts of the app signed outside electron-builder are signed with.
 *
 * @param {boolean} isMas Whether this is a Mac App Store build.
 * @returns {string} The identity's name or SHA-1 hash, either of which `codesign -s` accepts.
 */
function macOsSigningIdentity(isMas) {
  // Only use the Bitwarden Identities on CI
  if (process.env.GITHUB_ACTIONS === "true") {
    if (isMas) {
      return "3rd Party Mac Developer Application: Bitwarden Inc";
    } else {
      return "Developer ID Application: Bitwarden Inc";
    }
    // Locally, use the first valid code signing identity, unless CSC_NAME is set
  } else if (process.env.CSC_NAME) {
    return process.env.CSC_NAME;
  } else {
    const identities = getIdentities();
    if (identities.length === 0) {
      throw new Error("No valid identities found");
    }
    return identities[0].id;
  }
}

// Partially based on electron-builder code:
// https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/macPackager.ts
// https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/codeSign/macCodeSign.ts

const appleCertificatePrefixes = [
  "Developer ID Application:",
  // "Developer ID Installer:",
  // "3rd Party Mac Developer Application:",
  // "3rd Party Mac Developer Installer:",
  "Apple Development:",
];

function getIdentities() {
  const ids = child_process
    .execSync("/usr/bin/security find-identity -v -p codesigning")
    .toString();

  return ids
    .split("\n")
    .filter((line) => {
      for (const prefix of appleCertificatePrefixes) {
        if (line.includes(prefix)) {
          return true;
        }
      }
      return false;
    })
    .map((line) => {
      const split = line.trim().split(" ");
      const id = split[1];
      const name = split.slice(2).join(" ").replace(/"/g, "");
      return { id, name };
    });
}
