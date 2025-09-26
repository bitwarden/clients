import * as path from "path";

import { Utils } from "./utils";

describe("Utils Service", () => {
  describe("isGuid", () => {
    it("is false when null", () => {
      expect(Utils.isGuid(null)).toBe(false);
    });

    it("is false when undefined", () => {
      expect(Utils.isGuid(undefined)).toBe(false);
    });

    it("is false when empty", () => {
      expect(Utils.isGuid("")).toBe(false);
    });

    it("is false when not a string", () => {
      expect(Utils.isGuid(123 as any)).toBe(false);
    });

    it("is false when not a guid", () => {
      expect(Utils.isGuid("not a guid")).toBe(false);
    });

    it("is true when a guid", () => {
      // we use a limited guid scope in which all zeroes is invalid
      expect(Utils.isGuid("00000000-0000-1000-8000-000000000000")).toBe(true);
    });
  });

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
        Utils.getDomain("user:password@bitwarden.com:8080/password/sites?and&query#hash"),
      ).toBe("bitwarden.com");
      expect(
        Utils.getDomain("http://user:password@bitwarden.com:8080/password/sites?and&query#hash"),
      ).toBe("bitwarden.com");
      expect(
        Utils.getDomain("https://user:password@bitwarden.com:8080/password/sites?and&query#hash"),
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
        "xn--btwarden-65a.com",
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
        Utils.getHostname("user:password@bitwarden.com:8080/password/sites?and&query#hash"),
      ).toBe("bitwarden.com");
      expect(
        Utils.getHostname("https://user:password@bitwarden.com:8080/password/sites?and&query#hash"),
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
        "subdomain.xn--btwarden-65a.com",
      );
      expect(Utils.getHostname("http://subdomain.xn--btwarden-65a.com")).toBe(
        "subdomain.xn--btwarden-65a.com",
      );
      expect(Utils.getHostname("https://subdomain.xn--btwarden-65a.com")).toBe(
        "subdomain.xn--btwarden-65a.com",
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

  function runInBothEnvironments(testName: string, testFunc: () => void): void {
    const environments = [
      { isNode: true, name: "Node environment" },
      { isNode: false, name: "non-Node environment" },
    ];

    environments.forEach((env) => {
      it(`${testName} in ${env.name}`, () => {
        Utils.isNode = env.isNode;
        testFunc();
      });
    });
  }

  const asciiHelloWorld = "hello world";
  const asciiHelloWorldArray = [104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100];
  const b64HelloWorldString = "aGVsbG8gd29ybGQ=";

  describe("fromBufferToB64(...)", () => {
    const originalIsNode = Utils.isNode;

    afterEach(() => {
      Utils.isNode = originalIsNode;
    });

    runInBothEnvironments("should convert an ArrayBuffer to a b64 string", () => {
      const buffer = new Uint8Array(asciiHelloWorldArray).buffer;
      const b64String = Utils.fromBufferToB64(buffer);
      expect(b64String).toBe(b64HelloWorldString);
    });

    runInBothEnvironments("should return null for an empty ArrayBuffer", () => {
      const buffer = new Uint8Array([]).buffer;
      const b64String = Utils.fromBufferToB64(buffer);
      expect(b64String).toBeNull();
    });

    runInBothEnvironments("should return null for null input", () => {
      const b64String = Utils.fromBufferToB64(null);
      expect(b64String).toBeNull();
    });

    runInBothEnvironments("returns null for undefined input", () => {
      const b64 = Utils.fromBufferToB64(undefined as unknown as ArrayBuffer);
      expect(b64).toBeNull();
    });

    runInBothEnvironments("returns null for empty input", () => {
      const b64 = Utils.fromBufferToB64(new ArrayBuffer(0));
      expect(b64).toBeNull();
    });

    runInBothEnvironments("accepts Uint8Array directly", () => {
      const u8 = new Uint8Array(asciiHelloWorldArray);
      const b64 = Utils.fromBufferToB64(u8);
      expect(b64).toBe(b64HelloWorldString);
    });

    runInBothEnvironments("respects byteOffset/byteLength (view window)", () => {
      // [xx, 'hello world', yy] — view should only encode the middle slice
      const prefix = [1, 2, 3];
      const suffix = [4, 5];
      const all = new Uint8Array([...prefix, ...asciiHelloWorldArray, ...suffix]);
      const view = new Uint8Array(all.buffer, prefix.length, asciiHelloWorldArray.length);
      const b64 = Utils.fromBufferToB64(view);
      expect(b64).toBe(b64HelloWorldString);
    });

    runInBothEnvironments("handles DataView (ArrayBufferView other than Uint8Array)", () => {
      const u8 = new Uint8Array(asciiHelloWorldArray);
      const dv = new DataView(u8.buffer, 0, u8.byteLength);
      const b64 = Utils.fromBufferToB64(dv);
      expect(b64).toBe(b64HelloWorldString);
    });

    runInBothEnvironments("handles DataView with offset/length window", () => {
      // Buffer: [xx, 'hello world', yy]
      const prefix = [9, 9, 9];
      const suffix = [8, 8];
      const all = new Uint8Array([...prefix, ...asciiHelloWorldArray, ...suffix]);

      // DataView over just the "hello world" window
      const dv = new DataView(all.buffer, prefix.length, asciiHelloWorldArray.length);

      const b64 = Utils.fromBufferToB64(dv);
      expect(b64).toBe(b64HelloWorldString);
    });

    runInBothEnvironments("encodes empty view (offset-length window of zero) as null", () => {
      const backing = new Uint8Array([1, 2, 3, 4]);
      const emptyView = new Uint8Array(backing.buffer, 2, 0);
      const b64 = Utils.fromBufferToB64(emptyView);
      expect(b64).toBeNull();
    });

    runInBothEnvironments("does not mutate the input", () => {
      const original = new Uint8Array(asciiHelloWorldArray);
      const copyBefore = new Uint8Array(original); // snapshot
      Utils.fromBufferToB64(original);
      expect(original).toEqual(copyBefore); // unchanged
    });

    it("produces the same Base64 in Node vs non-Node mode", () => {
      const bytes = new Uint8Array(asciiHelloWorldArray);

      Utils.isNode = true;
      const nodeB64 = Utils.fromBufferToB64(bytes);

      Utils.isNode = false;
      const browserB64 = Utils.fromBufferToB64(bytes);

      expect(browserB64).toBe(nodeB64);
    });
  });

  describe("fromB64ToArray(...)", () => {
    runInBothEnvironments("should convert a b64 string to an Uint8Array", () => {
      const expectedArray = new Uint8Array(asciiHelloWorldArray);

      const resultArray = Utils.fromB64ToArray(b64HelloWorldString);

      expect(resultArray).toEqual(expectedArray);
    });

    runInBothEnvironments("should return null for null input", () => {
      const expectedArray = Utils.fromB64ToArray(null);
      expect(expectedArray).toBeNull();
    });

    // Hmmm... this passes in browser but not in node
    // as node doesn't throw an error for invalid base64 strings.
    // It instead produces a buffer with the bytes that could be decoded
    // and ignores the rest after an invalid character.
    // https://github.com/nodejs/node/issues/8569
    // This could be mitigated with a regex check before decoding...
    // runInBothEnvironments("should throw an error for invalid base64 string", () => {
    //   const invalidB64String = "invalid base64";
    //   expect(() => {
    //     Utils.fromB64ToArrayBuffer(invalidB64String);
    //   }).toThrow();
    // });
  });

  describe("Base64 and ArrayBuffer round trip conversions", () => {
    const originalIsNode = Utils.isNode;

    afterEach(() => {
      Utils.isNode = originalIsNode;
    });

    runInBothEnvironments(
      "should correctly round trip convert from ArrayBuffer to base64 and back",
      () => {
        // Start with a known ArrayBuffer
        const originalArray = new Uint8Array(asciiHelloWorldArray);
        const originalBuffer = originalArray.buffer;

        // Convert ArrayBuffer to a base64 string
        const b64String = Utils.fromBufferToB64(originalBuffer);

        // Convert that base64 string back to an ArrayBuffer
        const roundTrippedBuffer = Utils.fromB64ToArray(b64String).buffer;
        const roundTrippedArray = new Uint8Array(roundTrippedBuffer);

        // Compare the original ArrayBuffer with the round-tripped ArrayBuffer
        expect(roundTrippedArray).toEqual(originalArray);
      },
    );

    runInBothEnvironments(
      "should correctly round trip convert from base64 to ArrayBuffer and back",
      () => {
        // Convert known base64 string to ArrayBuffer
        const bufferFromB64 = Utils.fromB64ToArray(b64HelloWorldString).buffer;

        // Convert the ArrayBuffer back to a base64 string
        const roundTrippedB64String = Utils.fromBufferToB64(bufferFromB64);

        // Compare the original base64 string with the round-tripped base64 string
        expect(roundTrippedB64String).toBe(b64HelloWorldString);
      },
    );
  });

  describe("fromBufferToHex(...)", () => {
    const originalIsNode = Utils.isNode;

    afterEach(() => {
      Utils.isNode = originalIsNode;
    });

    /**
     * Creates a string that represents a sequence of hexadecimal byte values in ascending order.
     * Each byte value corresponds to its position in the sequence.
     *
     * @param {number} length - The number of bytes to include in the string.
     * @return {string} A string of hexadecimal byte values in sequential order.
     *
     * @example
     * // Returns '000102030405060708090a0b0c0d0e0f101112...ff'
     * createSequentialHexByteString(256);
     */
    function createSequentialHexByteString(length: number) {
      let sequentialHexString = "";
      for (let i = 0; i < length; i++) {
        // Convert the number to a hex string and pad with leading zeros if necessary
        const hexByte = i.toString(16).padStart(2, "0");
        sequentialHexString += hexByte;
      }
      return sequentialHexString;
    }

    runInBothEnvironments("should convert an ArrayBuffer to a hex string", () => {
      const buffer = new Uint8Array([0, 1, 10, 16, 255]).buffer;
      const hexString = Utils.fromBufferToHex(buffer);
      expect(hexString).toBe("00010a10ff");
    });

    runInBothEnvironments("should handle an empty buffer", () => {
      const buffer = new ArrayBuffer(0);
      const hexString = Utils.fromBufferToHex(buffer);
      expect(hexString).toBe("");
    });

    runInBothEnvironments(
      "should correctly convert a large buffer containing a repeating sequence of all 256 unique byte values to hex",
      () => {
        const largeBuffer = new Uint8Array(1024).map((_, index) => index % 256).buffer;
        const hexString = Utils.fromBufferToHex(largeBuffer);
        const expectedHexString = createSequentialHexByteString(256).repeat(4);
        expect(hexString).toBe(expectedHexString);
      },
    );

    runInBothEnvironments("should correctly convert a buffer with a single byte to hex", () => {
      const singleByteBuffer = new Uint8Array([0xab]).buffer;
      const hexString = Utils.fromBufferToHex(singleByteBuffer);
      expect(hexString).toBe("ab");
    });

    runInBothEnvironments(
      "should correctly convert a buffer with an odd number of bytes to hex",
      () => {
        const oddByteBuffer = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89]).buffer;
        const hexString = Utils.fromBufferToHex(oddByteBuffer);
        expect(hexString).toBe("0123456789");
      },
    );
  });

  describe("hexStringToArrayBuffer(...)", () => {
    test("should convert a hex string to an ArrayBuffer correctly", () => {
      const hexString = "ff0a1b"; // Arbitrary hex string
      const expectedResult = new Uint8Array([255, 10, 27]).buffer;
      const result = Utils.hexStringToArrayBuffer(hexString);
      expect(new Uint8Array(result)).toEqual(new Uint8Array(expectedResult));
    });

    test("should throw an error if the hex string length is not even", () => {
      const hexString = "abc"; // Odd number of characters
      expect(() => {
        Utils.hexStringToArrayBuffer(hexString);
      }).toThrow("HexString has to be an even length");
    });

    test("should convert a hex string representing zero to an ArrayBuffer correctly", () => {
      const hexString = "00";
      const expectedResult = new Uint8Array([0]).buffer;
      const result = Utils.hexStringToArrayBuffer(hexString);
      expect(new Uint8Array(result)).toEqual(new Uint8Array(expectedResult));
    });

    test("should handle an empty hex string", () => {
      const hexString = "";
      const expectedResult = new ArrayBuffer(0);
      const result = Utils.hexStringToArrayBuffer(hexString);
      expect(result).toEqual(expectedResult);
    });

    test("should convert a long hex string to an ArrayBuffer correctly", () => {
      const hexString = "0102030405060708090a0b0c0d0e0f";
      const expectedResult = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
        .buffer;
      const result = Utils.hexStringToArrayBuffer(hexString);
      expect(new Uint8Array(result)).toEqual(new Uint8Array(expectedResult));
    });
  });

  describe("ArrayBuffer and Hex string round trip conversions", () => {
    runInBothEnvironments(
      "should allow round-trip conversion from ArrayBuffer to hex and back",
      () => {
        const originalBuffer = new Uint8Array([10, 20, 30, 40, 255]).buffer; // arbitrary buffer
        const hexString = Utils.fromBufferToHex(originalBuffer);
        const roundTripBuffer = Utils.hexStringToArrayBuffer(hexString);
        expect(new Uint8Array(roundTripBuffer)).toEqual(new Uint8Array(originalBuffer));
      },
    );

    runInBothEnvironments(
      "should allow round-trip conversion from hex to ArrayBuffer and back",
      () => {
        const hexString = "0a141e28ff"; // arbitrary hex string
        const bufferFromHex = Utils.hexStringToArrayBuffer(hexString);
        const roundTripHexString = Utils.fromBufferToHex(bufferFromHex);
        expect(roundTripHexString).toBe(hexString);
      },
    );
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
        ]),
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
        "test%27user%40example.com",
      );
      expect(Utils.encodeRFC3986URIComponent("(test)user@example.com")).toBe(
        "%28test%29user%40example.com",
      );
      expect(Utils.encodeRFC3986URIComponent("testuser!@example.com")).toBe(
        "testuser%21%40example.com",
      );
      expect(Utils.encodeRFC3986URIComponent("Test*User@example.com")).toBe(
        "Test%2AUser%40example.com",
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
        Utils.normalizePath("api/sends/access/..%2f..%2f..%2fapi%2fsends%2faccess%2fsendkey"),
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

  describe("fromBufferToUtf8(...)", () => {
    const originalIsNode = Utils.isNode;

    afterEach(() => {
      Utils.isNode = originalIsNode;
    });

    runInBothEnvironments("should convert an ArrayBuffer to a utf8 string", () => {
      const buffer = new Uint8Array(asciiHelloWorldArray).buffer;
      const str = Utils.fromBufferToUtf8(buffer);
      expect(str).toBe(asciiHelloWorld);
    });

    runInBothEnvironments("should handle an empty buffer", () => {
      const buffer = new ArrayBuffer(0);
      const str = Utils.fromBufferToUtf8(buffer);
      expect(str).toBe("");
    });

    runInBothEnvironments("should convert a binary ArrayBuffer to a binary string", () => {
      const cases = [
        {
          input: [
            174, 21, 17, 79, 39, 130, 132, 173, 49, 180, 113, 118, 160, 15, 47, 99, 57, 208, 141,
            187, 54, 194, 153, 12, 37, 130, 155, 213, 125, 196, 241, 101,
          ],
          output: "�O'���1�qv�/c9Ѝ�6%���}��e",
        },
        {
          input: [
            88, 17, 69, 41, 75, 69, 128, 225, 252, 219, 146, 72, 162, 14, 139, 120, 30, 239, 105,
            229, 14, 131, 174, 119, 61, 88, 108, 135, 60, 88, 120, 145,
          ],
          output: "XE)KE���ےH��x�i���w=Xl�<Xx�",
        },
        {
          input: [
            121, 110, 81, 148, 48, 67, 209, 43, 3, 39, 143, 184, 237, 184, 213, 183, 84, 157, 47, 6,
            31, 183, 99, 142, 155, 156, 192, 107, 118, 64, 176, 36,
          ],
          output: "ynQ�0C�+'����շT�/�c����kv@�$",
        },
      ];

      cases.forEach((c) => {
        const buffer = new Uint8Array(c.input).buffer;
        const str = Utils.fromBufferToUtf8(buffer);
        // Match the expected output
        expect(str).toBe(c.output);
        // Make sure it matches with the Node.js Buffer output
        expect(str).toBe(Buffer.from(buffer).toString("utf8"));
      });
    });
  });

  describe("fromUtf8ToB64(...)", () => {
    const originalIsNode = Utils.isNode;

    afterEach(() => {
      Utils.isNode = originalIsNode;
    });

    runInBothEnvironments("should handle empty string", () => {
      const str = Utils.fromUtf8ToB64("");
      expect(str).toBe("");
    });

    runInBothEnvironments("should convert a normal b64 string", () => {
      const str = Utils.fromUtf8ToB64(asciiHelloWorld);
      expect(str).toBe(b64HelloWorldString);
    });

    runInBothEnvironments("should convert various special characters", () => {
      const cases = [
        { input: "»", output: "wrs=" },
        { input: "¦", output: "wqY=" },
        { input: "£", output: "wqM=" },
        { input: "é", output: "w6k=" },
        { input: "ö", output: "w7Y=" },
        { input: "»»", output: "wrvCuw==" },
      ];
      cases.forEach((c) => {
        const utfStr = c.input;
        const str = Utils.fromUtf8ToB64(utfStr);
        expect(str).toBe(c.output);
      });
    });
  });

  describe("fromB64ToUtf8(...)", () => {
    const originalIsNode = Utils.isNode;

    afterEach(() => {
      Utils.isNode = originalIsNode;
    });

    runInBothEnvironments("should handle empty string", () => {
      const str = Utils.fromB64ToUtf8("");
      expect(str).toBe("");
    });

    runInBothEnvironments("should convert a normal b64 string", () => {
      const str = Utils.fromB64ToUtf8(b64HelloWorldString);
      expect(str).toBe(asciiHelloWorld);
    });

    runInBothEnvironments("should handle various special characters", () => {
      const cases = [
        { input: "wrs=", output: "»" },
        { input: "wqY=", output: "¦" },
        { input: "wqM=", output: "£" },
        { input: "w6k=", output: "é" },
        { input: "w7Y=", output: "ö" },
        { input: "wrvCuw==", output: "»»" },
      ];

      cases.forEach((c) => {
        const b64Str = c.input;
        const str = Utils.fromB64ToUtf8(b64Str);
        expect(str).toBe(c.output);
      });
    });
  });
});
