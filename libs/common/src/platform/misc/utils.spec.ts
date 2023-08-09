import * as path from "path";

import { Utils } from "./utils";

describe("Utils Service", () => {
  describe("getDomain", () => {
    it("should fail for invalid urls", () => {
      expect(Utils.getDomain(null)).toBeNull();
      expect(Utils.getDomain(undefined)).toBeNull();
      expect(Utils.getDomain(" ")).toBeNull();
      expect(Utils.getDomain('https://bit!:"_&ward.com')).toBeNull();
      expect(Utils.getDomain("bitwarden")).toBeNull();
    });

    it("should fail for data urls", () => {
      expect(Utils.getDomain("data:image/jpeg;base64,AAA")).toBeNull();
    });

    it("should fail for about urls", () => {
      expect(Utils.getDomain("about")).toBeNull();
      expect(Utils.getDomain("about:")).toBeNull();
      expect(Utils.getDomain("about:blank")).toBeNull();
    });

    it("should fail for file url", () => {
      expect(Utils.getDomain("file:///C://somefolder/form.pdf")).toBeNull();
    });

    it("should handle urls without protocol", () => {
      expect(Utils.getDomain("bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getDomain("wrong://bitwarden.com")).toBe("bitwarden.com");
    });

    it("should handle valid urls", () => {
      expect(Utils.getDomain("bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getDomain("http://bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getDomain("https://bitwarden.com")).toBe("bitwarden.com");

      expect(Utils.getDomain("www.bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getDomain("http://www.bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getDomain("https://www.bitwarden.com")).toBe("bitwarden.com");

      expect(Utils.getDomain("vault.bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getDomain("http://vault.bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getDomain("https://vault.bitwarden.com")).toBe("bitwarden.com");

      expect(Utils.getDomain("www.vault.bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getDomain("http://www.vault.bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getDomain("https://www.vault.bitwarden.com")).toBe("bitwarden.com");

      expect(
        Utils.getDomain("user:password@bitwarden.com:8080/password/sites?and&query#hash")
      ).toBe("bitwarden.com");
      expect(
        Utils.getDomain("http://user:password@bitwarden.com:8080/password/sites?and&query#hash")
      ).toBe("bitwarden.com");
      expect(
        Utils.getDomain("https://user:password@bitwarden.com:8080/password/sites?and&query#hash")
      ).toBe("bitwarden.com");

      expect(Utils.getDomain("bitwarden.unknown")).toBe("bitwarden.unknown");
      expect(Utils.getDomain("http://bitwarden.unknown")).toBe("bitwarden.unknown");
      expect(Utils.getDomain("https://bitwarden.unknown")).toBe("bitwarden.unknown");
    });

    it("should handle valid urls with an underscore in subdomain", () => {
      expect(Utils.getDomain("my_vault.bitwarden.com/")).toBe("bitwarden.com");
      expect(Utils.getDomain("http://my_vault.bitwarden.com/")).toBe("bitwarden.com");
      expect(Utils.getDomain("https://my_vault.bitwarden.com/")).toBe("bitwarden.com");
    });

    it("should support urls containing umlauts", () => {
      expect(Utils.getDomain("bütwarden.com")).toBe("bütwarden.com");
      expect(Utils.getDomain("http://bütwarden.com")).toBe("bütwarden.com");
      expect(Utils.getDomain("https://bütwarden.com")).toBe("bütwarden.com");

      expect(Utils.getDomain("subdomain.bütwarden.com")).toBe("bütwarden.com");
      expect(Utils.getDomain("http://subdomain.bütwarden.com")).toBe("bütwarden.com");
      expect(Utils.getDomain("https://subdomain.bütwarden.com")).toBe("bütwarden.com");
    });

    it("should support punycode urls", () => {
      expect(Utils.getDomain("xn--btwarden-65a.com")).toBe("xn--btwarden-65a.com");
      expect(Utils.getDomain("xn--btwarden-65a.com")).toBe("xn--btwarden-65a.com");
      expect(Utils.getDomain("xn--btwarden-65a.com")).toBe("xn--btwarden-65a.com");

      expect(Utils.getDomain("subdomain.xn--btwarden-65a.com")).toBe("xn--btwarden-65a.com");
      expect(Utils.getDomain("http://subdomain.xn--btwarden-65a.com")).toBe("xn--btwarden-65a.com");
      expect(Utils.getDomain("https://subdomain.xn--btwarden-65a.com")).toBe(
        "xn--btwarden-65a.com"
      );
    });

    it("should support localhost", () => {
      expect(Utils.getDomain("localhost")).toBe("localhost");
      expect(Utils.getDomain("http://localhost")).toBe("localhost");
      expect(Utils.getDomain("https://localhost")).toBe("localhost");
    });

    it("should support localhost with subdomain", () => {
      expect(Utils.getDomain("subdomain.localhost")).toBe("localhost");
      expect(Utils.getDomain("http://subdomain.localhost")).toBe("localhost");
      expect(Utils.getDomain("https://subdomain.localhost")).toBe("localhost");
    });

    it("should support IPv4", () => {
      expect(Utils.getDomain("192.168.1.1")).toBe("192.168.1.1");
      expect(Utils.getDomain("http://192.168.1.1")).toBe("192.168.1.1");
      expect(Utils.getDomain("https://192.168.1.1")).toBe("192.168.1.1");
    });

    it("should support IPv6", () => {
      expect(Utils.getDomain("[2620:fe::fe]")).toBe("2620:fe::fe");
      expect(Utils.getDomain("http://[2620:fe::fe]")).toBe("2620:fe::fe");
      expect(Utils.getDomain("https://[2620:fe::fe]")).toBe("2620:fe::fe");
    });

    it("should reject invalid hostnames", () => {
      expect(Utils.getDomain("https://mywebsite.com$.mywebsite.com")).toBeNull();
      expect(Utils.getDomain("https://mywebsite.com!.mywebsite.com")).toBeNull();
    });
  });

  describe("getHostname", () => {
    it("should fail for invalid urls", () => {
      expect(Utils.getHostname(null)).toBeNull();
      expect(Utils.getHostname(undefined)).toBeNull();
      expect(Utils.getHostname(" ")).toBeNull();
      expect(Utils.getHostname('https://bit!:"_&ward.com')).toBeNull();
    });

    it("should fail for data urls", () => {
      expect(Utils.getHostname("data:image/jpeg;base64,AAA")).toBeNull();
    });

    it("should fail for about urls", () => {
      expect(Utils.getHostname("about")).toBe("about");
      expect(Utils.getHostname("about:")).toBeNull();
      expect(Utils.getHostname("about:blank")).toBeNull();
    });

    it("should fail for file url", () => {
      expect(Utils.getHostname("file:///C:/somefolder/form.pdf")).toBeNull();
    });

    it("should handle valid urls", () => {
      expect(Utils.getHostname("bitwarden")).toBe("bitwarden");
      expect(Utils.getHostname("http://bitwarden")).toBe("bitwarden");
      expect(Utils.getHostname("https://bitwarden")).toBe("bitwarden");

      expect(Utils.getHostname("bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getHostname("http://bitwarden.com")).toBe("bitwarden.com");
      expect(Utils.getHostname("https://bitwarden.com")).toBe("bitwarden.com");

      expect(Utils.getHostname("www.bitwarden.com")).toBe("www.bitwarden.com");
      expect(Utils.getHostname("http://www.bitwarden.com")).toBe("www.bitwarden.com");
      expect(Utils.getHostname("https://www.bitwarden.com")).toBe("www.bitwarden.com");

      expect(Utils.getHostname("vault.bitwarden.com")).toBe("vault.bitwarden.com");
      expect(Utils.getHostname("http://vault.bitwarden.com")).toBe("vault.bitwarden.com");
      expect(Utils.getHostname("https://vault.bitwarden.com")).toBe("vault.bitwarden.com");

      expect(Utils.getHostname("www.vault.bitwarden.com")).toBe("www.vault.bitwarden.com");
      expect(Utils.getHostname("http://www.vault.bitwarden.com")).toBe("www.vault.bitwarden.com");
      expect(Utils.getHostname("https://www.vault.bitwarden.com")).toBe("www.vault.bitwarden.com");

      expect(
        Utils.getHostname("user:password@bitwarden.com:8080/password/sites?and&query#hash")
      ).toBe("bitwarden.com");
      expect(
        Utils.getHostname("https://user:password@bitwarden.com:8080/password/sites?and&query#hash")
      ).toBe("bitwarden.com");
      expect(Utils.getHostname("https://bitwarden.unknown")).toBe("bitwarden.unknown");
    });

    it("should handle valid urls with an underscore in subdomain", () => {
      expect(Utils.getHostname("my_vault.bitwarden.com/")).toBe("my_vault.bitwarden.com");
      expect(Utils.getHostname("http://my_vault.bitwarden.com/")).toBe("my_vault.bitwarden.com");
      expect(Utils.getHostname("https://my_vault.bitwarden.com/")).toBe("my_vault.bitwarden.com");
    });

    it("should support urls containing umlauts", () => {
      expect(Utils.getHostname("bütwarden.com")).toBe("bütwarden.com");
      expect(Utils.getHostname("http://bütwarden.com")).toBe("bütwarden.com");
      expect(Utils.getHostname("https://bütwarden.com")).toBe("bütwarden.com");

      expect(Utils.getHostname("subdomain.bütwarden.com")).toBe("subdomain.bütwarden.com");
      expect(Utils.getHostname("http://subdomain.bütwarden.com")).toBe("subdomain.bütwarden.com");
      expect(Utils.getHostname("https://subdomain.bütwarden.com")).toBe("subdomain.bütwarden.com");
    });

    it("should support punycode urls", () => {
      expect(Utils.getHostname("xn--btwarden-65a.com")).toBe("xn--btwarden-65a.com");
      expect(Utils.getHostname("xn--btwarden-65a.com")).toBe("xn--btwarden-65a.com");
      expect(Utils.getHostname("xn--btwarden-65a.com")).toBe("xn--btwarden-65a.com");

      expect(Utils.getHostname("subdomain.xn--btwarden-65a.com")).toBe(
        "subdomain.xn--btwarden-65a.com"
      );
      expect(Utils.getHostname("http://subdomain.xn--btwarden-65a.com")).toBe(
        "subdomain.xn--btwarden-65a.com"
      );
      expect(Utils.getHostname("https://subdomain.xn--btwarden-65a.com")).toBe(
        "subdomain.xn--btwarden-65a.com"
      );
    });

    it("should support localhost", () => {
      expect(Utils.getHostname("localhost")).toBe("localhost");
      expect(Utils.getHostname("http://localhost")).toBe("localhost");
      expect(Utils.getHostname("https://localhost")).toBe("localhost");
    });

    it("should support localhost with subdomain", () => {
      expect(Utils.getHostname("subdomain.localhost")).toBe("subdomain.localhost");
      expect(Utils.getHostname("http://subdomain.localhost")).toBe("subdomain.localhost");
      expect(Utils.getHostname("https://subdomain.localhost")).toBe("subdomain.localhost");
    });

    it("should support IPv4", () => {
      expect(Utils.getHostname("192.168.1.1")).toBe("192.168.1.1");
      expect(Utils.getHostname("http://192.168.1.1")).toBe("192.168.1.1");
      expect(Utils.getHostname("https://192.168.1.1")).toBe("192.168.1.1");
    });

    it("should support IPv6", () => {
      expect(Utils.getHostname("[2620:fe::fe]")).toBe("2620:fe::fe");
      expect(Utils.getHostname("http://[2620:fe::fe]")).toBe("2620:fe::fe");
      expect(Utils.getHostname("https://[2620:fe::fe]")).toBe("2620:fe::fe");
    });
  });

  describe("newGuid", () => {
    it("should create a valid guid", () => {
      const validGuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(Utils.newGuid()).toMatch(validGuid);
    });
  });

  describe("fromByteStringToArray", () => {
    it("should handle null", () => {
      expect(Utils.fromByteStringToArray(null)).toEqual(null);
    });
  });

  describe("mapToRecord", () => {
    it("should handle null", () => {
      expect(Utils.mapToRecord(null)).toEqual(null);
    });

    it("should handle empty map", () => {
      expect(Utils.mapToRecord(new Map())).toEqual({});
    });

    it("should handle convert a Map to a Record", () => {
      const map = new Map([
        ["key1", "value1"],
        ["key2", "value2"],
      ]);
      expect(Utils.mapToRecord(map)).toEqual({ key1: "value1", key2: "value2" });
    });

    it("should handle convert a Map to a Record with non-string keys", () => {
      const map = new Map([
        [1, "value1"],
        [2, "value2"],
      ]);
      const result = Utils.mapToRecord(map);
      expect(result).toEqual({ 1: "value1", 2: "value2" });
      expect(Utils.recordToMap(result)).toEqual(map);
    });

    it("should not convert an object if it's not a map", () => {
      const obj = { key1: "value1", key2: "value2" };
      expect(Utils.mapToRecord(obj as any)).toEqual(obj);
    });
  });

  describe("recordToMap", () => {
    it("should handle null", () => {
      expect(Utils.recordToMap(null)).toEqual(null);
    });

    it("should handle empty record", () => {
      expect(Utils.recordToMap({})).toEqual(new Map());
    });

    it("should handle convert a Record to a Map", () => {
      const record = { key1: "value1", key2: "value2" };
      expect(Utils.recordToMap(record)).toEqual(new Map(Object.entries(record)));
    });

    it("should handle convert a Record to a Map with non-string keys", () => {
      const record = { 1: "value1", 2: "value2" };
      const result = Utils.recordToMap(record);
      expect(result).toEqual(
        new Map([
          [1, "value1"],
          [2, "value2"],
        ])
      );
      expect(Utils.mapToRecord(result)).toEqual(record);
    });

    it("should not convert an object if already a map", () => {
      const map = new Map([
        ["key1", "value1"],
        ["key2", "value2"],
      ]);
      expect(Utils.recordToMap(map as any)).toEqual(map);
    });
  });

  describe("encodeRFC3986URIComponent", () => {
    it("returns input string with expected encoded chars", () => {
      expect(Utils.encodeRFC3986URIComponent("test'user@example.com")).toBe(
        "test%27user%40example.com"
      );
      expect(Utils.encodeRFC3986URIComponent("(test)user@example.com")).toBe(
        "%28test%29user%40example.com"
      );
      expect(Utils.encodeRFC3986URIComponent("testuser!@example.com")).toBe(
        "testuser%21%40example.com"
      );
      expect(Utils.encodeRFC3986URIComponent("Test*User@example.com")).toBe(
        "Test%2AUser%40example.com"
      );
    });
  });

  describe("normalizePath", () => {
    it("removes a single traversal", () => {
      expect(Utils.normalizePath("../test")).toBe("test");
    });

    it("removes deep traversals", () => {
      expect(Utils.normalizePath("../../test")).toBe("test");
    });

    it("removes intermediate traversals", () => {
      expect(Utils.normalizePath("test/../test")).toBe("test");
    });

    it("removes multiple encoded traversals", () => {
      expect(
        Utils.normalizePath("api/sends/access/..%2f..%2f..%2fapi%2fsends%2faccess%2fsendkey")
      ).toBe(path.normalize("api/sends/access/sendkey"));
    });
  });

  describe("getUrl", () => {
    it("assumes a http protocol if no protocol is specified", () => {
      const urlString = "www.exampleapp.com.au:4000";

      const actual = Utils.getUrl(urlString);

      expect(actual.protocol).toBe("http:");
    });
  });

  describe("daysRemaining", () => {
    beforeAll(() => {
      const now = new Date(2023, 9, 2, 10);
      jest.spyOn(Date, "now").mockReturnValue(now.getTime());
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("should return 0 for equal dates", () => {
      expect(Utils.daysRemaining(new Date(2023, 9, 2))).toBe(0);
      expect(Utils.daysRemaining(new Date(2023, 9, 2, 12))).toBe(0);
    });

    it("should return 0 for dates in the past", () => {
      expect(Utils.daysRemaining(new Date(2020, 5, 11))).toBe(0);
      expect(Utils.daysRemaining(new Date(2023, 9, 1))).toBe(0);
    });

    it("should handle future dates", () => {
      expect(Utils.daysRemaining(new Date(2023, 9, 3, 10))).toBe(1);
      expect(Utils.daysRemaining(new Date(2023, 10, 12, 10))).toBe(41);
      // leap year
      expect(Utils.daysRemaining(new Date(2024, 9, 2, 10))).toBe(366);
    });
  });
});
