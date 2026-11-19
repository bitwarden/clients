import { ChangeDetectionStrategy, Component, input, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SelectItemView } from "@bitwarden/components";

import { Vfo1TerminologyService } from "../../../services/vfo1-terminology.service";
import {
  SHARED_FOLDER_FIELD_DECORATION,
  SharedFolderFieldDecoration,
  SharedFolderFieldFolder,
  SharedFolderOptionDecorator,
} from "../../../tokens/shared-folder-field-decoration.token";
import { CipherFormConfig } from "../../abstractions/cipher-form-config.service";
import { CipherFormContainer } from "../../cipher-form-container";

import { ItemDetailsSectionComponent } from "./item-details-section.component";

@Component({
  selector: "vault-test-shared-folder-hint",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ names() }}`,
})
class TestHintComponent {
  readonly folders = input.required<SharedFolderFieldFolder[]>();
  protected names = () =>
    this.folders()
      .map((f) => f.name)
      .join(",");
}

function collection(id: string, name: string, readOnly = false): CollectionView {
  const view = new CollectionView({
    id: id as CollectionId,
    name,
    organizationId: "org1" as OrganizationId,
  });
  view.type = CollectionTypes.SharedCollection;
  view.assigned = true;
  view.readOnly = readOnly;
  return view;
}

describe("ItemDetailsSectionComponent shared folders field decoration", () => {
  let fixture: ComponentFixture<ItemDetailsSectionComponent>;
  let component: ItemDetailsSectionComponent;
  let decoration: MockProxy<SharedFolderFieldDecoration> | null;
  let getInitialCipherView: jest.Mock<CipherView | null, []>;
  let container: MockProxy<CipherFormContainer>;

  const org = { id: "org1", usePam: true } as Organization;
  const decorate: SharedFolderOptionDecorator = (c) =>
    c.id === "col2"
      ? {
          icon: "bwi-lock-encrypted",
          iconTile: { icon: "bwi-lock-encrypted", variant: "brand" },
        }
      : undefined;

  function configure(provided: boolean) {
    decoration = provided ? mock<SharedFolderFieldDecoration>({ hint: TestHintComponent }) : null;
    decoration?.decorator$.mockReturnValue(of(decorate));
    getInitialCipherView = jest.fn<CipherView | null, []>(() => null);
    container = mock<CipherFormContainer>({
      getInitialCipherView,
      initializedWithCachedCipher: jest.fn(() => false),
    });

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);
    i18nService.collator = {
      compare: (a: string, b: string) => a.localeCompare(b),
    } as Intl.Collator;
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));
    const policyService = mock<PolicyService>();
    policyService.policiesByType$.mockReturnValue(of([]));
    const avatarService = mock<AvatarService>();
    avatarService.getUserAvatarColor$.mockReturnValue(of("#175ddc"));

    TestBed.configureTestingModule({
      imports: [ItemDetailsSectionComponent],
      providers: [
        { provide: CipherFormContainer, useValue: container },
        { provide: I18nService, useValue: i18nService },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "user", email: "a@b.c" }) },
        },
        { provide: AvatarService, useValue: avatarService },
        { provide: ConfigService, useValue: configService },
        { provide: PolicyService, useValue: policyService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: Vfo1TerminologyService, useFactory: () => ({ enabled: signal(false) }) },
        ...(provided ? [{ provide: SHARED_FOLDER_FIELD_DECORATION, useValue: decoration }] : []),
      ],
    });

    fixture = TestBed.createComponent(ItemDetailsSectionComponent);
    component = fixture.componentInstance;
    component.config = {
      mode: "add",
      organizationDataOwnershipDisabled: false,
      organizations: [org],
      collections: [collection("col1", "Plain"), collection("col2", "Controlled")],
      folders: [],
    } as CipherFormConfig;
  }

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function options(): SelectItemView[] {
    return component["collectionOptions"];
  }

  function hint(): HTMLElement | null {
    return fixture.nativeElement.querySelector("[data-testid='shared-folder-field-hint']");
  }

  describe("when a decoration is provided", () => {
    beforeEach(() => configure(true));

    it("asks for the selected organization's decorator", async () => {
      await render();

      expect(decoration!.decorator$).toHaveBeenCalledWith(org);
    });

    it("adds the decoration to the options it applies to, and leaves the rest plain", async () => {
      await render();

      expect(options()).toEqual([
        { id: "col1", name: "Plain", listName: "Plain", labelName: "Plain" },
        {
          id: "col2",
          name: "Controlled",
          listName: "Controlled",
          labelName: "Controlled",
          icon: "bwi-lock-encrypted",
          iconTile: { icon: "bwi-lock-encrypted", variant: "brand" },
        },
      ]);
    });

    it("keeps the selected value's id, so the saved shared folders are unaffected", async () => {
      await render();

      component.itemDetailsForm.controls.collectionIds.setValue([options()[1]]);

      const patch = jest.mocked(container.patchCipher).mock.calls.at(-1)![0];
      expect(patch({} as CipherView).collectionIds).toEqual(["col2"]);
    });

    it("leaves every option plain and renders no hint when the decorator is null", async () => {
      decoration!.decorator$.mockReturnValue(of(null));
      await render();

      expect(hint()).toBeNull();

      expect(options().map((o) => [o.listName, o.labelName, o.icon])).toEqual([
        ["Plain", "Plain", undefined],
        ["Controlled", "Controlled", undefined],
      ]);
    });

    it("hands the hint the selected shared folders as the selection changes", async () => {
      await render();
      expect(hint()!.textContent!.trim()).toBe("");

      component.itemDetailsForm.controls.collectionIds.setValue([options()[1]]);
      fixture.detectChanges();
      expect(hint()!.textContent!.trim()).toBe("Controlled");

      component.itemDetailsForm.controls.collectionIds.setValue(options());
      fixture.detectChanges();
      expect(hint()!.textContent!.trim()).toBe("Plain,Controlled");

      component.itemDetailsForm.controls.collectionIds.setValue([]);
      fixture.detectChanges();
      expect(hint()!.textContent!.trim()).toBe("");
    });

    it("includes the item's read-only shared folders on edit", async () => {
      const cipher = {
        name: "item",
        organizationId: "org1",
        collectionIds: ["col1", "col2"],
        favorite: false,
      } as CipherView;
      component.config.mode = "edit";
      component.config.collections = [
        collection("col1", "Plain"),
        collection("col2", "Locked", true),
      ];
      getInitialCipherView.mockReturnValue(cipher);
      fixture.componentRef.setInput("originalCipherView", cipher);

      await render();

      expect(hint()!.textContent!.trim()).toBe("Plain,Locked");
    });

    it("names each folder in the hint as its option shows it, including the member's own collection", async () => {
      const myItems = collection("col3", "stored name");
      myItems.type = CollectionTypes.DefaultUserCollection;
      component.config.collections = [myItems];
      await render();

      component.itemDetailsForm.controls.collectionIds.setValue(options());
      fixture.detectChanges();

      expect(options()[0].labelName).toBe("myItemsV2");
      expect(hint()!.textContent!.trim()).toBe("myItemsV2");
    });
  });

  describe("when no decoration is provided", () => {
    beforeEach(() => configure(false));

    it("renders no hint and plain options", async () => {
      await render();

      expect(hint()).toBeNull();
      expect(options().map((o) => [o.listName, o.labelName, o.icon])).toEqual([
        ["Plain", "Plain", undefined],
        ["Controlled", "Controlled", undefined],
      ]);
    });
  });
});
