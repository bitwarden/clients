import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { OrgReportContextService } from "./org-report-context.service";

describe("OrgReportContextService", () => {
  let service: OrgReportContextService;
  let accountService: MockProxy<AccountService>;
  let organizationService: MockProxy<OrganizationService>;
  let cipherService: MockProxy<CipherService>;
  let collectionService: MockProxy<CollectionService>;
  let logService: MockProxy<LogService>;

  const logContext = "[TestReport] [Enterprise]";
  const organization = { id: "org1" } as any;

  beforeEach(() => {
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user1" } as any);
    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([organization]));
    cipherService = mock<CipherService>();
    cipherService.getAll.mockResolvedValue([]);
    collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(of([]));
    logService = mock<LogService>();

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: CipherService, useValue: cipherService },
        { provide: CollectionService, useValue: collectionService },
        { provide: LogService, useValue: logService },
      ],
    });
    service = TestBed.inject(OrgReportContextService);
  });

  it("returns the organization, manageable cipher IDs, and shared collection IDs", async () => {
    cipherService.getAll.mockResolvedValue([{ id: "c1" } as any, { id: "c2" } as any]);
    collectionService.decryptedCollections$.mockReturnValue(
      of([
        { id: "col1", isDefaultCollection: false, organizationId: "org1" } as any,
        { id: "col2", isDefaultCollection: true, organizationId: "org1" } as any,
        { id: "col3", isDefaultCollection: false, organizationId: "other" } as any,
      ]),
    );

    const ctx = await service.load("org1", logContext);

    expect(ctx.organization).toBe(organization);
    expect([...ctx.manageableCipherIds]).toEqual(["c1", "c2"]);
    // Only the non-default collection belonging to this organization is shared.
    expect([...ctx.sharedCollectionIds]).toEqual(["col1"]);
    expect(logService.error).not.toHaveBeenCalled();
  });

  it("logs and rethrows when loading the organization fails", async () => {
    organizationService.organizations$.mockReturnValue(
      throwError(() => new Error("org load failed")),
    );

    await expect(service.load("org1", logContext)).rejects.toThrow("org load failed");
    expect(logService.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load organization"),
      expect.any(Error),
    );
  });

  it("logs and rethrows when loading manageable ciphers fails", async () => {
    cipherService.getAll.mockRejectedValue(new Error("ciphers load failed"));

    await expect(service.load("org1", logContext)).rejects.toThrow("ciphers load failed");
    expect(logService.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load manageable ciphers"),
      expect.any(Error),
    );
  });

  it("logs and rethrows when loading collections fails", async () => {
    collectionService.decryptedCollections$.mockReturnValue(
      throwError(() => new Error("collection load failed")),
    );

    await expect(service.load("org1", logContext)).rejects.toThrow("collection load failed");
    expect(logService.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load collections"),
      expect.any(Error),
    );
  });
});
