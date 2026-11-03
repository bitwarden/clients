import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { ImportRouteContext } from "./import-route-context";

const userId = "user-1" as UserId;
const orgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11" as OrganizationId;

const orgBase = ["/organizations", orgId, "settings", "tools", "import"];

function organization(type: OrganizationUserType): Organization {
  return Object.assign(new Organization(), {
    id: orgId,
    type,
    permissions: {
      accessImportExport: true,
      editAnyCollection: false,
      deleteAnyCollection: false,
    },
  });
}

describe("ImportRouteContext", () => {
  let router: MockProxy<Router>;
  let organizationService: MockProxy<OrganizationService>;
  let context: ImportRouteContext;

  const routeWith = (params: Record<string, string>) =>
    ({ snapshot: { paramMap: convertToParamMap(params) } }) as unknown as ActivatedRoute;

  beforeEach(() => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    organizationService = mock<OrganizationService>();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
      ],
    });
    context = TestBed.inject(ImportRouteContext);
  });

  describe("organizationId", () => {
    it("is undefined for the personal import", () => {
      expect(context.organizationId(routeWith({}))).toBeUndefined();
    });

    it("is the route's organization", () => {
      expect(context.organizationId(routeWith({ organizationId: orgId }))).toBe(orgId);
    });

    it("throws for a route organization that is not an id", () => {
      expect(() => context.organizationId(routeWith({ organizationId: "nope" }))).toThrow(
        "Invalid OrganizationId",
      );
    });
  });

  describe("navigate", () => {
    const routeWith = (query: Record<string, string>) =>
      ({ snapshot: { queryParamMap: convertToParamMap(query) } }) as unknown as ActivatedRoute;

    it("navigates with just the commands when there is nothing to carry", async () => {
      await context.navigate(routeWith({}), ["/tools/import", "keeper"]);

      expect(router.navigate).toHaveBeenCalledWith(["/tools/import", "keeper"]);
    });

    it("passes the caller's extras through when there is nothing to carry", async () => {
      await context.navigate(routeWith({}), ["/tools/import"], { queryParams: { source: "x" } });

      expect(router.navigate).toHaveBeenCalledWith(["/tools/import"], {
        queryParams: { source: "x" },
      });
    });

    it("carries returnTo into the next screen's URL", async () => {
      await context.navigate(routeWith({ returnTo: "access-intelligence" }), ["/a", "b"]);

      expect(router.navigate).toHaveBeenCalledWith(["/a", "b"], {
        queryParams: { returnTo: "access-intelligence" },
      });
    });

    it("carries the vault scope into the next screen's URL", async () => {
      const collectionId = "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f";
      await context.navigate(
        routeWith({ defaultOrganizationId: orgId, defaultCollectionId: collectionId }),
        ["/a"],
      );

      expect(router.navigate).toHaveBeenCalledWith(["/a"], {
        queryParams: { defaultOrganizationId: orgId, defaultCollectionId: collectionId },
      });
    });

    it("merges returnTo with the caller's own query params", async () => {
      await context.navigate(routeWith({ returnTo: "access-intelligence" }), ["/a"], {
        queryParams: { source: "keeper" },
      });

      expect(router.navigate).toHaveBeenCalledWith(["/a"], {
        queryParams: { source: "keeper", returnTo: "access-intelligence" },
      });
    });
  });

  describe("scope", () => {
    const withQuery = (query: Record<string, string>) =>
      ({ snapshot: { queryParamMap: convertToParamMap(query) } }) as unknown as ActivatedRoute;

    it("is the vault the import was started from, with anything that isn't an id dropped", () => {
      expect(
        context.scope(withQuery({ defaultOrganizationId: orgId, defaultCollectionId: "nope" })),
      ).toEqual({ defaultOrganizationId: orgId, defaultCollectionId: undefined });
    });
  });

  describe("returnTo", () => {
    it("is the URL's returnTo, or undefined without one", () => {
      const withQuery = (query: Record<string, string>) =>
        ({ snapshot: { queryParamMap: convertToParamMap(query) } }) as unknown as ActivatedRoute;

      expect(context.returnTo(withQuery({ returnTo: "access-intelligence" }))).toBe(
        "access-intelligence",
      );
      expect(context.returnTo(withQuery({}))).toBeUndefined();
    });
  });

  describe("basePath", () => {
    it("is the personal import's path without an organization", () => {
      expect(context.basePath(undefined)).toEqual(["/tools/import"]);
    });

    it("is the organization's admin console import path with one", () => {
      expect(context.basePath(orgId)).toEqual(orgBase);
    });
  });

  describe("viewImportedItems", () => {
    const sharedFolderId = "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f";
    const withQuery = (query: Record<string, string> = {}) =>
      ({ snapshot: { queryParamMap: convertToParamMap(query) } }) as unknown as ActivatedRoute;

    it("opens the personal vault for a personal import started with no vault", async () => {
      await context.viewImportedItems(undefined, withQuery());

      expect(router.navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("goes back to the organization's vault a personal import was started from, as the legacy dialog left the user there", async () => {
      await context.viewImportedItems(undefined, withQuery({ defaultOrganizationId: orgId }));

      expect(router.navigate).toHaveBeenCalledWith(["/vault", orgId]);
    });

    it("goes back to the shared folder a personal import was started from", async () => {
      await context.viewImportedItems(
        undefined,
        withQuery({ defaultOrganizationId: orgId, defaultCollectionId: sharedFolderId }),
      );

      expect(router.navigate).toHaveBeenCalledWith([
        "/vault",
        orgId,
        "shared-folders",
        sharedFolderId,
      ]);
    });

    it.each([
      ["my-vault", ["/vault", "my-vault"]],
      ["trash", ["/vault", "trash"]],
      ["archive", ["/vault", "archive"]],
      [sharedFolderId, ["/folders", sharedFolderId]],
    ])(
      "goes back to the personal page %s a personal import was started from",
      async (startedFrom, expected) => {
        await context.viewImportedItems(undefined, withQuery({ startedFrom }));

        expect(router.navigate).toHaveBeenCalledWith(expected);
      },
    );

    it("goes back to an organization's My items page, not its shared folder", async () => {
      await context.viewImportedItems(
        undefined,
        withQuery({
          defaultOrganizationId: orgId,
          defaultCollectionId: sharedFolderId,
          startedFrom: "my-items",
        }),
      );

      expect(router.navigate).toHaveBeenCalledWith(["/vault", orgId, "my-items"]);
    });

    it("opens the personal vault when the vault scope in the URL is not an id", async () => {
      await context.viewImportedItems(undefined, withQuery({ defaultOrganizationId: "not-an-id" }));

      expect(router.navigate).toHaveBeenCalledWith(["/vault"]);
    });

    it("opens the organization's vault when the user can view it", async () => {
      organizationService.organizations$.mockReturnValue(
        of([organization(OrganizationUserType.Admin)]),
      );

      await context.viewImportedItems(orgId, withQuery());

      expect(router.navigate).toHaveBeenCalledWith(["organizations", orgId, "vault"]);
    });

    it("ignores a vault scope in the URL for an organization's own import", async () => {
      organizationService.organizations$.mockReturnValue(
        of([organization(OrganizationUserType.Admin)]),
      );

      await context.viewImportedItems(
        orgId,
        withQuery({ defaultOrganizationId: "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f" }),
      );

      expect(router.navigate).toHaveBeenCalledWith(["organizations", orgId, "vault"]);
    });

    it("stays where it is when the user can't open the organization's vault, as the legacy import does", async () => {
      organizationService.organizations$.mockReturnValue(
        of([organization(OrganizationUserType.Custom)]),
      );

      await context.viewImportedItems(orgId, withQuery());

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("stays where it is when the organization is not found", async () => {
      organizationService.organizations$.mockReturnValue(of([]));

      await context.viewImportedItems(orgId, withQuery());

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
