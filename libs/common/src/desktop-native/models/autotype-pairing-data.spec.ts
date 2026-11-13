import {
  AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION,
  AutotypePairingData,
  AutotypePairingPackagingType,
  isAutotypePairingData,
  isAutotypePairingPackagingType,
} from "./autotype-pairing-data";

function createPairingData(): AutotypePairingData {
  return {
    metadata: {
      schemaVersion: { ...AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION },
      pairingTimestamp: 1793577600,
    },
    appData: {
      name: "Notepad",
      normalizedPath: "C:\\Windows\\System32\\notepad.exe",
    },
    clientData: {
      packagingType: AutotypePairingPackagingType.WindowsExe,
    },
  };
}

// A modification of valid pairing data. The data is loosely typed so the modification can violate
// the schema.
type PairingDataModification = (data: any) => void;

// Returns valid pairing data with the modification applied.
function createModifiedPairingData(modify: PairingDataModification): unknown {
  const data = createPairingData();
  modify(data);
  return data;
}

describe("AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION", () => {
  it("is the schema version new pairing data is written with", () => {
    expect(AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION).toEqual({ major: 1, minor: 0, patch: 0 });
  });
});

describe("isAutotypePairingPackagingType", () => {
  it.each(["windows-msix", "windows-exe"])("returns true for '%s'", (value) => {
    expect(isAutotypePairingPackagingType(value)).toBe(true);
  });

  it.each([["macos-dmg"], ["Windows-Exe"], [""], [null], [undefined], [1]])(
    "returns false for %p",
    (value) => {
      expect(isAutotypePairingPackagingType(value)).toBe(false);
    },
  );
});

describe("isAutotypePairingData", () => {
  it("returns true for data that adheres to the schema", () => {
    expect(isAutotypePairingData(createPairingData())).toBe(true);
  });

  it.each(Object.values(AutotypePairingPackagingType))(
    "returns true for the '%s' packaging type",
    (packagingType) => {
      const data = createModifiedPairingData((d) => (d.clientData.packagingType = packagingType));

      expect(isAutotypePairingData(data)).toBe(true);
    },
  );

  it("returns true for a pairing timestamp of 0", () => {
    const data = createModifiedPairingData((d) => (d.metadata.pairingTimestamp = 0));

    expect(isAutotypePairingData(data)).toBe(true);
  });

  it("returns true for data parsed from JSON", () => {
    const data: unknown = JSON.parse(JSON.stringify(createPairingData()));

    expect(isAutotypePairingData(data)).toBe(true);
  });

  it.each([["a string"], [1], [true], [null], [undefined], [[]]])(
    "returns false for the non-object value %p",
    (value) => {
      expect(isAutotypePairingData(value)).toBe(false);
    },
  );

  it.each<[string, PairingDataModification]>([
    ["metadata", (d) => delete d.metadata],
    ["appData", (d) => delete d.appData],
    ["clientData", (d) => delete d.clientData],
    ["metadata.schemaVersion", (d) => delete d.metadata.schemaVersion],
    ["metadata.pairingTimestamp", (d) => delete d.metadata.pairingTimestamp],
    ["metadata.schemaVersion.major", (d) => delete d.metadata.schemaVersion.major],
    ["metadata.schemaVersion.minor", (d) => delete d.metadata.schemaVersion.minor],
    ["metadata.schemaVersion.patch", (d) => delete d.metadata.schemaVersion.patch],
    ["appData.name", (d) => delete d.appData.name],
    ["appData.normalizedPath", (d) => delete d.appData.normalizedPath],
    ["clientData.packagingType", (d) => delete d.clientData.packagingType],
  ])("returns false when the required property '%s' is missing", (_, modify) => {
    expect(isAutotypePairingData(createModifiedPairingData(modify))).toBe(false);
  });

  it.each<[string, PairingDataModification]>([
    ["the root object", (d) => (d.extra = true)],
    ["metadata", (d) => (d.metadata.extra = true)],
    ["metadata.schemaVersion", (d) => (d.metadata.schemaVersion.extra = true)],
    ["appData", (d) => (d.appData.extra = true)],
    ["clientData", (d) => (d.clientData.extra = true)],
  ])("returns true when %s has an unknown property", (_, modify) => {
    expect(isAutotypePairingData(createModifiedPairingData(modify))).toBe(true);
  });

  it.each([
    [1, 0, 0],
    [1, 2, 3],
    [1, 10, 20],
  ])("returns true for schema version %p.%p.%p", (major, minor, patch) => {
    const data = createModifiedPairingData(
      (d) => (d.metadata.schemaVersion = { major, minor, patch }),
    );

    expect(isAutotypePairingData(data)).toBe(true);
  });

  it.each([
    [0, 1, 0],
    [0, 0, 0],
    [2, 0, 0],
  ])("returns false for the unsupported schema version %p.%p.%p", (major, minor, patch) => {
    const data = createModifiedPairingData(
      (d) => (d.metadata.schemaVersion = { major, minor, patch }),
    );

    expect(isAutotypePairingData(data)).toBe(false);
  });

  it.each([
    ["major", "1"],
    ["major", 1.5],
    ["minor", -1],
    ["minor", 1.5],
    ["minor", "0"],
    ["minor", null],
    ["minor", Number.NaN],
    ["minor", Number.POSITIVE_INFINITY],
    ["patch", -1],
    ["patch", 1.5],
    ["patch", "0"],
    ["patch", null],
    ["patch", Number.NaN],
    ["patch", Number.POSITIVE_INFINITY],
  ])("returns false when schemaVersion.%s is %p", (part, value) => {
    const data = createModifiedPairingData((d) => (d.metadata.schemaVersion[part] = value));

    expect(isAutotypePairingData(data)).toBe(false);
  });

  it.each([[-1], [1.5], ["1793577600"], [null], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "returns false when the pairing timestamp is %p",
    (pairingTimestamp) => {
      const data = createModifiedPairingData(
        (d) => (d.metadata.pairingTimestamp = pairingTimestamp),
      );

      expect(isAutotypePairingData(data)).toBe(false);
    },
  );

  it.each<[string, PairingDataModification]>([
    ["appData.name", (d) => (d.appData.name = 1)],
    ["appData.name", (d) => (d.appData.name = null)],
    ["appData.normalizedPath", (d) => (d.appData.normalizedPath = 1)],
    ["appData.normalizedPath", (d) => (d.appData.normalizedPath = null)],
  ])("returns false when %s is not a string", (_, modify) => {
    expect(isAutotypePairingData(createModifiedPairingData(modify))).toBe(false);
  });

  it.each(["macos-dmg", "linux-flatpak"])(
    "returns true for the unknown packaging type '%s'",
    (packagingType) => {
      const data = createModifiedPairingData((d) => (d.clientData.packagingType = packagingType));

      expect(isAutotypePairingData(data)).toBe(true);
    },
  );

  it.each([[1], [null], [["windows-exe"]]])(
    "returns false when the packaging type is the non-string value %p",
    (packagingType) => {
      const data = createModifiedPairingData((d) => (d.clientData.packagingType = packagingType));

      expect(isAutotypePairingData(data)).toBe(false);
    },
  );

  it.each<[string, PairingDataModification]>([
    ["appData.name", (d) => (d.appData.name = "")],
    ["appData.normalizedPath", (d) => (d.appData.normalizedPath = "")],
    ["clientData.packagingType", (d) => (d.clientData.packagingType = "")],
  ])("returns false when %s is an empty string", (_, modify) => {
    expect(isAutotypePairingData(createModifiedPairingData(modify))).toBe(false);
  });

  it.each<[string, PairingDataModification]>([
    ["metadata", (d) => (d.metadata = [])],
    ["metadata.schemaVersion", (d) => (d.metadata.schemaVersion = null)],
    ["appData", (d) => (d.appData = "Notepad")],
    ["clientData", (d) => (d.clientData = "windows-exe")],
  ])("returns false when %s is not an object", (_, modify) => {
    expect(isAutotypePairingData(createModifiedPairingData(modify))).toBe(false);
  });
});
