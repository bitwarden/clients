import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PhishingDataParserService } from "./phishing-data-parser.service";

describe("PhishingDataParserService", () => {
  let service: PhishingDataParserService;
  let logService: LogService;

  beforeEach(() => {
    logService = {
      debug: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    } as any;

    service = new PhishingDataParserService(logService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("parseDomains", () => {
    it("should parse domains from text content correctly", () => {
      const content = "phishing1.com\nphishing2.com\nphishing3.com";
      const expectedDomains = ["phishing1.com", "phishing2.com", "phishing3.com"];

      const result = service.parseDomains(content);

      expect(result).toEqual(expectedDomains);
      expect(logService.debug).toHaveBeenCalledWith(
        "[PhishingDataParserService] Parsed 3 domains from content",
      );
    });

    it("should handle mixed line endings (\\r\\n and \\n)", () => {
      const content = "phishing1.com\r\nphishing2.com\nphishing3.com\r\nphishing4.com";
      const expectedDomains = ["phishing1.com", "phishing2.com", "phishing3.com", "phishing4.com"];

      const result = service.parseDomains(content);

      expect(result).toEqual(expectedDomains);
    });

    it("should filter out comments (lines starting with #)", () => {
      const content =
        "phishing1.com\n# This is a comment\nphishing2.com\n# Another comment\nphishing3.com";
      const expectedDomains = ["phishing1.com", "phishing2.com", "phishing3.com"];

      const result = service.parseDomains(content);

      expect(result).toEqual(expectedDomains);
    });

    it("should filter out empty lines", () => {
      const content = "phishing1.com\n\nphishing2.com\n   \nphishing3.com";
      const expectedDomains = ["phishing1.com", "phishing2.com", "phishing3.com"];

      const result = service.parseDomains(content);

      expect(result).toEqual(expectedDomains);
    });

    it("should trim whitespace from lines", () => {
      const content = "  phishing1.com  \n  phishing2.com  \n  phishing3.com  ";
      const expectedDomains = ["phishing1.com", "phishing2.com", "phishing3.com"];

      const result = service.parseDomains(content);

      expect(result).toEqual(expectedDomains);
    });

    it("should handle empty content", () => {
      const result = service.parseDomains("");

      expect(result).toEqual([]);
      expect(logService.debug).toHaveBeenCalledWith(
        "[PhishingDataParserService] Empty content provided",
      );
    });

    it("should handle whitespace-only content", () => {
      const result = service.parseDomains("   \n  \n  ");

      expect(result).toEqual([]);
      expect(logService.debug).toHaveBeenCalledWith(
        "[PhishingDataParserService] Empty content provided",
      );
    });

    it("should handle content with only comments", () => {
      const content = "# Comment 1\n# Comment 2\n# Comment 3";
      const result = service.parseDomains(content);

      expect(result).toEqual([]);
    });

    it("should handle content with only empty lines", () => {
      const content = "\n\n\n";
      const result = service.parseDomains(content);

      expect(result).toEqual([]);
    });

    it("should handle parsing errors gracefully", () => {
      // Mock an error by making the content non-string and causing an error
      const invalidContent = {
        trim: jest.fn().mockReturnValue("test"),
        split: jest.fn().mockImplementation(() => {
          throw new Error("Test error");
        }),
      } as any;

      const result = service.parseDomains(invalidContent);

      expect(result).toEqual([]);
      expect(logService.error).toHaveBeenCalledWith(
        "[PhishingDataParserService] Failed to parse domains:",
        expect.any(Error),
      );
    });

    it("should handle large content efficiently", () => {
      const domains = Array.from({ length: 1000 }, (_, i) => `phishing${i}.com`);
      const content = domains.join("\n");

      const result = service.parseDomains(content);

      expect(result).toEqual(domains);
      expect(result.length).toBe(1000);
    });
  });

  describe("validateDomain", () => {
    it("should validate correct domain formats", () => {
      const validDomains = [
        "example.com",
        "sub.example.com",
        "a.b.c.d.e",
        "example.co.uk",
        "test-domain.com",
        "123.com",
        "a1b2c3.com",
        "very-long-domain-name-that-is-still-valid.com",
      ];

      validDomains.forEach((domain) => {
        expect(service.validateDomain(domain)).toBe(true);
      });
    });

    it("should reject invalid domain formats", () => {
      const invalidDomains = [
        "", // empty
        "   ", // whitespace only
        "example", // no TLD
        ".com", // starts with dot
        "example.", // ends with dot
        "example..com", // double dots
        "example-.com", // hyphen at end of label
        "-example.com", // hyphen at start of label
        "example@.com", // invalid character
        "example .com", // space in domain
        "example.com/", // path
        "example.com:8080", // port
        "http://example.com", // protocol
        "example.com#fragment", // fragment
        "example.com?query=1", // query
      ];

      invalidDomains.forEach((domain) => {
        expect(service.validateDomain(domain)).toBe(false);
      });
    });

    it("should handle null and undefined", () => {
      expect(service.validateDomain(null as any)).toBe(false);
      expect(service.validateDomain(undefined as any)).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(service.validateDomain("a.b")).toBe(true); // minimal valid domain
      expect(service.validateDomain("a")).toBe(false); // single character
      expect(service.validateDomain("a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z")).toBe(
        true,
      ); // very long but valid
    });
  });

  describe("validateAndFilterDomains", () => {
    it("should filter out invalid domains", () => {
      const domains = [
        "valid1.com",
        "invalid-domain",
        "valid2.com",
        "",
        "valid3.com",
        "another-invalid",
      ];
      const expectedValidDomains = ["valid1.com", "valid2.com", "valid3.com"];

      const result = service.validateAndFilterDomains(domains);

      expect(result).toEqual(expectedValidDomains);
    });

    it("should return all domains when all are valid", () => {
      const domains = ["valid1.com", "valid2.com", "valid3.com"];
      const expectedValidDomains = ["valid1.com", "valid2.com", "valid3.com"];

      const result = service.validateAndFilterDomains(domains);

      expect(result).toEqual(expectedValidDomains);
    });

    it("should return empty array when all domains are invalid", () => {
      const domains = ["invalid1", "invalid2", "invalid3"];

      const result = service.validateAndFilterDomains(domains);

      expect(result).toEqual([]);
    });

    it("should return empty array for empty input", () => {
      const result = service.validateAndFilterDomains([]);

      expect(result).toEqual([]);
    });

    it("should log warning when domains are filtered out", () => {
      const domains = ["valid.com", "invalid", "another-valid.com"];

      service.validateAndFilterDomains(domains);

      expect(logService.warning).toHaveBeenCalledWith(
        "[PhishingDataParserService] Filtered out 1 invalid domains",
      );
    });

    it("should not log warning when no domains are filtered", () => {
      const domains = ["valid1.com", "valid2.com"];

      service.validateAndFilterDomains(domains);

      expect(logService.warning).not.toHaveBeenCalled();
    });

    it("should handle mixed valid and invalid domains", () => {
      const domains = [
        "valid1.com",
        "invalid-domain",
        "valid2.co.uk",
        "another-invalid",
        "valid3.org",
        "",
        "valid4.net",
      ];
      const expectedValidDomains = ["valid1.com", "valid2.co.uk", "valid3.org", "valid4.net"];

      const result = service.validateAndFilterDomains(domains);

      expect(result).toEqual(expectedValidDomains);
      expect(logService.warning).toHaveBeenCalledWith(
        "[PhishingDataParserService] Filtered out 3 invalid domains",
      );
    });
  });
});
