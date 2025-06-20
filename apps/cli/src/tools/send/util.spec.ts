import { parseEmail } from "./util";

describe("parseEmail", () => {
  describe("single email address parsing", () => {
    it("should parse a valid single email address", () => {
      const result = parseEmail("test@example.com", []);
      expect(result).toEqual(["test@example.com"]);
    });

    it("should parse email with dots in local part", () => {
      const result = parseEmail("test.user@example.com", []);
      expect(result).toEqual(["test.user@example.com"]);
    });

    it("should parse email with underscores and hyphens", () => {
      const result = parseEmail("test_user-name@example.com", []);
      expect(result).toEqual(["test_user-name@example.com"]);
    });

    it("should parse email with plus sign", () => {
      const result = parseEmail("test+user@example.com", []);
      expect(result).toEqual(["test+user@example.com"]);
    });

    it("should parse email with dots and hyphens in domain", () => {
      const result = parseEmail("user@test-domain.co.uk", []);
      expect(result).toEqual(["user@test-domain.co.uk"]);
    });

    it("should add single email to existing previousInput array", () => {
      const result = parseEmail("new@example.com", ["existing@test.com"]);
      expect(result).toEqual(["existing@test.com", "new@example.com"]);
    });
  });

  describe("comma-separated email lists", () => {
    it("should parse comma-separated email list", () => {
      const result = parseEmail("test@example.com,user@domain.com", []);
      expect(result).toEqual(["test@example.com", "user@domain.com"]);
    });

    it("should parse comma-separated emails with spaces", () => {
      const result = parseEmail("test@example.com, user@domain.com, admin@site.org", []);
      expect(result).toEqual(["test@example.com", "user@domain.com", "admin@site.org"]);
    });

    it("should combine comma-separated emails with previousInput", () => {
      const result = parseEmail("new1@example.com,new2@domain.com", ["existing@test.com"]);
      expect(result).toEqual(["existing@test.com", "new1@example.com", "new2@domain.com"]);
    });

    it("should throw error for invalid email in comma-separated list", () => {
      expect(() => {
        parseEmail("valid@example.com,invalid-email,another@domain.com", []);
      }).toThrow("Invalid email address: invalid-email");
    });
  });

  describe("space-separated email lists", () => {
    it("should parse space-separated email list", () => {
      const result = parseEmail("test@example.com user@domain.com", []);
      expect(result).toEqual(["test@example.com", "user@domain.com"]);
    });

    it("should parse space-separated emails with multiple spaces", () => {
      const result = parseEmail("test@example.com   user@domain.com  admin@site.org", []);
      expect(result).toEqual(["test@example.com", "user@domain.com", "admin@site.org"]);
    });

    it("should combine space-separated emails with previousInput", () => {
      const result = parseEmail("new1@example.com new2@domain.com", ["existing@test.com"]);
      expect(result).toEqual(["existing@test.com", "new1@example.com", "new2@domain.com"]);
    });

    it("should throw error for invalid email in space-separated list", () => {
      expect(() => {
        parseEmail("valid@example.com invalid-email another@domain.com", []);
      }).toThrow("Invalid email address: invalid-email");
    });
  });

  describe("JSON array input format", () => {
    it("should parse valid JSON array of emails", () => {
      const result = parseEmail('["test@example.com", "user@domain.com"]', []);
      expect(result).toEqual(["test@example.com", "user@domain.com"]);
    });

    it("should parse single email in JSON array", () => {
      const result = parseEmail('["test@example.com"]', []);
      expect(result).toEqual(["test@example.com"]);
    });

    it("should parse empty JSON array", () => {
      const result = parseEmail("[]", []);
      expect(result).toEqual([]);
    });

    it("should combine JSON array with previousInput", () => {
      const result = parseEmail('["new1@example.com", "new2@domain.com"]', ["existing@test.com"]);
      expect(result).toEqual(["existing@test.com", "new1@example.com", "new2@domain.com"]);
    });

    it("should throw error for malformed JSON", () => {
      expect(() => {
        parseEmail('["test@example.com", "user@domain.com"', []);
      }).toThrow();
    });

    it("should throw error for JSON that is not an array", () => {
      expect(() => {
        parseEmail('{"email": "test@example.com"}', []);
      }).toThrow("Invalid email address:");
    });

    it("should throw error for JSON string instead of array", () => {
      expect(() => {
        parseEmail('"test@example.com"', []);
      }).toThrow("`input` must be a single address, a comma-separated list, or a JSON array");
    });

    it("should throw error for JSON number instead of array", () => {
      expect(() => {
        parseEmail("123", []);
      }).toThrow("`input` must be a single address, a comma-separated list, or a JSON array");
    });
  });

  describe("`previousInput` parameter handling", () => {
    it("should handle undefined previousInput", () => {
      const result = parseEmail("test@example.com", undefined as any);
      expect(result).toEqual(["test@example.com"]);
    });

    it("should handle null previousInput", () => {
      const result = parseEmail("test@example.com", null as any);
      expect(result).toEqual(["test@example.com"]);
    });

    it("should preserve existing emails in previousInput", () => {
      const existing = ["existing1@test.com", "existing2@test.com"];
      const result = parseEmail("new@example.com", existing);
      expect(result).toEqual(["existing1@test.com", "existing2@test.com", "new@example.com"]);
    });
  });

  describe("error cases and edge conditions", () => {
    it("should throw error for empty string input", () => {
      expect(() => {
        parseEmail("", []);
      }).toThrow("`input` must be a single address, a comma-separated list, or a JSON array");
    });

    it("should return empty array for whitespace-only input", () => {
      const result = parseEmail("   ", []);
      expect(result).toEqual([]);
    });

    it("should throw error for invalid single email", () => {
      expect(() => {
        parseEmail("invalid-email", []);
      }).toThrow("`input` must be a single address, a comma-separated list, or a JSON array");
    });

    it("should throw error for email without @ symbol", () => {
      expect(() => {
        parseEmail("testexample.com", []);
      }).toThrow("`input` must be a single address, a comma-separated list, or a JSON array");
    });

    it("should throw error for email without domain", () => {
      expect(() => {
        parseEmail("test@", []);
      }).toThrow("`input` must be a single address, a comma-separated list, or a JSON array");
    });

    it("should throw error for email without local part", () => {
      expect(() => {
        parseEmail("@example.com", []);
      }).toThrow("`input` must be a single address, a comma-separated list, or a JSON array");
    });

    it("should throw error for input that looks like file path", () => {
      expect(() => {
        parseEmail("/path/to/file.txt", []);
      }).toThrow("`input` must be a single address, a comma-separated list, or a JSON array");
    });

    it("should throw error for input that looks like URL", () => {
      expect(() => {
        parseEmail("https://example.com", []);
      }).toThrow("`input` must be a single address, a comma-separated list, or a JSON array");
    });
  });
});
