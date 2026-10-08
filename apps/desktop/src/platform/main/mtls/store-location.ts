import { promises as fs } from "node:fs";
import * as path from "node:path";

const SUPPORTED_FLATPAK_IDS = new Set(["com.bitwarden.desktop", "com.bitwarden.desktop.beta"]);

/** Resolve only Chromium's app-private XDG NSS location; never change an existing store. */
export async function resolveMtlsStoreLocation(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const { FLATPAK_ID: appId, HOME: home, XDG_DATA_HOME: dataHome } = environment;
  if (!appId || !SUPPORTED_FLATPAK_IDS.has(appId) || !home || !dataHome) {
    throw new Error("unsupported");
  }

  const expectedDataHome = path.join(home, ".var", "app", appId, "data");
  if (
    !path.isAbsolute(home) ||
    !path.isAbsolute(dataHome) ||
    path.normalize(dataHome) !== expectedDataHome
  ) {
    throw new Error("store-location-unsupported");
  }

  // An existing legacy NSS store takes precedence in Chromium. It must not become ours.
  if (await exists(path.join(home, ".pki", "nssdb"))) {
    throw new Error("store-location-unsupported");
  }

  const database = path.join(dataHome, "pki", "nssdb");
  for (const directory of [
    home,
    path.join(home, ".var"),
    path.join(home, ".var", "app"),
    path.join(home, ".var", "app", appId),
    dataHome,
    path.join(dataHome, "pki"),
    database,
  ]) {
    await checkPath(directory, true, directory.endsWith("/pki") || directory.endsWith("/nssdb"));
  }
  try {
    for (const filename of await fs.readdir(database)) {
      await checkPath(path.join(database, filename), false, true);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error("store-location-unsupported");
    }
  }
  return database;
}

async function exists(filename: string): Promise<boolean> {
  try {
    await fs.lstat(filename);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw new Error("store-location-unsupported");
  }
}

async function checkPath(
  filename: string,
  directory: boolean,
  privateMode: boolean,
): Promise<void> {
  try {
    const stat = await fs.lstat(filename);
    if (
      (directory ? !stat.isDirectory() : !stat.isFile()) ||
      stat.isSymbolicLink() ||
      (!directory && stat.nlink !== 1) ||
      (process.getuid && stat.uid !== process.getuid()) ||
      (privateMode && (stat.mode & 0o077) !== 0)
    ) {
      throw new Error("store-location-unsupported");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error("store-location-unsupported");
    }
  }
}
