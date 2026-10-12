import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, UrlTree, convertToParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";

import { folderScopeGuard } from "./folder-scope.guard";

describe("folderScopeGuard", () => {
  const userId = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" as UserId;
  const heldFolderId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d";
  const otherFolderId = "9a8b7c6d-5e4f-4a3b-8c2d-1e2f3a4b5c6d";

  const listUrlTree = mock<UrlTree>();

  let router: MockProxy<Router>;
  let folderService: MockProxy<FolderService>;

  const folder = (id: string): Folder => Object.assign(new Folder(), { id });

  const makeRoute = (folderId?: string): ActivatedRouteSnapshot =>
    ({
      paramMap: convertToParamMap(folderId == null ? {} : { folderId }),
      data: {},
    }) as ActivatedRouteSnapshot;

  const runGuard = (folderId?: string) =>
    TestBed.runInInjectionContext(() => folderScopeGuard(makeRoute(folderId), {} as never));

  beforeEach(() => {
    router = mock<Router>();
    router.createUrlTree.mockReturnValue(listUrlTree);
    folderService = mock<FolderService>();
    folderService.folders$.mockReturnValue(of([folder(heldFolderId)]));

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: FolderService, useValue: folderService },
      ],
    });
  });

  it("admits a folder the user holds", async () => {
    expect(await runGuard(heldFolderId)).toBe(true);
  });

  it("redirects a folder the user does not hold to the My folders list", async () => {
    expect(await runGuard(otherFolderId)).toBe(listUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/folders"]);
  });

  it("redirects a segment that is not a guid without reading the folders", async () => {
    expect(await runGuard("not-a-guid")).toBe(listUrlTree);
    expect(folderService.folders$).not.toHaveBeenCalled();
  });

  it("redirects a route with no folder segment", async () => {
    expect(await runGuard()).toBe(listUrlTree);
  });
});
