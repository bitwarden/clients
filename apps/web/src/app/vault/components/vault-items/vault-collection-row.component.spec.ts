import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { of } from "rxjs";

import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

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
    return fixture.nativeElement.querySelector("button[bitLink]");
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultItemsModule, RouterModule.forRoot([])],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: jest.fn().mockReturnValue(of(false)) },
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

  describe("when the collection name failed to decrypt", () => {
    beforeEach(() => {
      component.collection = makeCollection({ decryptionFailure: true });
      fixture.detectChanges();
    });

    it("replaces the navigation link with a warning, since there is no name to show", () => {
      expect(navigationLink()).toBeNull();
      expect(decryptionFailureBadge()?.textContent).toContain("errorCannotDecrypt");
    });

    it("offers the rename remedy when the user may edit the name", () => {
      const badge = decryptionFailureBadge();

      expect(badge?.getAttribute("role")).toBe("button");
      expect(badge?.getAttribute("title")).toBe("cannotDecryptCollectionNameClickToRename");
    });

    it("emits editCollection so the user can save a new name and re-encrypt it", () => {
      const emitted = jest.fn();
      component.onEvent.subscribe(emitted);

      decryptionFailureBadge()!.click();

      expect(emitted).toHaveBeenCalledWith({
        type: "editCollection",
        item: component.collection,
        readonly: false,
      });
    });
  });

  describe("when a failed collection cannot be renamed", () => {
    it("shows the warning without the rename affordance when the user lacks edit permission", () => {
      component.canEditCollection = false;
      component.collection = makeCollection({ decryptionFailure: true, manage: false });
      fixture.detectChanges();

      const badge = decryptionFailureBadge();

      expect(badge?.textContent).toContain("errorCannotDecrypt");
      expect(badge?.getAttribute("role")).toBeNull();
      expect(badge?.getAttribute("title")).toBe("cannotDecryptCollectionName");
    });

    // canEditName keeps offboarded default-user collections un-renamable so the server cannot
    // ask the client to encrypt arbitrary data. That restriction has to survive a decryption
    // failure too.
    it("does not offer a rename for an offboarded default user collection", () => {
      component.collection = makeCollection({
        decryptionFailure: true,
        type: CollectionTypes.DefaultUserCollection,
        defaultUserCollectionEmail: "offboarded@example.com",
      });
      fixture.detectChanges();

      expect(decryptionFailureBadge()?.getAttribute("role")).toBeNull();
    });
  });
});
