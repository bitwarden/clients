import { OrganizationCreateRequest } from "./organization-create.request";
import { OrganizationKeysRequest } from "./organization-keys.request";

describe("OrganizationCreateRequest", () => {
  const validKey = "encrypted-org-key";
  const validKeys = new OrganizationKeysRequest("public-key", "encrypted-private-key");
  const validCollectionName = "encrypted-collection-name";

  it("should create a request with valid key parameters", () => {
    const request = new OrganizationCreateRequest(validKey, validKeys, validCollectionName);

    expect(request.key).toBe(validKey);
    expect(request.keys).toBe(validKeys);
    expect(request.collectionName).toBe(validCollectionName);
  });

  it("should inherit validation from parent class", () => {
    expect(() => new OrganizationCreateRequest("", validKeys, validCollectionName)).toThrow(
      "Organization key is required",
    );

    expect(() => new OrganizationCreateRequest(validKey, null!, validCollectionName)).toThrow(
      "Organization keys are required",
    );

    expect(() => new OrganizationCreateRequest(validKey, validKeys, "")).toThrow(
      "Collection name is required",
    );
  });

  it("should allow setting payment fields after construction", () => {
    const request = new OrganizationCreateRequest(validKey, validKeys, validCollectionName);
    request.paymentToken = "token";

    expect(request.paymentToken).toBe("token");
  });
});
