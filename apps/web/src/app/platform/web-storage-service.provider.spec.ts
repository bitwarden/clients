import { mock } from "jest-mock-extended";

import {
  AbstractStorageService,
  ClientLocations,
  ObservableStorageService,
  PossibleLocation,
  StorageLocation,
} from "@bitwarden/storage-core";

import { WebStorageServiceProvider } from "./web-storage-service.provider";

describe("WebStorageServiceProvider", () => {
  const mockDiskStorage = mock<AbstractStorageService & ObservableStorageService>();
  const mockMemoryStorage = mock<AbstractStorageService & ObservableStorageService>();
  const mockDiskLocalStorage = mock<AbstractStorageService & ObservableStorageService>();

  const sut = new WebStorageServiceProvider(
    mockDiskStorage,
    mockMemoryStorage,
    mockDiskLocalStorage,
  );

  describe("get", () => {
    const getTests = [
      {
        input: { default: "disk", overrides: {} },
        expected: "disk",
      },
      {
        input: { default: "memory", overrides: {} },
        expected: "memory",
      },
      {
        input: { default: "disk", overrides: { web: "disk-local" } },
        expected: "disk-local",
      },
      {
        input: { default: "disk", overrides: { web: "memory" } },
        expected: "memory",
      },
      {
        input: { default: "memory", overrides: { web: "disk" } },
        expected: "disk",
      },
    ] satisfies {
      input: { default: StorageLocation; overrides: Partial<ClientLocations> };
      expected: PossibleLocation;
    }[];

    it.each(getTests)("computes properly based on %s", ({ input, expected: expectedLocation }) => {
      const [actualLocation] = sut.get(input.default, input.overrides);
      expect(actualLocation).toStrictEqual(expectedLocation);
    });

    it("throws on unsupported option", () => {
      expect(() => sut.get("blah" as any, {})).toThrow();
    });
  });
});
