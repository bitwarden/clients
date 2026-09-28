import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { RouterLink, RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import {
  CollectionAccessSelectionView,
  CollectionAdminView,
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  IconModule,
  ScrollLayoutDirective,
  TableModule,
  TooltipDirective,
} from "@bitwarden/components";
import { ShareLinkMenuItemDirective } from "@bitwarden/tools-share";
import {
  CopyCipherFieldDirective,
  VaultItemCopyActionsComponent,
  Vfo1I18nPipe,
  Vfo1IconPipe,
  Vfo1TerminologyService,
} from "@bitwarden/vault";

import { CollectionNameBadgeComponent } from "../../../admin-console/organizations/collections";
import { GroupNameBadgeComponent } from "../../../admin-console/organizations/collections/group-badge/group-name-badge.component";
import { GroupView } from "../../../admin-console/organizations/core";
import { SharedModule } from "../../../shared/shared.module";
import { OrganizationBadgeModule } from "../../individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../../individual-vault/pipes/pipes.module";

import { VaultCollectionRowComponent } from "./vault-collection-row.component";
import { VaultItemsModule } from "./vault-items.module";

const collectionId = "bdc4ef23-1116-477e-ae73-247854af58cb" as CollectionId;
const orgId = "c5e9654f-6cc5-44c4-8e09-3d323522668c" as OrganizationId;

describe("VaultCollectionRowComponent", () => {
  let component: VaultCollectionRowComponent<CipherViewLike>;
  let fixture: ComponentFixture<VaultCollectionRowComponent<CipherViewLike>>;

  function makeCollection(overrides: Partial<CollectionView> = {}) {
    const collection = new CollectionView({
      id: collectionId,
      organizationId: orgId,
      name: "Collection 1",
    });
    collection.manage = true;
    collection.type = CollectionTypes.SharedCollection;
    return Object.assign(collection, overrides);
  }

  /** The name cell's warning badge, present only when decryption failed. */
  function decryptionFailureBadge(): HTMLElement | null {
    return fixture.nativeElement.querySelector("span[bitBadge]");
  }

  function navigationLink(): HTMLElement | null {
    return fixture.nativeElement.querySelector("a[bitLink], button[bitLink]");
  }

  /** The "Edit info" entry of the row's options menu, which opens the rename dialog. */
  function editMenuItem(): HTMLElement | null {
    fixture.nativeElement.querySelector("button[bitIconButton]")?.click();
    fixture.detectChanges();
    return document.querySelector("button[bitMenuItem]");
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultItemsModule, RouterModule.forRoot([])],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: ConfigService,
          useValue: {
            // Only the failure treatment is enabled here; every other flag stays off.
            getFeatureFlag$: jest.fn((flag: FeatureFlag) =>
              of(flag === FeatureFlag.CollectionsDecryptListFailures),
            ),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultCollectionRowComponent);
    component = fixture.componentInstance;
    component.organizations = [{ id: orgId } as Organization];
    component.disabled = false;
    component.canEditCollection = true;
  });

  describe("when the collection decrypted successfully", () => {
    beforeEach(() => {
      component.collection = makeCollection();
      fixture.detectChanges();
    });

    it("renders the collection name as a navigation link", () => {
      expect(navigationLink()?.textContent).toContain("Collection 1");
    });

    it("does not render a decryption failure warning", () => {
      expect(decryptionFailureBadge()).toBeNull();
    });
  });

  // The failure treatment ships with the SDK path that produces the failures, so an unflagged
  // client keeps rendering the placeholder name as an ordinary link.
  describe("when the collection name failed to decrypt but the flag is off", () => {
    beforeEach(() => {
      const configService = TestBed.inject(ConfigService);
      (configService.getFeatureFlag$ as jest.Mock).mockReturnValue(of(false));

      fixture = TestBed.createComponent(VaultCollectionRowComponent);
      component = fixture.componentInstance;
      component.organizations = [{ id: orgId } as Organization];
      component.disabled = false;
      component.canEditCollection = true;
      component.collection = makeCollection({ decryptionFailure: true, name: "[error]" });
      fixture.detectChanges();
    });

    it("renders the name as a link with no warning", () => {
      expect(decryptionFailureBadge()).toBeNull();
      expect(navigationLink()?.textContent).toContain("[error]");
    });
  });

  describe("when the collection name failed to decrypt", () => {
    beforeEach(() => {
      component.collection = makeCollection({ decryptionFailure: true });
      fixture.detectChanges();
    });

    it("labels the row with a warning in place of the name", () => {
      expect(decryptionFailureBadge()?.textContent).toContain("errorCannotDecrypt");
    });

    // Only the name is encrypted, so the collection's items still decrypt and must stay reachable.
    it("keeps the link to the collection's items", () => {
      const link = fixture.debugElement.query(By.directive(RouterLink));

      expect(link.injector.get(RouterLink).queryParams).toEqual({
        collectionId,
        sharedFolderId: null,
      });
      expect(navigationLink()?.getAttribute("title")).toBe("cannotDecryptCollectionName");
    });

    it("renders the warning as the link's label rather than a second click target", () => {
      expect(navigationLink()!.contains(decryptionFailureBadge())).toBe(true);
      expect(decryptionFailureBadge()?.getAttribute("role")).toBeNull();
    });

    // The rename remedy lives in the row's options menu, which is already gated on edit
    // permission; the dialog itself enforces who may change the name.
    it("keeps the edit option available so the user can rename and re-encrypt it", () => {
      const emitted = jest.fn();
      component.onEvent.subscribe(emitted);

      editMenuItem()!.click();

      expect(emitted).toHaveBeenCalledWith({
        type: "editCollection",
        item: component.collection,
        readonly: false,
      });
    });
  });
});

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<table>
    <tbody>
      <tr
        appVaultCollectionRow
        [collection]="collection"
        [groups]="groups"
        [showGroups]="true"
        [organizations]="[]"
      ></tr>
    </tbody>
  </table>`,
  standalone: false,
})
class HostComponent {
  collection!: CollectionView;
  groups: GroupView[] = [];
}

describe("VaultCollectionRowComponent group badges", () => {
  let fixture: ComponentFixture<HostComponent>;

  const group = (id: string, name: string) => new GroupView({ id, organizationId: "org-id", name });

  async function setup(collectionGroupIds: string[], groups: GroupView[]) {
    const i18nService = mock<I18nService>();
    i18nService.collator = new Intl.Collator("en");
    i18nService.t.mockImplementation((key) => key);

    const vfo1TerminologyService = mock<Vfo1TerminologyService>();
    (vfo1TerminologyService as any).enabled = () => false;
    vfo1TerminologyService.iconClass.mockImplementation((icon) => icon);

    await TestBed.configureTestingModule({
      declarations: [HostComponent, VaultCollectionRowComponent],
      // Mirrors VaultItemsModule's imports, which is where this row is declared in production.
      imports: [
        CommonModule,
        RouterModule.forRoot([]),
        ScrollingModule,
        SharedModule,
        TableModule,
        TooltipDirective,
        OrganizationBadgeModule,
        CollectionNameBadgeComponent,
        GroupNameBadgeComponent,
        PipesModule,
        CopyCipherFieldDirective,
        VaultItemCopyActionsComponent,
        ScrollLayoutDirective,
        PremiumBadgeComponent,
        IconModule,
        Vfo1I18nPipe,
        Vfo1IconPipe,
        ShareLinkMenuItemDirective,
      ],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: Vfo1TerminologyService, useValue: vfo1TerminologyService },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    }).compileComponents();

    const collection = new CollectionAdminView({
      id: "collection-id" as CollectionId,
      organizationId: "org-id" as OrganizationId,
      name: "Shared Collection",
    });
    collection.groups = collectionGroupIds.map((id) => ({ id }) as CollectionAccessSelectionView);

    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.collection = collection;
    fixture.componentInstance.groups = groups;
    fixture.detectChanges();
  }

  const renderedBadges = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll(
        "app-group-badge span[bitBadge]",
      ) as NodeListOf<HTMLElement>,
    )
      .map((badge) => badge.textContent?.trim())
      .filter((text): text is string => !!text);

  it("renders the group name badges for a collection row", async () => {
    await setup(
      ["group-1", "group-2"],
      [group("group-1", "Engineering"), group("group-2", "Accounting")],
    );

    expect(fixture.nativeElement.querySelector("app-group-badge")).not.toBeNull();
    expect(renderedBadges()).toEqual(["Accounting", "Engineering"]);
  });

  it("renders no badges when the collection has no groups", async () => {
    await setup([], [group("group-1", "Engineering")]);

    expect(renderedBadges()).toEqual([]);
  });
});
