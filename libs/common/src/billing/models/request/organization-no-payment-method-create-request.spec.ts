import { OrganizationKeysRequest } from "../../../admin-console/models/request/organization-keys.request";

import { OrganizationNoPaymentMethodCreateRequest } from "./organization-no-payment-method-create-request";

describe("OrganizationNoPaymentMethodCreateRequest", () => {
  const validKey = "encrypted-org-key";
  const validKeys = new OrganizationKeysRequest("public-key", "encrypted-private-key");
  const validCollectionName = "encrypted-collection-name";

  it("should create a request with valid key parameters", () => {
    const request = new OrganizationNoPaymentMethodCreateRequest(
      validKey,
      validKeys,
      validCollectionName,
    );

    expect(request.key).toBe(validKey);
    expect(request.keys).toBe(validKeys);
    expect(request.collectionName).toBe(validCollectionName);
  });

  it("should throw when key is empty", () => {
    expect(
      () => new OrganizationNoPaymentMethodCreateRequest("", validKeys, validCollectionName),
    ).toThrow("Organization key is required");
  });

  it("should throw when keys is null", () => {
    expect(
      () => new OrganizationNoPaymentMethodCreateRequest(validKey, null!, validCollectionName),
    ).toThrow("Organization keys are required");
  });

  it("should throw when keys is undefined", () => {
    expect(
      () => new OrganizationNoPaymentMethodCreateRequest(validKey, undefined!, validCollectionName),
    ).toThrow("Organization keys are required");
  });

  it("should throw when collectionName is empty", () => {
    expect(() => new OrganizationNoPaymentMethodCreateRequest(validKey, validKeys, "")).toThrow(
      "Collection name is required",
    );
  });
});
