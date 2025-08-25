import { ClientType } from "@bitwarden/client-type";

import { Loader } from "./metadata";
import { availableLoaders } from "./util";

describe("availableLoaders", () => {
  describe("given valid import types", () => {
    it("returns available loaders when client supports all loaders", () => {
      const result = availableLoaders("operacsv", ClientType.Desktop);

      expect(result).toEqual([Loader.file, Loader.chromium]);
    });

    it("returns filtered loaders when client supports some loaders", () => {
      const result = availableLoaders("operacsv", ClientType.Browser);

      expect(result).toEqual([Loader.file]);
    });

    it("returns single loader for import types with one loader", () => {
      const result = availableLoaders("chromecsv", ClientType.Desktop);

      expect(result).toEqual([Loader.file]);
    });

    it("returns all supported loaders for multi-loader import types", () => {
      const result = availableLoaders("bravecsv", ClientType.Desktop);

      expect(result).toEqual([Loader.file, Loader.chromium]);
    });
  });

  describe("given unknown import types", () => {
    it("returns undefined when import type is not found in metadata", () => {
      const result = availableLoaders("nonexistent" as any, ClientType.Desktop);

      expect(result).toBeUndefined();
    });
  });

  describe("given different client types", () => {
    it("returns appropriate loaders for Browser client", () => {
      const result = availableLoaders("operacsv", ClientType.Browser);

      expect(result).toEqual([Loader.file]);
    });

    it("returns appropriate loaders for Web client", () => {
      const result = availableLoaders("chromecsv", ClientType.Web);

      expect(result).toEqual([Loader.file]);
    });

    it("returns appropriate loaders for CLI client", () => {
      const result = availableLoaders("vivaldicsv", ClientType.Cli);

      expect(result).toEqual([Loader.file]);
    });
  });
});
