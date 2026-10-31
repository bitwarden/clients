import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { resolveImportReturnDestination } from "./import-return-destination";

describe("resolveImportReturnDestination", () => {
  const orgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11" as OrganizationId;
  const router = mock<Router>();
  const i18nService = mock<I18nService>();

  beforeEach(() => {
    router.createUrlTree.mockReturnValue({} as any);
    router.serializeUrl.mockReturnValue("/organizations/x/access-intelligence?source=import");
    i18nService.t.mockImplementation((key) => key);
  });

  it("leads back to Access Intelligence for that organization, as the legacy import does", () => {
    const result = resolveImportReturnDestination(
      "access-intelligence",
      orgId,
      router,
      i18nService,
    );

    expect(router.createUrlTree).toHaveBeenCalledWith(
      ["/organizations", orgId, "access-intelligence"],
      { queryParams: { source: "import", status: "success" } },
    );
    expect(result).toEqual({
      returnUrl: "/organizations/x/access-intelligence?source=import",
      returnLabel: "goToAccessIntelligence",
    });
  });

  it("gives no button without a returnTo", () => {
    expect(resolveImportReturnDestination(undefined, orgId, router, i18nService)).toBeUndefined();
  });

  it("gives no button for an import that is not into an organization", () => {
    expect(
      resolveImportReturnDestination("access-intelligence", undefined, router, i18nService),
    ).toBeUndefined();
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"])(
    "gives no button, and does not throw, for the inherited name %s",
    (returnTo) => {
      expect(resolveImportReturnDestination(returnTo, orgId, router, i18nService)).toBeUndefined();
    },
  );

  it("gives no button for a returnTo it does not know, which comes from the URL", () => {
    expect(
      resolveImportReturnDestination("https://evil.example", orgId, router, i18nService),
    ).toBeUndefined();
  });
});
