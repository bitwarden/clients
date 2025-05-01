import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { KeyService } from "@bitwarden/key-management";

import { SecretAccessPoliciesView } from "../models/view/access-policies/secret-access-policies.view";
import { SecretView } from "../models/view/secret.view";
import { AccessPolicyService } from "../shared/access-policies/access-policy.service";

import { SecretService } from "./secret.service";

describe("SecretService", () => {
  let sut: SecretService;

  const keyService = mock<KeyService>();
  const apiService = mock<ApiService>();
  const encryptService = mock<EncryptService>();
  const accessPolicyService = mock<AccessPolicyService>();

  beforeEach(() => {
    jest.resetAllMocks();

    sut = new SecretService(keyService, apiService, encryptService, accessPolicyService);

    encryptService.encrypt.mockResolvedValue({
      encryptedString: "mockEncryptedString",
    } as EncString);
    encryptService.decryptToUtf8.mockResolvedValue(mockUnencryptedData);
  });

  it("instantiates", () => {
    expect(sut).not.toBeFalsy();
  });

  describe("create", () => {
    it("emits the secret created", async () => {
      apiService.send.mockResolvedValue(mockedSecretResponse);

      sut.secret$.subscribe((secret) => {
        expect(secret).toBeDefined();
        expect(secret).toEqual(expectedSecretView);
      });

      await sut.create("organizationId", secretView, secretAccessPoliciesView);
    });
  });

  describe("update", () => {
    it("emits the secret updated", async () => {
      apiService.send.mockResolvedValue(mockedSecretResponse);

      sut.secret$.subscribe((secret) => {
        expect(secret).toBeDefined();
        expect(secret).toEqual(expectedSecretView);
      });

      await sut.update("organizationId", secretView, secretAccessPoliciesView);
    });
  });
});

const mockedSecretResponse: any = {
  id: "001f835c-aa41-4f25-bfbf-b18d0103a1db",
  organizationId: "da0eea55-8604-4307-8a24-b187015e3071",
  key: "mockEncryptedString",
  value: "mockEncryptedString",
  note: "mockEncryptedString",
  creationDate: "2024-07-12T15:45:17.49823Z",
  revisionDate: "2024-07-12T15:45:17.49823Z",
  projects: [
    {
      id: "502d93ae-a084-490a-8a64-b187015eb69c",
      name: "mockEncryptedString",
    },
  ],
  read: true,
  write: true,
  object: "secret",
};

const secretView: SecretView = {
  id: "001f835c-aa41-4f25-bfbf-b18d0103a1db",
  organizationId: "da0eea55-8604-4307-8a24-b187015e3071",
  name: "key",
  value: "value",
  note: "note",
  creationDate: "2024-06-12T15:45:17.49823Z",
  revisionDate: "2024-06-12T15:45:17.49823Z",
  projects: [
    {
      id: "502d93ae-a084-490a-8a64-b187015eb69c",
      name: "project-name",
    },
  ],
  read: true,
  write: true,
};

const secretAccessPoliciesView: SecretAccessPoliciesView = {
  userAccessPolicies: [],
  groupAccessPolicies: [],
  serviceAccountAccessPolicies: [],
};

const mockUnencryptedData = "mockUnEncryptedString";

const expectedSecretView: SecretView = {
  id: "001f835c-aa41-4f25-bfbf-b18d0103a1db",
  organizationId: "da0eea55-8604-4307-8a24-b187015e3071",
  name: mockUnencryptedData,
  value: mockUnencryptedData,
  note: mockUnencryptedData,
  creationDate: "2024-07-12T15:45:17.49823Z",
  revisionDate: "2024-07-12T15:45:17.49823Z",
  projects: [
    {
      id: "502d93ae-a084-490a-8a64-b187015eb69c",
      name: mockUnencryptedData,
    },
  ],
  read: true,
  write: true,
};
