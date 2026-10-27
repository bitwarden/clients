import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject, throwError } from "rxjs";

import {
  CollectionType,
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  ImportDestinationKind,
  ImportDestinationOption,
  ImportDestinations,
  ImportResult,
  ImportResultError,
  ImportResultErrorKey,
} from "../../models";
import {
  DefaultImportStagingService,
  ImportDestinationServiceAbstraction,
  ImportStagingServiceAbstraction,
  ImportUpgradeServiceAbstraction,
} from "../../services";
import { ImportErrorDialogComponent } from "../dialog";

import { ImportDestinationComponent } from "./import-destination.component";

const POLICY_URL = "https://bitwarden.com/help/policies/#manage-item-types";

function folder(id: string, orgId: string, name: string, type: CollectionType = 0): CollectionView {
  const view = new CollectionView({
    id: id as CollectionId,
    organizationId: orgId as OrganizationId,
    name,
  });
  view.manage = true;
  view.type = type;
  return view;
}

const myVault: ImportDestinationOption = {
  id: "myVault",
  kind: ImportDestinationKind.MyVault,
  sharedFolders: [],
  restrictions: [],
};

function organization(
  id: string,
  name: string,
  extra: Partial<ImportDestinationOption> = {},
): ImportDestinationOption {
  return {
    id: `organization:${id}`,
    kind: ImportDestinationKind.Organization,
    organizationId: id as OrganizationId,
    organizationName: name,
    productTierType: ProductTierType.Teams,
    sharedFolders: [],
    restrictions: [],
    ...extra,
  };
}

function myItems(orgId: string, name: string): ImportDestinationOption {
  return {
    id: `myItems:${orgId}`,
    kind: ImportDestinationKind.MyItems,
    organizationId: orgId as OrganizationId,
    organizationName: name,
    defaultCollection: folder(
      `my-${orgId}`,
      orgId,
      "me@example.com",
      CollectionTypes.DefaultUserCollection,
    ),
    sharedFolders: [],
    restrictions: [],
  };
}

function cipher(type: CipherType = CipherType.Login): CipherView {
  const view = new CipherView();
  view.type = type;
  view.name = "Example";
  return view;
}

describe("ImportDestinationComponent", () => {
  let fixture: ComponentFixture<ImportDestinationComponent>;
  let destinations$: BehaviorSubject<ImportDestinations>;
  let destinationService: MockProxy<ImportDestinationServiceAbstraction>;
  let stagingService: DefaultImportStagingService;
  let importService: MockProxy<ImportUpgradeServiceAbstraction>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let syncService: MockProxy<SyncService>;
  let logService: MockProxy<LogService>;

  const component = () => fixture.componentInstance as any;
  const byId = (id: string) => fixture.debugElement.query(By.css(`#${id}`));
  const cards = () => fixture.debugElement.queryAll(By.css("bit-form-control-card"));
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? "";

  const stageParsed = (result = new ImportResult()) => {
    result.success = true;
    result.ciphers = [cipher()];
    stagingService.stage({ kind: "parsed", importType: "dashlane", result });
    return result;
  };

  const setup = async (
    options: {
      destinationsSource?: ImportDestinationServiceAbstraction["destinations$"];
      count?: number;
    } = {},
  ) => {
    destinationService = Object.assign(mock<ImportDestinationServiceAbstraction>(), {
      destinations$: options.destinationsSource ?? destinations$.asObservable(),
    });
    destinationService.importableCount.mockResolvedValue(options.count ?? 74);
    destinationService.hasUnassignedItems.mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [ImportDestinationComponent],
      providers: [
        { provide: ImportDestinationServiceAbstraction, useValue: destinationService },
        { provide: ImportStagingServiceAbstraction, useValue: stagingService },
        { provide: ImportUpgradeServiceAbstraction, useValue: importService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: SyncService, useValue: syncService },
        { provide: LogService, useValue: logService },
        {
          provide: I18nService,
          useValue: mock<I18nService>({
            t: (key: string, ...p: unknown[]) => (p.length ? `${key}:${p.join(",")}` : key),
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportDestinationComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    destinations$ = new BehaviorSubject<ImportDestinations>({
      options: [myVault, organization("a", "Acme Co")],
      hasStep: true,
    });
    stagingService = new DefaultImportStagingService();
    importService = mock<ImportUpgradeServiceAbstraction>();
    importService.importImportResult.mockImplementation((result) => Promise.resolve(result));
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);
    dialogService.open.mockReturnValue({ closed: of(undefined) } as any);
    toastService = mock<ToastService>();
    syncService = mock<SyncService>();
    syncService.fullSync.mockResolvedValue(true);
    logService = mock<LogService>();
  });

  describe("rendering", () => {
    it("shows a spinner and no cards while the destinations load", async () => {
      await setup({ destinationsSource: new Subject<ImportDestinations>().asObservable() });

      expect(fixture.debugElement.query(By.css("bit-spinner"))).not.toBeNull();
      expect(cards()).toHaveLength(0);
      expect(
        byId("import-destination_button_import").nativeElement.getAttribute("aria-disabled"),
      ).toBe("true");
    });

    it("shows a danger callout, a toast and a disabled Import when the lookup fails, logging only the error name", async () => {
      await setup({
        destinationsSource: throwError(() => new RangeError("failed for Acme Co")),
      });

      expect(text()).toContain("errorOccurred");
      expect(cards()).toHaveLength(0);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "errorOccurred" }),
      );
      expect(logService.error).toHaveBeenCalledWith(
        "Error loading import destinations:",
        "RangeError",
      );
      expect(
        byId("import-destination_button_import").nativeElement.getAttribute("aria-disabled"),
      ).toBe("true");
    });

    it("renders one card per option, with label and hint, and selects the first", async () => {
      await setup();

      expect(cards()).toHaveLength(2);
      expect(cards()[0].nativeElement.textContent).toContain("myVault");
      expect(cards()[0].nativeElement.textContent).toContain("importVisibleOnlyToYou");
      expect(cards()[1].nativeElement.textContent).toContain("Acme Co");
      expect(cards()[1].nativeElement.textContent).toContain("importOrganizationVault");
      expect(component().destinationControl.value).toBe("myVault");
    });

    it("uses vault wording when no My items card is offered", async () => {
      await setup();

      expect(text()).toContain("selectAVaultTitle");
      expect(text()).toContain("importDestinationDescription");
    });

    it("uses location wording and names the owning org on a My items card", async () => {
      destinations$.next({
        options: [myItems("a", "Acme Co"), organization("a", "Acme Co")],
        hasStep: true,
      });
      await setup();

      expect(text()).toContain("selectALocationTitle");
      expect(cards()[0].nativeElement.textContent).toContain("importMyItemsOption");
      expect(cards()[0].nativeElement.textContent).toContain("importMyItemsOwnedBy:Acme Co");
      expect(component().destinationControl.value).toBe("myItems:a");
    });

    it("lists a My items card before each org's card, and selects the first", async () => {
      destinations$.next({
        options: [
          myItems("a", "Acme Co"),
          organization("a", "Acme Co"),
          myItems("b", "Org B"),
          organization("b", "Org B"),
        ],
        hasStep: true,
      });
      await setup();

      expect(
        cards().map((c) => c.nativeElement.textContent.includes("importMyItemsOption")),
      ).toEqual([true, false, true, false]);
      expect(component().destinationControl.value).toBe("myItems:a");
    });

    it.each([
      [ProductTierType.Free, "bwi-family"],
      [ProductTierType.Families, "bwi-family"],
      [ProductTierType.Teams, "bwi-business"],
      [ProductTierType.Enterprise, "bwi-business"],
      [ProductTierType.TeamsStarter, "bwi-business"],
    ])("shows the right icon for product tier %s", async (tier, icon) => {
      destinations$.next({
        options: [myVault, organization("a", "Acme Co", { productTierType: tier })],
        hasStep: true,
      });
      await setup();

      expect(component().cards()[1].icon).toBe(icon);
      expect(component().cards()[0].icon).toBe("bwi-user");
    });

    it.each([
      [ProductTierType.Free, "importSharedWithOnePerson"],
      [ProductTierType.Families, "importFamilyVault"],
      [ProductTierType.Teams, "importOrganizationVault"],
      [ProductTierType.Enterprise, "importOrganizationVault"],
      [ProductTierType.TeamsStarter, "importOrganizationVault"],
      [undefined, "importOrganizationVault"],
    ])("shows the right subtitle for product tier %s", async (tier, hint) => {
      destinations$.next({
        options: [myVault, organization("a", "Acme Co", { productTierType: tier })],
        hasStep: true,
      });
      await setup();

      expect(component().cards()[1].hint).toBe(hint);
    });

    it("shows a callout, with a policy help link, naming the org and the types it removes", async () => {
      destinations$.next({
        options: [
          myVault,
          organization("a", "Acme Co", {
            restrictions: [
              {
                organizationName: "Acme Co",
                types: [CipherType.Card, CipherType.Passport],
              },
            ],
          }),
        ],
        hasStep: true,
      });
      await setup();
      expect(fixture.debugElement.query(By.css("bit-callout"))).toBeNull();

      component().destinationControl.setValue("organization:a");
      fixture.detectChanges();

      const callout = fixture.debugElement.query(By.css("bit-callout"));
      expect(callout.nativeElement.textContent).toContain(
        "importItemTypesRestricted:Acme Co,importRestrictedTypeCard and importRestrictedTypePassport",
      );
      const link = callout.query(By.css("a")).nativeElement as HTMLAnchorElement;
      expect(link.getAttribute("href")).toBe(POLICY_URL);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
    });

    it("shows one callout per restricting org on My vault", async () => {
      destinations$.next({
        options: [
          {
            ...myVault,
            restrictions: [
              { organizationName: "Acme Co", types: [CipherType.Card] },
              { organizationName: "Org B", types: [CipherType.Passport] },
            ],
          },
          organization("a", "Acme Co"),
        ],
        hasStep: true,
      });
      await setup();

      expect(fixture.debugElement.queryAll(By.css("bit-callout"))).toHaveLength(2);
    });

    it("labels Import with the count of items that will import", async () => {
      stageParsed();
      await setup();

      expect(byId("import-destination_button_import").nativeElement.textContent).toContain(
        "importItemsCount:74",
      );
    });

    it("uses the singular label for one item", async () => {
      stageParsed();
      await setup({ count: 1 });

      expect(component().importLabel()).toBe("importItemsSingular");
    });

    it("shows plain Import when nothing is staged", async () => {
      await setup();

      expect(component().importLabel()).toBe("importVerb");
    });

    it("shows plain Import for an SDK import, which has no count", async () => {
      stagingService.stage({
        kind: "sdk",
        format: "keepasskdbx",
        file: new Uint8Array([1]),
        credentials: { kind: "password", password: "pw" },
      });
      await setup();

      expect(component().importLabel()).toBe("importVerb");
    });
  });

  describe("shared folder", () => {
    const withFolders = organization("a", "Zeta Co", {
      sharedFolders: [folder("f1", "a", "Alpha"), folder("f2", "a", "Beta")],
    });
    const vowel = organization("e", "Eng Co", { sharedFolders: [folder("f3", "e", "Gamma")] });

    beforeEach(() => {
      destinations$.next({
        options: [myVault, withFolders, vowel, organization("n", "No folders")],
        hasStep: true,
      });
    });

    const checkbox = () => byId("import-destination_input_move-to-shared-folder");
    const select = () => byId("import-destination_select_shared-folder");

    it("is hidden for My vault", async () => {
      await setup();

      expect(checkbox()).toBeNull();
    });

    it("is hidden for My items", async () => {
      destinations$.next({
        options: [myItems("a", "Acme Co"), withFolders],
        hasStep: true,
      });
      await setup();

      expect(component().destinationControl.value).toBe("myItems:a");
      expect(checkbox()).toBeNull();
    });

    it("is hidden for an org where the user manages no shared folder", async () => {
      await setup();

      component().destinationControl.setValue("organization:n");
      fixture.detectChanges();

      expect(checkbox()).toBeNull();
    });

    it("shows an unchecked checkbox, and no dropdown, for an org with shared folders", async () => {
      await setup();

      component().destinationControl.setValue("organization:a");
      fixture.detectChanges();

      expect(checkbox()).not.toBeNull();
      expect(component().moveToSharedFolderControl.value).toBe(false);
      expect(select()).toBeNull();
    });

    it("words the label with 'a' or 'an' by the org name's first letter", async () => {
      await setup();

      component().destinationControl.setValue("organization:a");
      fixture.detectChanges();
      expect(text()).toContain("importMoveAllItemsIntoSharedFolderA:Zeta Co");

      component().destinationControl.setValue("organization:e");
      fixture.detectChanges();
      expect(text()).toContain("importMoveAllItemsIntoSharedFolderAn:Eng Co");
    });

    it("shows the required dropdown only while the box is checked", async () => {
      await setup();
      component().destinationControl.setValue("organization:a");
      fixture.detectChanges();

      component().moveToSharedFolderControl.setValue(true);
      fixture.detectChanges();
      expect(select()).not.toBeNull();
      expect(component().sharedFolderControl.enabled).toBe(true);

      component().moveToSharedFolderControl.setValue(false);
      fixture.detectChanges();
      expect(select()).toBeNull();
      expect(component().sharedFolderControl.disabled).toBe(true);
    });

    it("clears the box and the chosen folder when the destination changes, even back to the same org", async () => {
      await setup();
      component().destinationControl.setValue("organization:a");
      component().moveToSharedFolderControl.setValue(true);
      component().sharedFolderControl.setValue(withFolders.sharedFolders[0]);
      fixture.detectChanges();

      component().destinationControl.setValue("myVault");
      fixture.detectChanges();
      component().destinationControl.setValue("organization:a");
      fixture.detectChanges();

      expect(component().moveToSharedFolderControl.value).toBe(false);
      expect(component().sharedFolderControl.value).toBeNull();
    });
  });

  describe("Import", () => {
    const importButton = () => byId("import-destination_button_import").nativeElement;
    const submit = () => component().submit() as Promise<void>;

    it("imports a copy to My vault with no org or target, skips the sharing dialog, then syncs, reports and continues", async () => {
      const staged = stageParsed();
      await setup();
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await submit();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(importService.importImportResult).toHaveBeenCalledTimes(1);
      const [sent, org, target, canAccess] = importService.importImportResult.mock.calls[0];
      expect(sent).not.toBe(staged);
      expect(sent).toEqual(staged);
      expect([org, target, canAccess]).toEqual([undefined, undefined, false]);
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(dialogService.open).toHaveBeenCalled();
      expect(stagingService.current()).toBeUndefined();
      expect(continueSpy).toHaveBeenCalledTimes(1);
    });

    it("asks to confirm sharing for an org, and stays put with selections intact on Cancel", async () => {
      stageParsed();
      await setup();
      component().destinationControl.setValue("organization:a");
      fixture.detectChanges();
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await submit();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: { key: "importToOrganization", placeholders: ["Acme Co"] },
          content: { key: "importDataMayBeShared" },
          acceptButtonText: { key: "continue" },
          cancelButtonText: { key: "cancel" },
        }),
      );
      expect(importService.importImportResult).not.toHaveBeenCalled();
      expect(stagingService.current()).toBeDefined();
      expect(component().destinationControl.value).toBe("organization:a");
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("imports into the org, with no target, once sharing is confirmed", async () => {
      stageParsed();
      await setup();
      component().destinationControl.setValue("organization:a");
      fixture.detectChanges();

      await submit();

      const [, org, target] = importService.importImportResult.mock.calls[0];
      expect(org).toBe("a");
      expect(target).toBeUndefined();
    });

    it("imports into My items with the org and its default collection, with no sharing dialog", async () => {
      const items = myItems("a", "Acme Co");
      destinations$.next({
        options: [items, organization("a", "Acme Co")],
        hasStep: true,
      });
      stageParsed();
      await setup();

      await submit();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      const [, org, target] = importService.importImportResult.mock.calls[0];
      expect(org).toBe("a");
      expect(target).toBe(items.defaultCollection);
    });

    it("requires a shared folder once the box is checked, with an inline error", async () => {
      destinations$.next({
        options: [
          myVault,
          organization("a", "Acme Co", { sharedFolders: [folder("f1", "a", "Alpha")] }),
        ],
        hasStep: true,
      });
      stageParsed();
      await setup();
      component().destinationControl.setValue("organization:a");
      component().moveToSharedFolderControl.setValue(true);
      fixture.detectChanges();

      await submit();

      expect(importService.importImportResult).not.toHaveBeenCalled();
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(component().sharedFolderControl.touched).toBe(true);
      expect(component().sharedFolderControl.errors).toEqual({
        sharedFolderRequired: { message: "importSharedFolderRequired" },
        required: true,
      });
    });

    it("imports into the chosen shared folder, and skips the unassigned-items check", async () => {
      const alpha = folder("f1", "a", "Alpha");
      destinations$.next({
        options: [myVault, organization("a", "Acme Co", { sharedFolders: [alpha] })],
        hasStep: true,
      });
      stageParsed();
      await setup();
      destinationService.hasUnassignedItems.mockResolvedValue(true);
      component().destinationControl.setValue("organization:a");
      component().moveToSharedFolderControl.setValue(true);
      component().sharedFolderControl.setValue(alpha);
      fixture.detectChanges();

      await submit();

      expect(destinationService.hasUnassignedItems).not.toHaveBeenCalled();
      const [, org, target] = importService.importImportResult.mock.calls[0];
      expect(org).toBe("a");
      expect(target).toBe(alpha);
    });

    it("shows the unassigned-items toast, before the dialog, and imports nothing", async () => {
      stageParsed();
      await setup();
      destinationService.hasUnassignedItems.mockResolvedValue(true);
      component().destinationControl.setValue("organization:a");
      fixture.detectChanges();

      await submit();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "importUnassignedItemsErrorV2" }),
      );
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(importService.importImportResult).not.toHaveBeenCalled();
      expect(stagingService.current()).toBeDefined();
    });

    it("does not run the unassigned-items check for My vault", async () => {
      stageParsed();
      await setup();
      destinationService.hasUnassignedItems.mockResolvedValue(true);

      await submit();

      expect(destinationService.hasUnassignedItems).not.toHaveBeenCalled();
      expect(importService.importImportResult).toHaveBeenCalled();
    });

    it("shows the error dialog, keeps the items staged, and logs only the error name when the import fails", async () => {
      stageParsed();
      await setup();
      importService.importImportResult.mockRejectedValue(
        new TypeError('[Login] "Bank of Acme": server said no'),
      );
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      await submit();

      expect(dialogService.open).toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.objectContaining({ data: expect.any(Error) }),
      );
      expect(logService.error).toHaveBeenCalledWith("Import failed:", "TypeError");
      expect(JSON.stringify(logService.error.mock.calls)).not.toContain("Bank of Acme");
      expect(stagingService.current()).toBeDefined();
      expect(continueSpy).not.toHaveBeenCalled();
    });

    it("imports a fresh copy on a retry, never the object an earlier attempt rewrote", async () => {
      stageParsed();
      await setup();
      importService.importImportResult.mockRejectedValueOnce(new Error("boom"));

      await submit();
      await submit();

      const [first] = importService.importImportResult.mock.calls[0];
      const [second] = importService.importImportResult.mock.calls[1];
      expect(second).not.toBe(first);
    });

    describe("a staged SDK file", () => {
      const file = new Uint8Array([1, 2, 3]);
      const credentials = { kind: "password", password: "pw" } as const;

      beforeEach(() => {
        stagingService.stage({ kind: "sdk", format: "keepasskdbx", file, credentials });
      });

      it("imports to My vault with its credentials and no organization, and never parses ahead", async () => {
        await setup();
        importService.importWithSdk.mockResolvedValue({ ciphers: [] } as any);

        await submit();

        expect(importService.importWithSdk).toHaveBeenCalledWith(
          "keepasskdbx",
          file,
          credentials,
          undefined,
          undefined,
          false,
        );
        expect(importService.importImportResult).not.toHaveBeenCalled();
        expect(importService.parse).not.toHaveBeenCalled();
      });

      it("refuses an organization with no shared folder before the sharing dialog, as the SDK always would", async () => {
        await setup();
        component().destinationControl.setValue("organization:a");
        fixture.detectChanges();

        await submit();

        expect(toastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "error", message: "importUnassignedItemsErrorV2" }),
        );
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        expect(importService.importWithSdk).not.toHaveBeenCalled();
        expect(stagingService.current()).toBeDefined();
      });

      it("imports into the chosen shared folder of an organization once sharing is confirmed", async () => {
        const alpha = folder("f1", "a", "Alpha");
        destinations$.next({
          options: [myVault, organization("a", "Acme Co", { sharedFolders: [alpha] })],
          hasStep: true,
        });
        await setup();
        importService.importWithSdk.mockResolvedValue({ ciphers: [] } as any);
        component().destinationControl.setValue("organization:a");
        component().moveToSharedFolderControl.setValue(true);
        component().sharedFolderControl.setValue(alpha);
        fixture.detectChanges();

        await submit();

        expect(dialogService.openSimpleDialog).toHaveBeenCalled();
        expect(importService.importWithSdk).toHaveBeenCalledWith(
          "keepasskdbx",
          file,
          credentials,
          "a",
          alpha,
          false,
        );
      });

      it("imports into My items with the organization and its default collection", async () => {
        const items = myItems("a", "Acme Co");
        destinations$.next({
          options: [items, organization("a", "Acme Co")],
          hasStep: true,
        });
        await setup();
        importService.importWithSdk.mockResolvedValue({ ciphers: [] } as any);

        await submit();

        expect(importService.importWithSdk).toHaveBeenCalledWith(
          "keepasskdbx",
          file,
          credentials,
          "a",
          items.defaultCollection,
          false,
        );
      });
    });

    describe("a staged Keeper vault", () => {
      it("reshapes a copy for an organization, and leaves the staged original alone", async () => {
        const staged = stageParsed();
        await setup();
        component().destinationControl.setValue("organization:a");
        fixture.detectChanges();

        await submit();

        expect(importService.toOrganizationShape).toHaveBeenCalledTimes(1);
        const [reshaped, org] = importService.toOrganizationShape.mock.calls[0];
        expect(org).toBe("a");
        expect(reshaped).not.toBe(staged);
        expect(importService.importImportResult.mock.calls[0][0]).toBe(reshaped);
      });

      it("keeps the personal shape for My vault", async () => {
        stageParsed();
        await setup();

        await submit();

        expect(importService.toOrganizationShape).not.toHaveBeenCalled();
      });
    });

    describe("a staged file", () => {
      const importer = {} as any;
      // `null` is a file credential parsing could not parse, so it has no count; `undefined` takes
      // the default.
      const stageFile = (itemCount: number | null = 5) =>
        stagingService.stage({
          kind: "file",
          importType: "dashlane",
          format: "dashlanecsv",
          contents: "a,b",
          filePassword: null,
          itemCount: itemCount ?? undefined,
        });

      beforeEach(() => {
        importService.getImporter.mockReturnValue(importer);
        importService.parse.mockImplementation(() => {
          const parsed = new ImportResult();
          parsed.success = true;
          return Promise.resolve(parsed);
        });
      });

      it("parses it again for My vault with no organization, and imports that result", async () => {
        stageFile();
        await setup();

        await submit();

        expect(importService.getImporter).toHaveBeenCalledWith(
          "dashlanecsv",
          expect.any(Function),
          undefined,
        );
        expect(importService.parse).toHaveBeenCalledWith(importer, "a,b");
        const parsed = await importService.parse.mock.results[0].value;
        expect(importService.importImportResult.mock.calls[0][0]).toBe(parsed);
      });

      it("parses it with the chosen organization, so the importer shapes its result for it", async () => {
        stageFile();
        await setup();
        component().destinationControl.setValue("organization:a");
        fixture.detectChanges();

        await submit();

        expect(importService.getImporter).toHaveBeenCalledWith(
          "dashlanecsv",
          expect.any(Function),
          "a",
        );
      });

      it("parses it with the organization for My items too, which is an organization collection", async () => {
        destinations$.next({
          options: [myItems("a", "Acme Co"), organization("a", "Acme Co")],
          hasStep: true,
        });
        stageFile();
        await setup();

        await submit();

        expect(importService.getImporter).toHaveBeenCalledWith(
          "dashlanecsv",
          expect.any(Function),
          "a",
        );
      });

      it("checks the organization-shaped result for unassigned items", async () => {
        stageFile();
        await setup();
        component().destinationControl.setValue("organization:a");
        fixture.detectChanges();

        await submit();

        const parsed = await importService.parse.mock.results[0].value;
        expect(destinationService.hasUnassignedItems).toHaveBeenCalledWith(parsed);
      });

      it("labels Import with the count credential parsing found, without counting again", async () => {
        stageFile(1);
        await setup();

        expect(component().importLabel()).toBe("importItemsSingular");
        expect(destinationService.importableCount).not.toHaveBeenCalled();
      });

      it("labels Import plainly when credential parsing could not parse the file", async () => {
        stageFile(null);
        await setup();

        expect(component().importLabel()).toBe("importVerb");
      });

      it("answers the importer's password question with the one credential parsing kept, without asking again", async () => {
        stagingService.stage({
          kind: "file",
          importType: "dashlane",
          format: "dashlanecsv",
          contents: "a,b",
          filePassword: "file-secret",
          itemCount: 5,
        });
        await setup();

        await submit();

        const askForPassword = importService.getImporter.mock.calls[0][1];
        expect(await askForPassword()).toBe("file-secret");
        expect(dialogService.open).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ ariaModal: true }),
        );
      });

      it("parses afresh on a retry after a failure", async () => {
        stageFile();
        await setup();
        importService.importImportResult.mockRejectedValueOnce(new Error("boom"));

        await submit();
        await submit();

        expect(importService.parse).toHaveBeenCalledTimes(2);
        const first = await importService.parse.mock.results[0].value;
        const second = await importService.parse.mock.results[1].value;
        expect(second).not.toBe(first);
      });

      it("reads a file only its organization's key opens, which credential parsing could not parse", async () => {
        stageFile(null);
        await setup();
        component().destinationControl.setValue("organization:a");
        fixture.detectChanges();

        await submit();

        expect(component().importLabel()).toBe("importVerb");
        expect(importService.getImporter).toHaveBeenCalledWith(
          "dashlanecsv",
          expect.any(Function),
          "a",
        );
        expect(importService.importImportResult).toHaveBeenCalled();
      });

      it("shows the account-mismatch toast, not the error dialog, when the key still can't open it", async () => {
        stageFile(null);
        await setup();
        importService.parse.mockRejectedValue(
          new ImportResultError("importEncKeyError", ImportResultErrorKey.AccountMismatch),
        );

        await submit();

        expect(toastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "error", message: "importAccountMismatchError" }),
        );
        expect(dialogService.open).not.toHaveBeenCalled();
        expect(importService.importImportResult).not.toHaveBeenCalled();
        expect(stagingService.current()).toBeDefined();
      });

      it("shows the error dialog, logging only the error name, when it can't be parsed", async () => {
        stageFile();
        await setup();
        importService.parse.mockRejectedValue(new TypeError('row 3: "Bank of Acme"'));

        await submit();

        expect(dialogService.open).toHaveBeenCalledWith(
          ImportErrorDialogComponent,
          expect.objectContaining({ data: expect.any(Error) }),
        );
        expect(logService.error).toHaveBeenCalledWith("Import failed:", "TypeError");
        expect(JSON.stringify(logService.error.mock.calls)).not.toContain("Bank of Acme");
      });

      it("stops with the format error when there is no importer for the format", async () => {
        stageFile();
        await setup();
        importService.getImporter.mockReturnValue(null);

        await submit();

        expect(importService.parse).not.toHaveBeenCalled();
        expect(dialogService.open).toHaveBeenCalled();
      });
    });

    it("shows the incorrect-password message when the SDK rejects a staged kdbx password", async () => {
      stagingService.stage({
        kind: "sdk",
        format: "keepasskdbx",
        file: new Uint8Array([1]),
        credentials: { kind: "password", password: "wrong" },
      });
      await setup();
      importService.importWithSdk.mockRejectedValue(new Error("raw"));
      importService.sdkErrorMessageKey.mockReturnValue("invalidFilePassword");

      await submit();

      const call = dialogService.open.mock.calls.find((c) => c[0] === ImportErrorDialogComponent);
      expect((call?.[1] as { data: Error }).data.message).toBe("kdbxPasswordInvalid");
    });

    it("does nothing when nothing is staged", async () => {
      await setup();

      await submit();

      expect(importService.importImportResult).not.toHaveBeenCalled();
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("keeps Import enabled once the destinations have loaded", async () => {
      stageParsed();
      await setup();

      expect(importButton().getAttribute("aria-disabled")).not.toBe("true");
    });
  });

  describe("Back and leaving", () => {
    it("drops the staged items and emits back", async () => {
      stageParsed();
      await setup();
      const backSpy = jest.fn();
      component().back.subscribe(backSpy);

      component().onBack();

      expect(stagingService.current()).toBeUndefined();
      expect(backSpy).toHaveBeenCalledTimes(1);
    });

    it("drops the staged items when the component is destroyed", async () => {
      stageParsed();
      await setup();

      fixture.destroy();

      expect(stagingService.current()).toBeUndefined();
    });
  });
});
