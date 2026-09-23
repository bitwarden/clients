import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";

import { OrganizationUserAcceptInitRequest } from "./organization-user-accept-init.request";

describe("OrganizationUserAcceptInitRequest", () => {
  const validToken = "invite-token";
  const validKey = "encrypted-org-key";
  const validKeys = new OrganizationKeysRequest("public-key", "encrypted-private-key");
  const validCollectionName = "encrypted-collection-name";

  it("should create a request with all required parameters", () => {
    const request = new OrganizationUserAcceptInitRequest(
      validToken,
      validKey,
      validKeys,
      validCollectionName,
    );

    expect(request.token).toBe(validToken);
    expect(request.key).toBe(validKey);
    expect(request.keys).toBe(validKeys);
    expect(request.collectionName).toBe(validCollectionName);
  });

  it("should throw when token is empty", () => {
    expect(
      () => new OrganizationUserAcceptInitRequest("", validKey, validKeys, validCollectionName),
    ).toThrow("Token is required");
  });

  it("should throw when key is empty", () => {
    expect(
      () => new OrganizationUserAcceptInitRequest(validToken, "", validKeys, validCollectionName),
    ).toThrow("Organization key is required");
  });

  it("should throw when keys is null", () => {
    expect(
      () => new OrganizationUserAcceptInitRequest(validToken, validKey, null!, validCollectionName),
    ).toThrow("Organization keys are required");
  });

  it("should throw when keys is undefined", () => {
    expect(
      () =>
        new OrganizationUserAcceptInitRequest(
          validToken,
          validKey,
          undefined!,
          validCollectionName,
        ),
    ).toThrow("Organization keys are required");
  });

  it("should throw when collectionName is empty", () => {
    expect(
      () => new OrganizationUserAcceptInitRequest(validToken, validKey, validKeys, ""),
    ).toThrow("Collection name is required");
  });
});
