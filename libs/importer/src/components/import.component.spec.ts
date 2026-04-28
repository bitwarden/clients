import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ImportComponent } from "./import.component";

// resolveReturnDestination is protected — access via cast in tests
type ImportComponentWithProtected = ImportComponent & {
  resolveReturnDestination(
    returnTo: string,
  ): { returnUrl: string; returnLabel: string } | undefined;
};

describe("ImportComponent.resolveReturnDestination", () => {
  let component: ImportComponentWithProtected;
  let mockRouter: ReturnType<typeof mock<Router>>;
  let mockI18nService: ReturnType<typeof mock<I18nService>>;

  beforeEach(() => {
    mockRouter = mock<Router>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockReturnValue("Go to Access Intelligence");

    // Minimal construction — only inject the deps resolveReturnDestination uses
    component = Object.assign(Object.create(ImportComponent.prototype), {
      router: mockRouter,
      i18nService: mockI18nService,
      _organizationId: "org-abc-123",
    }) as ImportComponentWithProtected;
  });

  describe("when returnTo is 'access-intelligence' and organizationId is set", () => {
    it("returns the serialized router URL for the access-intelligence route", () => {
      const mockUrlTree = {} as ReturnType<Router["createUrlTree"]>;
      mockRouter.createUrlTree.mockReturnValue(mockUrlTree);
      mockRouter.serializeUrl.mockReturnValue("/organizations/org-abc-123/access-intelligence");

      const result = component.resolveReturnDestination("access-intelligence");

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith([
        "/organizations",
        "org-abc-123",
        "access-intelligence",
      ]);
      expect(result).toEqual({
        returnUrl: "/organizations/org-abc-123/access-intelligence",
        returnLabel: "Go to Access Intelligence",
      });
    });

    it("uses the goToAccessIntelligence i18n key for the label", () => {
      mockRouter.createUrlTree.mockReturnValue({} as ReturnType<Router["createUrlTree"]>);
      mockRouter.serializeUrl.mockReturnValue("/organizations/org-abc-123/access-intelligence");

      component.resolveReturnDestination("access-intelligence");

      expect(mockI18nService.t).toHaveBeenCalledWith("goToAccessIntelligence");
    });
  });

  describe("when returnTo is an unrecognised identifier", () => {
    it("returns undefined", () => {
      const result = component.resolveReturnDestination("unknown-page");
      expect(result).toBeUndefined();
    });
  });

  describe("when organizationId is not set", () => {
    it("returns undefined", () => {
      (component as any)._organizationId = undefined;
      const result = component.resolveReturnDestination("access-intelligence");
      expect(result).toBeUndefined();
    });
  });
});
