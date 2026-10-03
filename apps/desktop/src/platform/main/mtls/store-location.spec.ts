import { promises as fs } from "node:fs";
import * as path from "node:path";

import { resolveMtlsStoreLocation } from "./store-location";

describe("mTLS NSS store location", () => {
  const appId = "com.bitwarden.desktop";
  const testRoot = path.resolve(process.cwd(), "../../.flatpak/mtls-store-tests");
  let home: string;
  let dataHome: string;

  beforeEach(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    home = await fs.mkdtemp(path.join(testRoot, "home-"));
    dataHome = path.join(home, ".var", "app", appId, "data");
    await fs.mkdir(path.join(dataHome, "pki", "nssdb"), { recursive: true, mode: 0o700 });
    await fs.chmod(path.join(dataHome, "pki"), 0o700);
    await fs.chmod(path.join(dataHome, "pki", "nssdb"), 0o700);
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  const environment = () => ({ HOME: home, XDG_DATA_HOME: dataHome, FLATPAK_ID: appId });

  it("accepts the app-private store with restrictive NSS permissions", async () => {
    await fs.writeFile(path.join(dataHome, "pki", "nssdb", "key4.db"), "", { mode: 0o600 });
    await expect(resolveMtlsStoreLocation(environment())).resolves.toBe(
      path.join(dataHome, "pki", "nssdb"),
    );
  });

  it("rejects a visible legacy store instead of guessing Chromium's choice", async () => {
    await fs.mkdir(path.join(home, ".pki", "nssdb"), { recursive: true });
    await expect(resolveMtlsStoreLocation(environment())).rejects.toThrow(
      "store-location-unsupported",
    );
  });

  it("rejects a symlink or broadly readable NSS file", async () => {
    const database = path.join(dataHome, "pki", "nssdb");
    await fs.writeFile(path.join(database, "key4.db"), "", { mode: 0o644 });
    await expect(resolveMtlsStoreLocation(environment())).rejects.toThrow(
      "store-location-unsupported",
    );
    await fs.rm(path.join(database, "key4.db"));
    await fs.symlink(path.join(home, "elsewhere"), path.join(database, "key4.db"));
    await expect(resolveMtlsStoreLocation(environment())).rejects.toThrow(
      "store-location-unsupported",
    );
  });

  it("rejects hard-linked database files", async () => {
    const outside = path.join(home, "outside.db");
    await fs.writeFile(outside, "", { mode: 0o600 });
    await fs.link(outside, path.join(dataHome, "pki", "nssdb", "key4.db"));
    await expect(resolveMtlsStoreLocation(environment())).rejects.toThrow(
      "store-location-unsupported",
    );
  });

  it("does not enable the backend outside a known Flatpak ID", async () => {
    await expect(
      resolveMtlsStoreLocation({ ...environment(), FLATPAK_ID: "other.app" }),
    ).rejects.toThrow("unsupported");
  });
});
