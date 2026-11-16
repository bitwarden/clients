import { convertToParamMap } from "@angular/router";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { importOwnerFromParams } from "./import-owner";

const orgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11" as OrganizationId;

describe("importOwnerFromParams", () => {
  it("is the personal import when the route has no organization", () => {
    expect(importOwnerFromParams(convertToParamMap({}))).toEqual({ kind: "personal" });
  });

  it("is the organization the route names", () => {
    expect(importOwnerFromParams(convertToParamMap({ organizationId: orgId }))).toEqual({
      kind: "organization",
      organizationId: orgId,
    });
  });

  it("throws for an organization that is not an id, rather than falling back to personal", () => {
    expect(() => importOwnerFromParams(convertToParamMap({ organizationId: "nope" }))).toThrow(
      "Invalid OrganizationId",
    );
  });

  it("throws for an empty organization, which is not the personal import", () => {
    expect(() => importOwnerFromParams(convertToParamMap({ organizationId: "" }))).toThrow(
      "Invalid OrganizationId",
    );
  });
});
