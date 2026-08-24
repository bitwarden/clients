import { TargetSystemKind, TargetSystemMethod, TargetSystemStatus } from "../rotation";

import { TargetSystemResponse } from "./target-system.response";

describe("TargetSystemResponse", () => {
  describe("with a fully-populated Automatic target system payload", () => {
    const raw = {
      Id: "ts-uuid-1234",
      Name: "Production Entra",
      Method: TargetSystemMethod.Automatic,
      Kind: TargetSystemKind.Entra,
      Status: TargetSystemStatus.Active,
      PasswordPolicy: {
        minLength: 16,
        maxLength: 64,
        includeUppercase: true,
        includeLowercase: true,
        includeDigits: true,
        includeSymbols: false,
      },
      SupportsSessionTermination: true,
    };

    let response: TargetSystemResponse;

    beforeEach(() => {
      response = new TargetSystemResponse(raw);
    });

    it("parses id", () => {
      expect(response.id).toBe("ts-uuid-1234");
    });

    it("parses name", () => {
      expect(response.name).toBe("Production Entra");
    });

    it("parses method as TargetSystemMethod.Automatic", () => {
      expect(response.method).toBe(TargetSystemMethod.Automatic);
    });

    it("parses kind as TargetSystemKind.Entra", () => {
      expect(response.kind).toBe(TargetSystemKind.Entra);
    });

    it("parses status as TargetSystemStatus.Active", () => {
      expect(response.status).toBe(TargetSystemStatus.Active);
    });

    it("parses passwordPolicy", () => {
      expect(response.passwordPolicy).toEqual({
        minLength: 16,
        maxLength: 64,
        includeUppercase: true,
        includeLowercase: true,
        includeDigits: true,
        includeSymbols: false,
      });
    });

    it("parses supportsSessionTermination as true", () => {
      expect(response.supportsSessionTermination).toBe(true);
    });
  });

  describe("with a Manual target system (nulls and missing optional fields)", () => {
    const raw = {
      Id: "ts-uuid-5678",
      Name: "Legacy MSSQL",
      Method: TargetSystemMethod.Manual,
      // Kind, PasswordPolicy, SupportsSessionTermination absent for Manual targets
      Status: TargetSystemStatus.Disabled,
    };

    let response: TargetSystemResponse;

    beforeEach(() => {
      response = new TargetSystemResponse(raw);
    });

    it("parses method as TargetSystemMethod.Manual", () => {
      expect(response.method).toBe(TargetSystemMethod.Manual);
    });

    it("defaults kind to null when absent", () => {
      expect(response.kind).toBeNull();
    });

    it("parses status as TargetSystemStatus.Disabled", () => {
      expect(response.status).toBe(TargetSystemStatus.Disabled);
    });

    it("defaults passwordPolicy to null when absent", () => {
      expect(response.passwordPolicy).toBeNull();
    });

    it("defaults supportsSessionTermination to null when absent", () => {
      expect(response.supportsSessionTermination).toBeNull();
    });
  });

  describe("with explicit null values from the server", () => {
    const raw: Record<string, unknown> = {
      Id: "ts-uuid-9999",
      Name: "Custom Script System",
      Method: TargetSystemMethod.Automatic,
      Kind: TargetSystemKind.CustomScript,
      Status: TargetSystemStatus.Active,
      PasswordPolicy: null,
      SupportsSessionTermination: null,
    };

    let response: TargetSystemResponse;

    beforeEach(() => {
      response = new TargetSystemResponse(raw);
    });

    it("treats explicit null PasswordPolicy as null", () => {
      expect(response.passwordPolicy).toBeNull();
    });

    it("treats explicit null SupportsSessionTermination as null", () => {
      expect(response.supportsSessionTermination).toBeNull();
    });
  });
});
