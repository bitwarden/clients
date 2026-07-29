import { PlanType } from "../../../billing/enums";

import { CreateProviderOrganizationRequest } from "./create-provider-organization.request";
import { OrganizationKeysRequest } from "./organization-keys.request";

describe("CreateProviderOrganizationRequest", () => {
  const validName = "Test Org";
  const validOwnerEmail = "owner@example.com";
  const validPlanType = PlanType.TeamsAnnually;
  const validSeats = 10;
  const validKey = "encrypted-org-key";
  const validKeyPair = new OrganizationKeysRequest("public-key", "encrypted-private-key");
  const validCollectionName = "encrypted-collection-name";

  const createRequest = (
    overrides: Partial<{
      name: string;
      ownerEmail: string;
      planType: PlanType;
      seats: number;
      key: string;
      keyPair: OrganizationKeysRequest;
      collectionName: string;
    }> = {},
  ) => {
    return new CreateProviderOrganizationRequest(
      "name" in overrides ? overrides.name! : validName,
      "ownerEmail" in overrides ? overrides.ownerEmail! : validOwnerEmail,
      "planType" in overrides ? overrides.planType! : validPlanType,
      "seats" in overrides ? overrides.seats! : validSeats,
      "key" in overrides ? overrides.key! : validKey,
      "keyPair" in overrides ? overrides.keyPair! : validKeyPair,
      "collectionName" in overrides ? overrides.collectionName! : validCollectionName,
    );
  };

  it("should create a request with all required parameters", () => {
    const request = createRequest();

    expect(request.name).toBe(validName);
    expect(request.ownerEmail).toBe(validOwnerEmail);
    expect(request.planType).toBe(validPlanType);
    expect(request.seats).toBe(validSeats);
    expect(request.key).toBe(validKey);
    expect(request.keyPair).toBe(validKeyPair);
    expect(request.collectionName).toBe(validCollectionName);
  });

  it("should throw when name is empty", () => {
    expect(() => createRequest({ name: "" })).toThrow("Name is required");
  });

  it("should throw when ownerEmail is empty", () => {
    expect(() => createRequest({ ownerEmail: "" })).toThrow("Owner email is required");
  });

  it("should throw when planType is null", () => {
    expect(() => createRequest({ planType: null! })).toThrow("Plan type is required");
  });

  it("should throw when seats is null", () => {
    expect(() => createRequest({ seats: null! })).toThrow("Seats is required");
  });

  it("should throw when key is empty", () => {
    expect(() => createRequest({ key: "" })).toThrow("Organization key is required");
  });

  it("should throw when keyPair is null", () => {
    expect(() => createRequest({ keyPair: null! })).toThrow("Organization key pair is required");
  });

  it("should throw when keyPair is undefined", () => {
    expect(() => createRequest({ keyPair: undefined })).toThrow(
      "Organization key pair is required",
    );
  });

  it("should throw when collectionName is empty", () => {
    expect(() => createRequest({ collectionName: "" })).toThrow("Collection name is required");
  });
});
