import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { SecretsManagerImportError } from "../models/error/sm-import-error";
import { SecretsManagerImportRequest } from "../models/requests/sm-import.request";
import { SecretsManagerImportedProjectRequest } from "../models/requests/sm-imported-project.request";
import { SecretsManagerImportedSecretRequest } from "../models/requests/sm-imported-secret.request";

import { SecretsManagerPortingApiService } from "./sm-porting-api.service";

describe("SecretsManagerPortingApiService", () => {
  let sut: SecretsManagerPortingApiService;

  const apiService = mock<ApiService>();
  const encryptService = mock<EncryptService>();
  const keyService = mock<KeyService>();

  beforeEach(() => {
    jest.resetAllMocks();

    sut = new SecretsManagerPortingApiService(apiService, encryptService, keyService);

    encryptService.encrypt.mockResolvedValue(mockEncryptedString);
    encryptService.decryptToUtf8.mockResolvedValue(mockUnencryptedString);

    const mockRandomBytes = new Uint8Array(64) as CsprngArray;
    const mockOrgKey = new SymmetricCryptoKey(mockRandomBytes) as OrgKey;
    keyService.getOrgKey.mockResolvedValue(mockOrgKey);
  });

  it("instantiates", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("import", () => {
    const organizationId = Utils.newGuid();
    const project1 = createProject();
    const project2 = createProject();
    const secret1 = createSecret(project1.id);
    const secret2 = createSecret(project1.id);

    const importData = createImportData([project1, project2], [secret1, secret2]);

    it("emits the import successful", async () => {
      const expectedRequest = toRequest([project1, project2], [secret1, secret2]);

      let subscriptionCount = 0;
      sut.imports$.subscribe((request) => {
        expect(request).toBeDefined();
        expect(request.projects.length).toEqual(2);
        expect(request.secrets.length).toEqual(2);
        expect(request.projects[0]).toEqual(expectedRequest.projects[0]);
        expect(request.projects[1]).toEqual(expectedRequest.projects[1]);
        expect(request.secrets[0]).toEqual(expectedRequest.secrets[0]);
        expect(request.secrets[1]).toEqual(expectedRequest.secrets[1]);
        subscriptionCount++;
      });

      await sut.import(organizationId, importData);

      expect(subscriptionCount).toEqual(1);
    });

    it("correct api service send parameters", async () => {
      const expectedRequest = toRequest([project1, project2], [secret1, secret2]);

      await sut.import(organizationId, importData);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        `/sm/${organizationId}/import`,
        expectedRequest,
        true,
        true,
      );
    });

    describe("throws SecretsManagerImportError", () => {
      it("server error", async () => {
        apiService.send.mockRejectedValue(new Error("server error"));

        await expect(async () => {
          await sut.import(organizationId, importData);
        }).rejects.toThrow(new SecretsManagerImportError("server error"));
      });

      it("validation error project invalid field in list", async () => {
        apiService.send.mockRejectedValue({
          message: "invalid field",
          validationErrors: {
            "$.Projects[1].id": ["invalid id"],
          },
        } as ValidationError);

        const expectedError = new SecretsManagerImportError();
        expectedError.lines = [
          {
            id: 2,
            type: "Project",
            key: project2.name,
            errorMessage: "invalid id",
          },
        ];

        try {
          await sut.import(organizationId, importData);
          // Expected to throw error before this line
          expect(true).toBe(false);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(SecretsManagerImportError);
          const importError = err as SecretsManagerImportError;
          expect(importError.lines).toEqual(expectedError.lines);
        }
      });

      it("validation error project invalid field in field", async () => {
        apiService.send.mockRejectedValue({
          message: "invalid field",
          validationErrors: {
            "Projects[1].id": ["invalid id"],
          },
        } as ValidationError);

        const expectedError = new SecretsManagerImportError();
        expectedError.lines = [
          {
            id: 2,
            type: "Project",
            key: project2.name,
            errorMessage: "invalid id",
          },
        ];

        try {
          await sut.import(organizationId, importData);
          // Expected to throw error before this line
          expect(true).toBe(false);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(SecretsManagerImportError);
          const importError = err as SecretsManagerImportError;
          expect(importError.lines).toEqual(expectedError.lines);
        }
      });

      it("validation error secret invalid field in list", async () => {
        apiService.send.mockRejectedValue({
          message: "invalid field",
          validationErrors: {
            "$.Secrets[1].id": ["invalid id"],
          },
        } as ValidationError);

        const expectedError = new SecretsManagerImportError();
        expectedError.lines = [
          {
            id: 2,
            type: "Secret",
            key: secret2.key,
            errorMessage: "invalid id",
          },
        ];

        try {
          await sut.import(organizationId, importData);
          // Expected to throw error before this line
          expect(true).toBe(false);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(SecretsManagerImportError);
          const importError = err as SecretsManagerImportError;
          expect(importError.lines).toEqual(expectedError.lines);
        }
      });

      it("validation error secret invalid field in field", async () => {
        apiService.send.mockRejectedValue({
          message: "invalid field",
          validationErrors: {
            "Secrets[1].id": ["invalid id"],
          },
        } as ValidationError);

        const expectedError = new SecretsManagerImportError();
        expectedError.lines = [
          {
            id: 2,
            type: "Secret",
            key: secret2.key,
            errorMessage: "invalid id",
          },
        ];

        try {
          await sut.import(organizationId, importData);
          // Expected to throw error before this line
          expect(true).toBe(false);
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(SecretsManagerImportError);
          const importError = err as SecretsManagerImportError;
          expect(importError.lines).toEqual(expectedError.lines);
        }
      });
    });
  });
});

type ValidationError = {
  message: string;
  validationErrors: Record<string, string[]>;
};

type ImportProject = {
  id: string;
  name: string;
};

type ImportSecret = {
  id: string;
  key: string;
  value: string;
  note: string;
  projectIds: string[];
};

function createProject(): ImportProject {
  const id = Utils.newGuid();
  return {
    id: id,
    name: "project " + id,
  };
}

function createSecret(projectId: string): ImportSecret {
  const id = Utils.newGuid();
  return {
    id: id,
    key: "key " + id,
    value: "value " + id,
    note: "note " + id,
    projectIds: [projectId],
  };
}

function createImportData(projects: ImportProject[], secrets: ImportSecret[]): string {
  return JSON.stringify({
    projects: projects,
    secrets: secrets,
  });
}

function toRequest(
  projects: ImportProject[],
  secrets: ImportSecret[],
): SecretsManagerImportRequest {
  return {
    projects: projects.map(
      (project) =>
        ({
          id: project.id,
          name: mockEncryptedString,
        }) as SecretsManagerImportedProjectRequest,
    ),
    secrets: secrets.map(
      (secret) =>
        ({
          id: secret.id,
          key: mockEncryptedString,
          value: mockEncryptedString,
          note: mockEncryptedString,
          projectIds: secret.projectIds,
        }) as SecretsManagerImportedSecretRequest,
    ),
  } as SecretsManagerImportRequest;
}

const mockEncryptedString = {
  encryptedString: "mockEncryptedString",
} as EncString;
const mockUnencryptedString = "mockUnEncryptedString";
