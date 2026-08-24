import { TargetSystemKind, TargetSystemMethod } from "../rotation";

import { TargetSystemCreateRequest } from "./target-system-create.request";

describe("TargetSystemCreateRequest", () => {
  describe("Manual method", () => {
    const manualPolicy = {
      minLength: 16,
      maxLength: 32,
      includeUppercase: true,
      includeLowercase: true,
      includeDigits: true,
      includeSymbols: true,
    };

    it("serializes name, method, and passwordPolicy — no integration or session-termination fields", () => {
      const req = new TargetSystemCreateRequest({
        name: "SQL Prod",
        method: TargetSystemMethod.Manual,
        passwordPolicy: manualPolicy,
      });

      const json = JSON.parse(JSON.stringify(req));

      expect(json).toEqual({
        name: "SQL Prod",
        method: TargetSystemMethod.Manual,
        passwordPolicy: manualPolicy,
      });
      expect(json).not.toHaveProperty("kind");
      expect(json).not.toHaveProperty("supportsSessionTermination");
    });

    it("stores method as the numeric value 1", () => {
      const req = new TargetSystemCreateRequest({
        name: "Manual target",
        method: TargetSystemMethod.Manual,
        passwordPolicy: manualPolicy,
      });

      expect(req.method).toBe(1);
    });
  });

  describe("Automatic method", () => {
    const automaticInit = {
      name: "Entra Corp",
      method: TargetSystemMethod.Automatic as typeof TargetSystemMethod.Automatic,
      kind: TargetSystemKind.Entra,
      passwordPolicy: {
        minLength: 12,
        maxLength: 64,
        includeUppercase: true,
        includeLowercase: true,
        includeDigits: true,
        includeSymbols: false,
      },
      supportsSessionTermination: true,
    };

    it("serializes all required automatic fields", () => {
      const req = new TargetSystemCreateRequest(automaticInit);

      const json = JSON.parse(JSON.stringify(req));

      expect(json).toEqual({
        name: "Entra Corp",
        method: TargetSystemMethod.Automatic,
        kind: TargetSystemKind.Entra,
        passwordPolicy: {
          minLength: 12,
          maxLength: 64,
          includeUppercase: true,
          includeLowercase: true,
          includeDigits: true,
          includeSymbols: false,
        },
        supportsSessionTermination: true,
      });
    });

    it("stores method as the numeric value 0", () => {
      const req = new TargetSystemCreateRequest(automaticInit);

      expect(req.method).toBe(0);
    });

    it("stores kind as the numeric value for TargetSystemKind.Entra", () => {
      const req = new TargetSystemCreateRequest(automaticInit);

      expect(req.kind).toBe(TargetSystemKind.Entra);
    });

    it("accepts MSSQL kind", () => {
      const req = new TargetSystemCreateRequest({
        ...automaticInit,
        kind: TargetSystemKind.Mssql,
      });

      const json = JSON.parse(JSON.stringify(req));

      expect(json.kind).toBe(TargetSystemKind.Mssql);
    });

    it("accepts CustomScript kind", () => {
      const req = new TargetSystemCreateRequest({
        ...automaticInit,
        kind: TargetSystemKind.CustomScript,
      });

      const json = JSON.parse(JSON.stringify(req));

      expect(json.kind).toBe(TargetSystemKind.CustomScript);
    });

    it("preserves supportsSessionTermination=false", () => {
      const req = new TargetSystemCreateRequest({
        ...automaticInit,
        supportsSessionTermination: false,
      });

      const json = JSON.parse(JSON.stringify(req));

      expect(json.supportsSessionTermination).toBe(false);
    });
  });

  describe("method discriminant values match the server contract", () => {
    it("Automatic is 0", () => {
      expect(TargetSystemMethod.Automatic).toBe(0);
    });

    it("Manual is 1", () => {
      expect(TargetSystemMethod.Manual).toBe(1);
    });
  });
});
