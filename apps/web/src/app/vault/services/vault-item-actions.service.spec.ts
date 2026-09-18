import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of, Subject } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import {
  CipherFormConfig,
  DecryptionFailureDialogComponent,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  VaultItemDialogComponent,
} from "@bitwarden/vault";

import { AssignCollectionsWebComponent } from "../components/assign-collections";

import { WebVaultItemActionsService } from "./vault-item-actions.service";

/** Lets the promises an action awaits before it opens its dialog settle. */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

  /**
   * A test that exercises the dialog config, the reprompt, or the passkey warning sets this
   * rather than the row, because every action reads the stored cipher back before it opens.
   */
  const buildStoredCipher = (overrides: Partial<Cipher> = {}) =>
    ({
      id: cipherId,
      type: CipherType.Login,
      edit: true,
      reprompt: CipherRepromptType.None,
      ...overrides,
    }) as unknown as Cipher;

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

    cipherService.get.mockResolvedValue(buildStoredCipher());
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
    beforeEach(() => {
      cipherService.get.mockResolvedValue(
        buildStoredCipher({ reprompt: CipherRepromptType.Password }),
      );
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);
    });

    it("does not open the view dialog when the prompt is refused", async () => {
      await service.view(buildCipher());

      expect(itemDialogOpen).not.toHaveBeenCalled();
    });

    it("does not open the edit dialog when the prompt is refused", async () => {
      await service.edit(buildCipher());

      expect(itemDialogOpen).not.toHaveBeenCalled();
    });

    it("clears the item query params when the prompt is refused", async () => {
      await service.view(buildCipher());

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { cipherId: null, itemId: null, action: null },
        }),
      );
    });

    it("does not open the assign dialog when the prompt is refused", async () => {
      await service.assignToCollections(buildCipher({ reprompt: CipherRepromptType.Password }), []);

      expect(assignCollectionsDialogOpen).not.toHaveBeenCalled();
    });

    it("still opens the dialog for an unprotected item", async () => {
      cipherService.get.mockResolvedValue(buildStoredCipher());

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
      cipherService.get.mockResolvedValue(buildStoredCipher({ edit: false }));

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
      cipherService.get.mockResolvedValue(
        buildStoredCipher({ login: { fido2Credentials: [{}] } } as unknown as Partial<Cipher>),
      );

      await service.clone(buildCipher());

      expect(itemDialogOpen).not.toHaveBeenCalled();
    });

    it("clears the item query params when the passkey warning is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      cipherService.get.mockResolvedValue(
        buildStoredCipher({ login: { fido2Credentials: [{}] } } as unknown as Partial<Cipher>),
      );

      await service.cloneById(cipherId);

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { cipherId: null, itemId: null, action: null },
        }),
      );
    });
  });

  describe("by id", () => {
    it("opens the view dialog for an item the caller has only the id of", async () => {
      await service.viewById(cipherId);

      expect(itemDialogOpen).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({ mode: "view" }),
      );
    });

    it("opens the edit form for an item the caller has only the id of", async () => {
      await service.editById(cipherId);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "edit",
        cipherId,
        CipherType.Login,
      );
    });

    it("opens the clone form for an item the caller has only the id of", async () => {
      await service.cloneById(cipherId);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "clone",
        cipherId,
        CipherType.Login,
      );
    });

    it("toasts and clears the params when the id names no item", async () => {
      cipherService.get.mockResolvedValue(null as unknown as Cipher);

      await service.viewById(cipherId);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "unknownCipher" }),
      );
      expect(itemDialogOpen).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { cipherId: null, itemId: null, action: null },
        }),
      );
    });

    it("reports a decryption failure without reading the item back", async () => {
      const failureDialogOpen = jest
        .spyOn(DecryptionFailureDialogComponent, "open")
        .mockReturnValue({ closed: of(undefined) } as unknown as DialogRef<never>);

      await service.showDecryptionFailure(cipherId);

      expect(failureDialogOpen).toHaveBeenCalledWith(dialogService, { cipherIds: [cipherId] });
      expect(cipherService.get).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { cipherId: null, itemId: null, action: null },
        }),
      );
    });
  });

  describe("dialog open state", () => {
    it("is false before any dialog opens", () => {
      expect(service.itemDialogOpen()).toBe(false);
    });

    it("reports true while the dialog is open, and false once it closes", async () => {
      const closed = new Subject<undefined>();
      itemDialogOpen.mockReturnValue({ closed } as unknown as DialogRef<never>);

      const opening = service.view(buildCipher());
      await flushMicrotasks();
      expect(service.itemDialogOpen()).toBe(true);

      closed.next(undefined);
      closed.complete();
      await opening;

      expect(service.itemDialogOpen()).toBe(false);
    });

    it("stays true for both item query param writes, so the page ignores them", async () => {
      const openWhileWriting: boolean[] = [];
      router.navigate.mockImplementation(async () => {
        openWhileWriting.push(service.itemDialogOpen());
        return true;
      });

      await service.view(buildCipher());

      expect(openWhileWriting).toEqual([true, true]);
    });
  });

  describe("item query params", () => {
    /** The params written as the dialog opens, before the clearing write on close. */
    const openingParams = () => router.navigate.mock.calls[0][1]?.queryParams;

    it("names the viewed item on the URL", async () => {
      await service.view(buildCipher());

      expect(openingParams()).toEqual({ cipherId: null, itemId: cipherId, action: "view" });
    });

    it("names the edited item on the URL", async () => {
      await service.edit(buildCipher());

      expect(openingParams()).toEqual({ cipherId: null, itemId: cipherId, action: "edit" });
    });

    it("names the cloned item on the URL", async () => {
      await service.clone(buildCipher());

      expect(openingParams()).toEqual({ cipherId: null, itemId: cipherId, action: "clone" });
    });

    it("replaces the URL, so the dialog does not add a history entry", async () => {
      await service.view(buildCipher());

      expect(router.navigate).toHaveBeenNthCalledWith(
        1,
        [],
        expect.objectContaining({ queryParamsHandling: "merge", replaceUrl: true }),
      );
    });

    it("writes no params for the add form, which has no item to name", async () => {
      await service.add(CipherType.Login);

      expect(openingParams()).toEqual({ cipherId: null, itemId: null, action: null });
    });

    it("writes the params before the dialog opens, so a reload during it reopens the item", async () => {
      const order: string[] = [];
      router.navigate.mockImplementation(async () => {
        order.push("navigate");
        return true;
      });
      itemDialogOpen.mockImplementation(() => {
        order.push("open");
        return { closed: of(undefined) } as unknown as DialogRef<never>;
      });

      await service.view(buildCipher());

      expect(order).toEqual(["navigate", "open", "navigate"]);
    });
  });

  describe("add", () => {
    it("builds an add config with no seeded values when no scope is given", async () => {
      await service.add(CipherType.Card);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        CipherType.Card,
      );
    });

    it("seeds the organization and shared folder when both are in scope", async () => {
      const formConfig = {} as CipherFormConfig;
      cipherFormConfigService.buildConfig.mockResolvedValue(formConfig);

      await service.add(CipherType.Login, {
        organizationId: "org-1" as OrganizationId,
        collectionId: "collection-1" as CollectionId,
      });

      expect(formConfig.initialValues).toEqual({
        organizationId: "org-1",
        collectionIds: ["collection-1"],
      });
    });

    it("seeds only the organization when no shared folder is in scope", async () => {
      const formConfig = {} as CipherFormConfig;
      cipherFormConfigService.buildConfig.mockResolvedValue(formConfig);

      await service.add(CipherType.Login, { organizationId: "org-1" as OrganizationId });

      expect(formConfig.initialValues).toEqual({
        organizationId: "org-1",
        collectionIds: undefined,
      });
    });

    it("does not seed initial values for a personal-vault scope", async () => {
      const formConfig = {} as CipherFormConfig;
      cipherFormConfigService.buildConfig.mockResolvedValue(formConfig);

      await service.add(CipherType.Login, {});

      expect(formConfig.initialValues).toBeUndefined();
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
