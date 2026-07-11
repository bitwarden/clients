import { DaemonRegistrationResponse } from "./daemon-registration.response";

describe("DaemonRegistrationResponse", () => {
  describe("with a complete registration payload", () => {
    const raw = {
      Id: "daemon-uuid-new",
      ApiKeyId: "api-key-id-abc123",
      ClientSecret: "super-secret-value-xyz",
    };

    let response: DaemonRegistrationResponse;

    beforeEach(() => {
      response = new DaemonRegistrationResponse(raw);
    });

    it("parses id", () => {
      expect(response.id).toBe("daemon-uuid-new");
    });

    it("parses apiKeyId", () => {
      expect(response.apiKeyId).toBe("api-key-id-abc123");
    });

    it("parses clientSecret", () => {
      expect(response.clientSecret).toBe("super-secret-value-xyz");
    });
  });

  describe("with a camelCase payload (BaseResponse fallback)", () => {
    // BaseResponse also tries camelCase lookup when PascalCase is absent
    const raw = {
      id: "daemon-uuid-camel",
      apiKeyId: "api-key-id-camel",
      clientSecret: "secret-camel",
    };

    it("parses using camelCase fallback", () => {
      const response = new DaemonRegistrationResponse(raw);
      expect(response.id).toBe("daemon-uuid-camel");
      expect(response.apiKeyId).toBe("api-key-id-camel");
      expect(response.clientSecret).toBe("secret-camel");
    });
  });
});
