import { Utils } from "../../platform/misc/utils";

import {
  AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION,
  AutotypePairingData,
  AutotypePairingPackagingType,
} from "./autotype-pairing-data";
import { DESKTOP_APP_URI_PREFIX, DesktopAutotypePairingUri } from "./desktop-autotype-pairing-uri";

function createPairingData(name = "Notepad"): AutotypePairingData {
  return {
    metadata: {
      schemaVersion: { ...AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION },
      pairingTimestamp: 1793577600,
    },
    appData: {
      name,
      normalizedPath: "C:\\Windows\\System32\\notepad.exe",
    },
    clientData: {
      packagingType: AutotypePairingPackagingType.WindowsExe,
    },
  };
}

// The pairing URI for `createPairingData()`, encoded independently of `DesktopAutotypePairingUri`
const NOTEPAD_PAIRING_URI =
  "desktopapp://autotype?version=1.0.0&data=eyJtZXRhZGF0YSI6eyJzY2hlbWFWZXJzaW9uIjp7Im1ham9yIjoxLCJtaW5vciI6MCwicGF0Y2giOjB9LCJwYWlyaW5nVGltZXN0YW1wIjoxNzkzNTc3NjAwfSwiYXBwRGF0YSI6eyJuYW1lIjoiTm90ZXBhZCIsIm5vcm1hbGl6ZWRQYXRoIjoiQzpcXFdpbmRvd3NcXFN5c3RlbTMyXFxub3RlcGFkLmV4ZSJ9LCJjbGllbnREYXRhIjp7InBhY2thZ2luZ1R5cGUiOiJ3aW5kb3dzLWV4ZSJ9fQ";

const ENCODED_PAIRING_DATA = Utils.fromUtf8ToUrlB64(JSON.stringify(createPairingData()));

function createUriString(params: Record<string, string>, base = "desktopapp://autotype"): string {
  return `${base}?${new URLSearchParams(params).toString()}`;
}

describe("DESKTOP_APP_URI_PREFIX", () => {
  it("is the desktop app URI scheme", () => {
    expect(DESKTOP_APP_URI_PREFIX).toBe("desktopapp://");
  });
});

describe("DesktopAutotypePairingUri", () => {
  describe("toString", () => {
    it("returns the pairing URI with the data encoded as base64url JSON", () => {
      const pairingUri = new DesktopAutotypePairingUri(
        DesktopAutotypePairingUri.CurrentVersion,
        createPairingData(),
      );

      expect(pairingUri.toString()).toBe(NOTEPAD_PAIRING_URI);
    });

    it("starts with the desktop app URI prefix", () => {
      const pairingUri = new DesktopAutotypePairingUri("1.0.0", createPairingData());

      expect(pairingUri.toString().startsWith(DESKTOP_APP_URI_PREFIX)).toBe(true);
    });

    it.each(["Notepad", "Café 日本語 🚀", "<<???>>", "~~~"])(
      "encodes the data with the unpadded base64url alphabet for the app name '%s'",
      (name) => {
        const pairingUri = new DesktopAutotypePairingUri("1.0.0", createPairingData(name));

        const encodedData = new URL(pairingUri.toString()).searchParams.get("data");

        expect(encodedData).toMatch(/^[A-Za-z0-9_-]+$/);
      },
    );
  });

  describe("fromString", () => {
    it("recreates the pairing URI from a saved pairing URI string", () => {
      const pairingUri = DesktopAutotypePairingUri.fromString(NOTEPAD_PAIRING_URI);

      expect(pairingUri).not.toBeNull();
      expect(pairingUri!.version).toBe("1.0.0");
      expect(pairingUri!.data).toEqual(createPairingData());
    });

    it("does not rely on how the URL engine parses the host and path of the custom scheme", () => {
      // Firefox before 122 parses custom scheme URLs with an empty host and the host in the path
      const hostSpy = jest.spyOn(URL.prototype, "host", "get").mockReturnValue("");
      const hostnameSpy = jest.spyOn(URL.prototype, "hostname", "get").mockReturnValue("");
      const pathnameSpy = jest
        .spyOn(URL.prototype, "pathname", "get")
        .mockReturnValue("//autotype");

      try {
        const pairingUri = DesktopAutotypePairingUri.fromString(NOTEPAD_PAIRING_URI);

        expect(pairingUri?.data).toEqual(createPairingData());
        expect(pairingUri?.toString()).toBe(NOTEPAD_PAIRING_URI);
      } finally {
        hostSpy.mockRestore();
        hostnameSpy.mockRestore();
        pathnameSpy.mockRestore();
      }
    });

    it.each(["Notepad", "Café 日本語 🚀", "<<???>>", "~~~", ""])(
      "round-trips a pairing URI created with the app name '%s'",
      (name) => {
        const pairingUri = new DesktopAutotypePairingUri("1.0.0", createPairingData(name));

        const recreated = DesktopAutotypePairingUri.fromString(pairingUri.toString());

        expect(recreated).toEqual(pairingUri);
        expect(recreated!.toString()).toBe(pairingUri.toString());
      },
    );

    it.each(["1.0.0", "1.2.3", "1.10.20"])("accepts the supported version '%s'", (version) => {
      const uri = createUriString({ version, data: ENCODED_PAIRING_DATA });

      expect(DesktopAutotypePairingUri.fromString(uri)?.version).toBe(version);
    });

    it.each(["2.0.0", "0.1.0", "1.0", "1", "1.0.0-beta", "v1.0.0", "1.0.0.0", ""])(
      "returns null for the unsupported version '%s'",
      (version) => {
        const uri = createUriString({ version, data: ENCODED_PAIRING_DATA });

        expect(DesktopAutotypePairingUri.fromString(uri)).toBeNull();
      },
    );

    it("ignores additional query parameters", () => {
      const uri = createUriString({ version: "1.0.0", data: ENCODED_PAIRING_DATA, extra: "1" });

      expect(DesktopAutotypePairingUri.fromString(uri)?.data).toEqual(createPairingData());
    });

    it.each([
      ["a different scheme", createUriString({ version: "1.0.0" }, "https://autotype")],
      ["a different host", createUriString({ version: "1.0.0" }, "desktopapp://other")],
      ["a path", createUriString({ version: "1.0.0" }, "desktopapp://autotype/path")],
      ["no host", createUriString({ version: "1.0.0" }, "desktopapp:autotype")],
    ])("returns null for a URI with %s", (_, uriWithoutData) => {
      const uri = `${uriWithoutData}&data=${ENCODED_PAIRING_DATA}`;

      expect(DesktopAutotypePairingUri.fromString(uri)).toBeNull();
    });

    it("returns null for a URI with a fragment", () => {
      expect(DesktopAutotypePairingUri.fromString(`${NOTEPAD_PAIRING_URI}#fragment`)).toBeNull();
    });

    it("returns null when the version is missing", () => {
      const uri = createUriString({ data: ENCODED_PAIRING_DATA });

      expect(DesktopAutotypePairingUri.fromString(uri)).toBeNull();
    });

    it("returns null when the data is missing", () => {
      const uri = createUriString({ version: "1.0.0" });

      expect(DesktopAutotypePairingUri.fromString(uri)).toBeNull();
    });

    it.each([
      ["an invalid base64url length", "a"],
      ["characters outside the base64url alphabet", "!!!!"],
      ["empty", ""],
    ])("returns null when the data is %s", (_, data) => {
      const uri = createUriString({ version: "1.0.0", data });

      expect(DesktopAutotypePairingUri.fromString(uri)).toBeNull();
    });

    it("returns null when the data is not JSON", () => {
      const uri = createUriString({ version: "1.0.0", data: Utils.fromUtf8ToUrlB64("not json") });

      expect(DesktopAutotypePairingUri.fromString(uri)).toBeNull();
    });

    it("returns null when the data does not adhere to the schema", () => {
      const data = createPairingData();
      data.metadata.schemaVersion = { ...data.metadata.schemaVersion, minor: -1 };
      const uri = createUriString({
        version: "1.0.0",
        data: Utils.fromUtf8ToUrlB64(JSON.stringify(data)),
      });

      expect(DesktopAutotypePairingUri.fromString(uri)).toBeNull();
    });

    it("returns null when the data is of the unsupported schema version 0.1.0", () => {
      const data = {
        ...createPairingData(),
        metadata: { schemaVersion: { major: 0, minor: 1, patch: 0 }, pairingTimestamp: 1793577600 },
      };
      const uri = createUriString({
        version: "1.0.0",
        data: Utils.fromUtf8ToUrlB64(JSON.stringify(data)),
      });

      expect(DesktopAutotypePairingUri.fromString(uri)).toBeNull();
    });

    it("accepts data of a later 1.x schema version and keeps its unknown properties", () => {
      // Later 1.x versions may add properties and packaging types
      const data = {
        metadata: {
          schemaVersion: { major: 1, minor: 2, patch: 0, extra: "schemaVersion" },
          pairingTimestamp: 1793577600,
          extra: "metadata",
        },
        appData: { name: "Notepad", normalizedPath: "C:\\notepad.exe", extra: "appData" },
        clientData: { packagingType: "macos-dmg", extra: "clientData" },
        extra: "root",
      };
      const uri = createUriString({
        version: "1.0.0",
        data: Utils.fromUtf8ToUrlB64(JSON.stringify(data)),
      });

      const pairingUri = DesktopAutotypePairingUri.fromString(uri);

      expect(pairingUri?.data).toEqual(data);
      expect(pairingUri?.toString()).toBe(uri);
    });

    it.each(["", "   ", "not a uri", DESKTOP_APP_URI_PREFIX, "https://bitwarden.com"])(
      "returns null for the string '%s'",
      (uri) => {
        expect(DesktopAutotypePairingUri.fromString(uri)).toBeNull();
      },
    );
  });
});
