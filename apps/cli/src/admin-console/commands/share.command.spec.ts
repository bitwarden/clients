// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { UserId } from "@bitwarden/user-core";

import { ShareCommand } from "./share.command";

describe("ShareCommand", () => {
  const cipherService = mock<CipherService>();
  const accountService = mock<AccountService>();
  const collectionService = mock<CollectionService>();
  const organizationService = mock<OrganizationService>();

  const userId = "user-id" as UserId;
  const orgId = "aaaa0000-0000-0000-0000-000000000000" as OrganizationId;
  const cipherId = "cipher-id";
  const writableCollectionId = "bbbb0000-0000-0000-0000-000000000000";
  const viewOnlyCollectionId = "cccc0000-0000-0000-0000-000000000000";
  const unknownCollectionId = "dddd0000-0000-0000-0000-000000000000";

  const activeAccount = {
    id: userId,
    ...mockAccountInfoWith({ email: "user@example.com", name: "Test User" }),
  };

  const mockOrg = { id: orgId } as Organization;
  const mockCipher = {
    id: cipherId,
    organizationId: null,
  } as unknown as Cipher;
  const mockCipherView = { id: cipherId } as CipherView;

  const writableCollection = {
    id: writableCollectionId,
    organizationId: orgId,
    canEditItems: () => true,
  } as unknown as CollectionView;

  const viewOnlyCollection = {
    id: viewOnlyCollectionId,
    organizationId: orgId,
    readOnly: true,
    manage: false,
    canEditItems: () => false,
  } as unknown as CollectionView;

  let command: ShareCommand;

  beforeEach(() => {
    jest.clearAllMocks();

    accountService.activeAccount$ = of(activeAccount as any);
    cipherService.get.mockResolvedValue(mockCipher);
    collectionService.decryptedCollections$.mockReturnValue(
      of([writableCollection, viewOnlyCollection]),
    );
    organizationService.organizations$.mockReturnValue(of([mockOrg]));

    command = new ShareCommand(
      cipherService,
      accountService,
      collectionService,
      organizationService,
    );
  });

  const encode = (ids: string[]) => Buffer.from(JSON.stringify(ids)).toString("base64");

  it("returns notFound when cipher does not exist", async () => {
    cipherService.get.mockResolvedValue(null);

    const result = await command.run(cipherId, orgId, encode([writableCollectionId]));

    expect(result.success).toBe(false);
    expect(result.message).toContain("Not found");
  });

  it("returns badRequest when cipher already belongs to an organization", async () => {
    cipherService.get.mockResolvedValue({
      ...mockCipher,
      organizationId: orgId,
    } as unknown as Cipher);

    const result = await command.run(cipherId, orgId, encode([writableCollectionId]));

    expect(result.success).toBe(false);
    expect(result.message).toContain("already belongs to an organization");
  });

  it("returns badRequest when a collection ID is not in the org's collections", async () => {
    const result = await command.run(cipherId, orgId, encode([unknownCollectionId]));

    expect(result.success).toBe(false);
    expect(result.message).toContain("You do not have permission to add items to this collection.");
    expect(cipherService.shareWithServer).not.toHaveBeenCalled();
  });

  it("returns badRequest when the collection exists but canEditItems returns false", async () => {
    const result = await command.run(cipherId, orgId, encode([viewOnlyCollectionId]));

    expect(result.success).toBe(false);
    expect(result.message).toContain("You do not have permission to add items to this collection.");
    expect(cipherService.shareWithServer).not.toHaveBeenCalled();
  });

  it("proceeds successfully when all collections pass canEditItems", async () => {
    cipherService.decrypt.mockResolvedValue(mockCipherView);
    cipherService.shareWithServer.mockResolvedValue(undefined);
    cipherService.get.mockResolvedValueOnce(mockCipher).mockResolvedValueOnce(mockCipher);
    cipherService.decrypt.mockResolvedValue(mockCipherView);

    const result = await command.run(cipherId, orgId, encode([writableCollectionId]));

    expect(result.success).toBe(true);
    expect(cipherService.shareWithServer).toHaveBeenCalled();
  });
});
