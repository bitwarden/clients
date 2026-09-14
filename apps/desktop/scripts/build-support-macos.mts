#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import crypto from "node:crypto";
import { glob } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "path";

import { CLIENTS_PROJECT_DIR, DESKTOP_PROJECT_DIR, Logger, runCommand } from "./build-support.mts";
import { BuildError, type Architecture } from "./build-config.mts";

import { DOMParser } from "@xmldom/xmldom";

export const BITWARDEN_APPLE_TEAM_ID = "LTZ2PFU5D6";

type ARCHS = "arm64" | "x86_64" | "arm64 x86_64";
export function getARCHSForArchitecture(architecture: Architecture): ARCHS {
  if (architecture == "ia32") {
    throw new BuildError("ia32 not supported for macOS");
  }
  const map: Record<string, ARCHS> = {
    arm64: "arm64",
    x64: "x86_64",
    universal: "arm64 x86_64",
  };
  return map[architecture];
}
export function getXcodeLibraryIdentifierForArchitecture(
  architecture: Architecture,
): "macos-arm64" | "macos-x86_64" | "macos-arm64_x86_64" {
  const architectures: Architecture[] =
    architecture == "universal" ? ["arm64", "x64"] : [architecture];
  const xcodeArchitectureMap = {
    ia32: undefined,
    arm64: "arm64",
    x64: "x86_64",
    universal: "arm64_x86_64",
  };
  const xcframeworkArchitectures = architectures
    .map((a) => xcodeArchitectureMap[a] as string)
    .sort()
    .join("_");
  return `macos-${xcframeworkArchitectures}` as any;
}

/**
 *
 * @param provisioningProfilePath Absolute path to the provisioning profile to search.
 * @param certificateSha1Hash SHA-1 hash of the certificate to look for.
 */
export async function checkCertificateInProvisioningProfile(
  provisioningProfilePath: string,
  certificateSha1Hash: string,
): Promise<boolean> {
  const tempDir = mkdtempSync("build-support-macos");
  const tempFilePath = path.join(tempDir, path.basename(provisioningProfilePath) + ".decoded");
  const decodedProvisioningProfile = await decodeProvisioningProfile(provisioningProfilePath);
  writeFileSync(tempFilePath, decodedProvisioningProfile, { encoding: "utf-8" });
  const certHashes = await getDeveloperCertificatesFromDecodedProvisioningProfile(tempFilePath);
  rmSync(tempFilePath);
  return certHashes.includes(certificateSha1Hash);
}

async function getDeveloperCertificatesFromDecodedProvisioningProfile(
  decodedProfilePath: string,
): Promise<string[]> {
  const provisioningProfileXml = await runCommand(
    "/usr/libexec/PlistBuddy",
    ["-x", "-c", "Print: :DeveloperCertificates:", decodedProfilePath],
    { logLevel: "debug" },
  );
  const doc = new DOMParser().parseFromString(provisioningProfileXml, "text/xml");
  const elements = doc.getElementsByTagName("data");
  const hashes = [];
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const certB64 = element.textContent.trim();
    const certDer = Buffer.from(certB64, "base64");
    const certHash = crypto.createHash("sha1").update(certDer).digest("hex").toUpperCase();
    hashes.push(certHash);
  }
  return hashes;
}

/** Provisioning profile directory for Xcode 16+ */
export const XCODE_PROVISIONING_PROFILES = path.join(
  process.env.HOME!,
  "Library/Developer/Xcode/UserData/Provisioning Profiles",
);

/**
 * Discover provisioning profiles for bundle ID based on installed certificates
 * @param bundleId Bundle ID to search for.
 * @param searchPaths Directories to search for provisioning profiles.
 */
async function discoverProvisioningProfiles(
  bundleId: string,
  searchPaths: string[],
): Promise<ProvisioningProfile[]> {
  const matchingProfiles = [];
  for (const searchPath of searchPaths) {
    const profilePaths = glob(path.join(searchPath, "*.provisionprofile"));
    for await (const profilePath of profilePaths) {
      const profile = await parseProvisioningProfile(profilePath);

      if (profile.appId != bundleId) {
        Logger.debug(`Provisioning profile does not match expected bundle ID ${bundleId}`, profile);
        continue;
      }
      matchingProfiles.push(profile);
    }
  }
  return matchingProfiles;
}

/**
 * Discover provisioning profiles for bundle ID based on installed certificates
 * @param bundleId Bundle ID to search for.
 * @param searchPaths Directories to search for provisioning profiles.
 */
export async function discoverProvisioningProfilesByName(
  name: string,
  searchPaths: string[],
): Promise<ProvisioningProfile[]> {
  const matchingProfiles = [];
  for (const searchPath of searchPaths) {
    const profilePaths = glob(path.join(searchPath, "*.provisionprofile"));
    for await (const profilePath of profilePaths) {
      const profile = await parseProvisioningProfile(profilePath);

      if (profile.name !== name) {
        continue;
      }
      matchingProfiles.push(profile);
    }
  }
  return matchingProfiles;
}

export async function discoverDeveloperCodeSigningCertificates(): Promise<string[]> {
  const output = await runCommand("security", ["find-identity", "-v", "-p", "codesigning"], {
    logLevel: "debug",
  });
  const lines = output.split("\n");
  const pattern = /^\s+\d+\) (\w{40}) "Apple Development:.*"/;
  const certHashes = [];
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) {
      certHashes.push(match[1]);
    }
  }
  return certHashes;
}

interface ProvisioningProfile {
  appId: string;
  path: string;
  name: string;
  expirationDate: Date;
  developerCertificates: string[];
}

async function parseProvisioningProfile(profilePath: string): Promise<ProvisioningProfile> {
  const decoded = await runCommand("security", ["cms", "-D", "-i", profilePath], {
    logLevel: "debug",
  });
  const tempDir = mkdtempSync(path.join(tmpdir(), "build-support-macos."));
  const tempFilePath = path.join(tempDir, path.basename(profilePath) + ".decoded");
  writeFileSync(tempFilePath, decoded, { encoding: "utf-8" });

  try {
    const appId = (
      await runCommand(
        "plutil",
        ["-extract", "Entitlements.com\\.apple\\.application-identifier", "raw", tempFilePath],
        { logLevel: "debug" },
      )
    ).trim();
    const expirationDate = (
      await runCommand("plutil", ["-extract", "ExpirationDate", "raw", tempFilePath], {
        logLevel: "debug",
      })
    ).trim();
    const name = (
      await runCommand("plutil", ["-extract", "Name", "raw", tempFilePath], {
        logLevel: "debug",
      })
    ).trim();
    const developerCertificates =
      await getDeveloperCertificatesFromDecodedProvisioningProfile(tempFilePath);
    return {
      path: profilePath,
      appId,
      name,
      expirationDate: new Date(expirationDate),
      developerCertificates,
    };
  } finally {
    rmSync(tempDir, { recursive: true });
  }
}
async function decodeProvisioningProfile(profilePath: string): Promise<string> {
  return await runCommand("security", ["cms", "-D", "-i", profilePath], { logLevel: "debug" });
}
// Check if the current file path matches the entry point path
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const myHash = "26762803DFE24AD8F34DEF2832FE3071AC4CAC6E";
  const betaAutofillProfilePath =
    "/Users/iinuwa/Development/bitwarden/clients/apps/desktop/Beta_Bitwarden_Desktop_Autofill_Development.provisionprofile";

  const appId = "LTZ2PFU5D6.com.bitwarden.desktop.autofill-extension";
  /*
  const profiles = await discoverProvisioningProfiles(appId, [
    // DESKTOP_PROJECT_DIR,
    // CLIENTS_PROJECT_DIR,
    XCODE_PROVISIONING_PROFILES,
  ]);
  */
  const profiles = await discoverProvisioningProfilesByName(
    "Bitwarden Desktop Autofill Development 2024",
    [
      // DESKTOP_PROJECT_DIR,
      // CLIENTS_PROJECT_DIR,
      XCODE_PROVISIONING_PROFILES,
    ],
  );
  const profile = profiles
    // find the latest expiration date
    .sort((a, b) => b.expirationDate.valueOf() - a.expirationDate.valueOf())
    .find((p) => p.developerCertificates.includes(myHash));
  if (profile) {
    console.log(`found matching profile: ${profile.path}`, profile);
  } else {
    console.log("no matching profile");
    console.log(profiles);
  }
}
