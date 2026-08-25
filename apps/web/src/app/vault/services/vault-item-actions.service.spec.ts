import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import {
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  VaultItemDialogComponent,
} from "@bitwarden/vault";

import { AssignCollectionsWebComponent } from "../components/assign-collections";

import { WebVaultItemActionsService } from "./vault-item-actions.service";

describe("WebVaultItemActionsService", () => {
  const userId = "user-1" as UserId;
  const cipherId = "cipher-1" as CipherId;

  let service: WebVaultItemActionsService;
  let cipherService: MockProxy<CipherService>;
  let cipherFormConfigService: MockProxy<DefaultCipherFormConfigService>;
  let dialogService: MockProxy<DialogService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let router: MockProxy<Router>;
  let toastService: MockProxy<ToastService>;

  let itemDialogOpen: jest.SpyInstance;
  let assignCollectionsDialogOpen: jest.SpyInstance;

  /** A plain personal login, no reprompt. */
  const buildCipher = (overrides: Partial<CipherView> = {}) => {
    const cipher = new CipherView();
    cipher.id = cipherId;
    cipher.name = "Item";
    cipher.type = CipherType.Login;
    cipher.edit = true;
    cipher.reprompt = CipherRepromptType.None;
    return Object.assign(cipher, overrides);
  };

  beforeEach(() => {
    cipherService = mock<CipherService>();
    cipherFormConfigService = mock<DefaultCipherFormConfigService>();
    dialogService = mock<DialogService>();
    passwordRepromptService = mock<PasswordRepromptService>();
    router = mock<Router>();
    toastService = mock<ToastService>();

    // The stored cipher backs the dialog config; the row is what drives reprompt.
    cipherService.get.mockResolvedValue({
      id: cipherId,
      type: CipherType.Login,
      edit: true,
    } as unknown as Cipher);
    passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);
    router.navigate.mockResolvedValue(true);

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as Account);

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    itemDialogOpen = jest
      .spyOn(VaultItemDialogComponent, "open")
      .mockReturnValue({ closed: of(undefined) } as unknown as DialogRef<never>);
    assignCollectionsDialogOpen = jest
      .spyOn(AssignCollectionsWebComponent, "open")
      .mockReturnValue({ closed: of(undefined) } as unknown as DialogRef<never>);

    TestBed.configureTestingModule({
      providers: [
        WebVaultItemActionsService,
        { provide: AccountService, useValue: accountService },
        { provide: CipherService, useValue: cipherService },
        { provide: DefaultCipherFormConfigService, useValue: cipherFormConfigService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toastService },
      ],
    });

    service = TestBed.inject(WebVaultItemActionsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("password reprompt", () => {
    const protectedCipher = () => buildCipher({ reprompt: CipherRepromptType.Password });

    beforeEach(() => {
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);
    });

    it("does not open the view dialog when the prompt is refused", async () => {
      await service.view(protectedCipher());

      expect(itemDialogOpen).not.toHaveBeenCalled();
    });

    it("does not open the edit dialog when the prompt is refused", async () => {
      await service.edit(protectedCipher());

      expect(itemDialogOpen).not.toHaveBeenCalled();
    });

    it("does not open the assign dialog when the prompt is refused", async () => {
      await service.assignToCollections(protectedCipher(), []);

      expect(assignCollectionsDialogOpen).not.toHaveBeenCalled();
    });

    it("still opens the dialog for an unprotected item", async () => {
      await service.view(buildCipher());

      expect(itemDialogOpen).toHaveBeenCalled();
      expect(passwordRepromptService.showPasswordPrompt).not.toHaveBeenCalled();
    });
  });

  describe("view", () => {
    it("opens the dialog in view mode", async () => {
      await service.view(buildCipher());

      expect(itemDialogOpen).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({ mode: "view" }),
      );
    });

    it("builds a partial-edit config when the user cannot edit the item", async () => {
      cipherService.get.mockResolvedValue({
        id: cipherId,
        type: CipherType.Login,
        edit: false,
      } as unknown as Cipher);

      await service.view(buildCipher());

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "partial-edit",
        cipherId,
        CipherType.Login,
      );
    });

    it("toasts and skips the dialog when the item no longer exists", async () => {
      cipherService.get.mockResolvedValue(null as unknown as Cipher);

      await service.view(buildCipher());

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "unknownCipher" }),
      );
      expect(itemDialogOpen).not.toHaveBeenCalled();
    });

    it("clears the item query params once the dialog closes", async () => {
      await service.view(buildCipher());

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { cipherId: null, itemId: null, action: null },
          replaceUrl: true,
        }),
      );
    });
  });

  describe("edit and clone", () => {
    it("opens the form in edit mode", async () => {
      await service.edit(buildCipher());

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "edit",
        cipherId,
        CipherType.Login,
      );
      expect(itemDialogOpen).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({ mode: "form" }),
      );
    });

    it("opens the form in clone mode", async () => {
      await service.clone(buildCipher());

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "clone",
        cipherId,
        CipherType.Login,
      );
    });

    it("does not clone when the passkey warning is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const withPasskey = buildCipher();
      withPasskey.login.fido2Credentials = [{}] as never;

      await service.clone(withPasskey);

      expect(itemDialogOpen).not.toHaveBeenCalled();
    });
  });

  describe("add", () => {
    it("builds an add config with no seeded values", async () => {
      await service.add(CipherType.Card);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        CipherType.Card,
      );
    });
  });

  describe("assignToCollections", () => {
    const collection = (id: string, organizationId: string) =>
      ({ id, organizationId }) as CollectionView;

    it("offers only the owning organization's collections", async () => {
      const orgCipher = buildCipher({ organizationId: "org-1" });
      const mine = collection("collection-1", "org-1");
      const theirs = collection("collection-2", "org-2");

      await service.assignToCollections(orgCipher, [mine, theirs]);

      expect(assignCollectionsDialogOpen).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: "org-1",
            availableCollections: [mine],
          }),
        }),
      );
    });

    it("offers no collections for a personal item, leaving the destination to the dialog", async () => {
      await service.assignToCollections(buildCipher(), [collection("collection-1", "org-1")]);

      expect(assignCollectionsDialogOpen).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: undefined,
            availableCollections: [],
          }),
        }),
      );
    });
  });
});
