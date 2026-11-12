import { mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { PAM_IDS_ONLY, PamNameResolver } from "./pam-name-resolver";
import { pamTestAccountService, pamTestOrganization } from "./testing/pam-test-helpers";

const CIPHER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const GATED_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const COLLECTION_ID = "bbbbbbbb-0000-4000-8000-000000000001";

describe("PamNameResolver", () => {
  const cipherService = mock<CipherService>();
  const collectionService = mock<CollectionService>();
  const organizationService = mock<OrganizationService>();

  const build = (accountService = pamTestAccountService()) =>
    new PamNameResolver(cipherService, collectionService, organizationService, accountService);

  beforeEach(() => {
    jest.resetAllMocks();
    cipherService.getAllDecrypted.mockResolvedValue([{ id: CIPHER_ID, name: "Prod DB" }] as never);
    collectionService.decryptedCollections$.mockReturnValue(
      of([{ id: COLLECTION_ID, name: "Production" }] as unknown as CollectionView[]),
    );
    organizationService.organizations$.mockReturnValue(of([pamTestOrganization({ name: "Acme" })]));
  });

  it("resolves names from the synced vault", async () => {
    const names = await build().load();

    expect(names.cipher(CIPHER_ID)).toBe("Prod DB");
    expect(names.collection(COLLECTION_ID)).toBe("Production");
    expect(names.organization(pamTestOrganization().id)).toBe("Acme");
  });

  it("falls back to the id for a cipher missing from the sync, such as a gated one", async () => {
    const names = await build().load();

    expect(names.cipher(GATED_ID)).toBe(GATED_ID);
  });

  it("matches ids regardless of case", async () => {
    const names = await build().load();

    expect(names.cipher(CIPHER_ID.toUpperCase())).toBe("Prod DB");
  });

  it("degrades to ids when the vault cannot be read, without throwing", async () => {
    cipherService.getAllDecrypted.mockRejectedValue(new Error("decryption failed: Prod DB"));
    collectionService.decryptedCollections$.mockReturnValue(throwError(() => new Error("x")));

    const names = await build().load();

    expect(names.cipher(CIPHER_ID)).toBe(CIPHER_ID);
    expect(names.collection(COLLECTION_ID)).toBe(COLLECTION_ID);
    expect(names.organization(pamTestOrganization().id)).toBe("Acme");
  });

  it("answers ids only with no active account", async () => {
    const accountService = pamTestAccountService();
    accountService.activeAccountSubject.next(null);

    expect(await build(accountService).load()).toBe(PAM_IDS_ONLY);
  });

  it("reads only the synced vault, never the network", async () => {
    await build().load();

    expect(cipherService.getAllDecrypted).toHaveBeenCalledTimes(1);
    expect(Object.keys(cipherService.getAllDecrypted.mock.calls[0])).toHaveLength(1);
  });
});
