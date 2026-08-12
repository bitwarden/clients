import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultBatchBarService } from "@bitwarden/vault";

import { VaultListTableComponent } from "./vault-list-table.component";

function cipherView(overrides: Partial<CipherView> = {}): CipherView {
  const cipher = new CipherView();
  cipher.id = "cipher-1";
  cipher.name = "Test";
  cipher.edit = true;
  cipher.favorite = false;
  Object.assign(cipher, overrides);
  return cipher;
}

describe("VaultListTableComponent", () => {
  let fixture: ComponentFixture<VaultListTableComponent<CipherViewLike>>;
  let component: VaultListTableComponent<CipherViewLike>;

  async function setup(extraProviders: unknown[] = []) {
    await TestBed.configureTestingModule({
      imports: [VaultListTableComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        { provide: RestrictedItemTypesService, useValue: { restricted$: of([]) } },
        ...extraProviders,
      ],
    })
      .overrideComponent(VaultListTableComponent, {
        set: { imports: [I18nPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VaultListTableComponent) as ComponentFixture<
      VaultListTableComponent<CipherViewLike>
    >;
    component = fixture.componentInstance;
    fixture.componentRef.setInput("ciphers", []);
  }

  beforeEach(async () => {
    await setup();
  });

  function rowAction(id: string) {
    const action = component["rowActions"]().find((a) => a.id === id);
    if (!action) {
      throw new Error(`No row action with id "${id}"`);
    }
    return action;
  }

  describe("initialFilterValues", () => {
    it("returns an empty object when initialSearchText is not set", () => {
      expect(component["initialFilterValues"]()).toEqual({});
    });

    it("returns an empty object when initialSearchText is an empty string", () => {
      fixture.componentRef.setInput("initialSearchText", "");
      expect(component["initialFilterValues"]()).toEqual({});
    });

    it("returns a search entry when initialSearchText has a value", () => {
      fixture.componentRef.setInput("initialSearchText", "amazon");
      expect(component["initialFilterValues"]()).toEqual({ search: "amazon" });
    });
  });

  describe("itemAction", () => {
    it("produces a viewCipher event for any cipher", () => {
      const cipher = cipherView();
      expect(component["itemAction"](cipher)).toEqual({ type: "viewCipher", item: cipher });
    });
  });

  describe("rowActions", () => {
    describe("edit", () => {
      it("shows when item.edit is true", () => {
        expect(rowAction("edit").show!(cipherView({ edit: true }))).toBe(true);
      });

      it("hides when item.edit is false", () => {
        expect(rowAction("edit").show!(cipherView({ edit: false }))).toBe(false);
      });

      it("emits editCipher with the item", () => {
        const cipher = cipherView();
        expect(rowAction("edit").event(cipher)).toEqual({ type: "editCipher", item: cipher });
      });
    });

    describe("attachments", () => {
      it("shows for a personal cipher (no organizationId)", () => {
        expect(rowAction("attachments").show!(cipherView({ organizationId: undefined }))).toBe(
          true,
        );
      });

      it("shows for an org cipher when item.edit is true", () => {
        expect(
          rowAction("attachments").show!(
            cipherView({ edit: true, organizationId: "org-1" as never }),
          ),
        ).toBe(true);
      });

      it("hides for an org cipher when item.edit is false and no attachments", () => {
        expect(
          rowAction("attachments").show!(
            cipherView({ edit: false, organizationId: "org-1" as never }),
          ),
        ).toBe(false);
      });

      it("shows for a non-editable org cipher that already has attachments", () => {
        const attachment = new AttachmentView();
        expect(
          rowAction("attachments").show!(
            cipherView({
              edit: false,
              organizationId: "org-1" as never,
              attachments: [attachment],
            }),
          ),
        ).toBe(true);
      });

      it("hides for an archived cipher when userCanArchive is false", () => {
        fixture.componentRef.setInput("userCanArchive", false);
        expect(rowAction("attachments").show!(cipherView({ archivedDate: new Date() }))).toBe(
          false,
        );
      });

      it("shows for an archived cipher when userCanArchive is true", () => {
        fixture.componentRef.setInput("userCanArchive", true);
        expect(rowAction("attachments").show!(cipherView({ archivedDate: new Date() }))).toBe(true);
      });

      it("emits viewAttachments with the item", () => {
        const cipher = cipherView();
        expect(rowAction("attachments").event(cipher)).toEqual({
          type: "viewAttachments",
          item: cipher,
        });
      });
    });

    describe("clone", () => {
      it("shows for personal ciphers regardless of collections", () => {
        expect(rowAction("clone").show!(cipherView({ organizationId: undefined }))).toBe(true);
      });

      it("shows for org ciphers when at least one of their collections has manage:true", () => {
        const col = { id: "col-1", manage: true } as unknown as CollectionView;
        fixture.componentRef.setInput("collections", [col]);
        const cipher = cipherView({
          organizationId: "org-1" as never,
          collectionIds: ["col-1"] as never,
        });
        expect(rowAction("clone").show!(cipher)).toBe(true);
      });

      it("hides for org ciphers when no collection has manage:true", () => {
        const col = { id: "col-1", manage: false } as unknown as CollectionView;
        fixture.componentRef.setInput("collections", [col]);
        const cipher = cipherView({
          organizationId: "org-1" as never,
          collectionIds: ["col-1"] as never,
        });
        expect(rowAction("clone").show!(cipher)).toBe(false);
      });

      it("hides for org ciphers belonging to no collections", () => {
        fixture.componentRef.setInput("collections", []);
        const cipher = cipherView({ organizationId: "org-1" as never, collectionIds: [] });
        expect(rowAction("clone").show!(cipher)).toBe(false);
      });

      it("emits clone with the item", () => {
        const cipher = cipherView();
        expect(rowAction("clone").event(cipher)).toEqual({ type: "clone", item: cipher });
      });
    });

    describe("addToSharedFolder", () => {
      it("shows when item.edit is true and item has an organizationId", () => {
        expect(
          rowAction("addToSharedFolder").show!(
            cipherView({ edit: true, organizationId: "org-1" as never }),
          ),
        ).toBe(true);
      });

      it("hides when item.edit is false", () => {
        expect(
          rowAction("addToSharedFolder").show!(
            cipherView({ edit: false, organizationId: "org-1" as never }),
          ),
        ).toBe(false);
      });

      it("hides for personal ciphers with no organizationId", () => {
        expect(
          rowAction("addToSharedFolder").show!(
            cipherView({ edit: true, organizationId: undefined }),
          ),
        ).toBe(false);
      });

      it("emits assignToCollections with the item in a single-element array", () => {
        const cipher = cipherView();
        expect(rowAction("addToSharedFolder").event(cipher)).toEqual({
          type: "assignToCollections",
          items: [cipher],
        });
      });
    });

    describe("addFavorite / removeFavorite", () => {
      it("addFavorite shows when item is not a favorite", () => {
        expect(rowAction("addFavorite").show!(cipherView({ favorite: false }))).toBe(true);
      });

      it("addFavorite hides when item is already a favorite", () => {
        expect(rowAction("addFavorite").show!(cipherView({ favorite: true }))).toBe(false);
      });

      it("removeFavorite shows when item is a favorite", () => {
        expect(rowAction("removeFavorite").show!(cipherView({ favorite: true }))).toBe(true);
      });

      it("removeFavorite hides when item is not a favorite", () => {
        expect(rowAction("removeFavorite").show!(cipherView({ favorite: false }))).toBe(false);
      });

      it("both emit toggleFavorite with the item", () => {
        const cipher = cipherView();
        expect(rowAction("addFavorite").event(cipher)).toEqual({
          type: "toggleFavorite",
          item: cipher,
        });
        expect(rowAction("removeFavorite").event(cipher)).toEqual({
          type: "toggleFavorite",
          item: cipher,
        });
      });
    });

    describe("archive", () => {
      it("shows when userCanArchive is true and item is not deleted", () => {
        fixture.componentRef.setInput("userCanArchive", true);
        expect(rowAction("archive").show!(cipherView({ deletedDate: undefined }))).toBe(true);
      });

      it("hides when userCanArchive is false", () => {
        fixture.componentRef.setInput("userCanArchive", false);
        expect(rowAction("archive").show!(cipherView())).toBe(false);
      });

      it("hides when item is deleted even if userCanArchive is true", () => {
        fixture.componentRef.setInput("userCanArchive", true);
        expect(rowAction("archive").show!(cipherView({ deletedDate: new Date() }))).toBe(false);
      });

      it("emits archive with the item in a single-element array", () => {
        const cipher = cipherView();
        expect(rowAction("archive").event(cipher)).toEqual({ type: "archive", items: [cipher] });
      });
    });

    describe("unarchive", () => {
      it("shows when userCanArchive is true and item is archived", () => {
        fixture.componentRef.setInput("userCanArchive", true);
        expect(rowAction("unarchive").show!(cipherView({ archivedDate: new Date() }))).toBe(true);
      });

      it("hides when userCanArchive is false even if item is archived", () => {
        fixture.componentRef.setInput("userCanArchive", false);
        expect(rowAction("unarchive").show!(cipherView({ archivedDate: new Date() }))).toBe(false);
      });

      it("hides when item is not archived", () => {
        fixture.componentRef.setInput("userCanArchive", true);
        expect(rowAction("unarchive").show!(cipherView({ archivedDate: undefined }))).toBe(false);
      });

      it("emits unarchive with the item in a single-element array", () => {
        const cipher = cipherView();
        expect(rowAction("unarchive").event(cipher)).toEqual({
          type: "unarchive",
          items: [cipher],
        });
      });
    });

    describe("delete", () => {
      it("shows when item.edit is true", () => {
        expect(rowAction("delete").show!(cipherView({ edit: true }))).toBe(true);
      });

      it("hides when item.edit is false", () => {
        expect(rowAction("delete").show!(cipherView({ edit: false }))).toBe(false);
      });

      it("wraps the item as a VaultItem ({ cipher }) in the delete event", () => {
        const cipher = cipherView();
        expect(rowAction("delete").event(cipher)).toEqual({
          type: "delete",
          items: [{ cipher }],
        });
      });
    });

    describe("restore", () => {
      it("shows when item is deleted and item.edit is true", () => {
        expect(
          rowAction("restore").show!(cipherView({ deletedDate: new Date(), edit: true })),
        ).toBe(true);
      });

      it("hides when item is not deleted", () => {
        expect(rowAction("restore").show!(cipherView({ deletedDate: undefined, edit: true }))).toBe(
          false,
        );
      });

      it("hides when item.edit is false", () => {
        expect(
          rowAction("restore").show!(cipherView({ deletedDate: new Date(), edit: false })),
        ).toBe(false);
      });

      it("emits restore with the item in a single-element array", () => {
        const cipher = cipherView();
        expect(rowAction("restore").event(cipher)).toEqual({ type: "restore", items: [cipher] });
      });
    });
  });

  describe("handleSelectionChange without VaultBatchBarService", () => {
    it("does not throw when no service is provided", () => {
      expect(() => component["handleSelectionChange"]([cipherView()])).not.toThrow();
    });
  });

  describe("handleSelectionChange with VaultBatchBarService", () => {
    let mockSelection: { clear: jest.Mock; select: jest.Mock };

    beforeEach(async () => {
      mockSelection = { clear: jest.fn(), select: jest.fn() };
      TestBed.resetTestingModule();
      await setup([
        {
          provide: VaultBatchBarService,
          useValue: { selection: mockSelection },
        },
      ]);
    });

    it("clears the selection then re-selects each item wrapped as { cipher }", () => {
      const ciphers = [cipherView({ id: "a" }), cipherView({ id: "b" })];
      component["handleSelectionChange"](ciphers);

      expect(mockSelection.clear).toHaveBeenCalled();
      expect(mockSelection.select).toHaveBeenCalledWith(
        { cipher: ciphers[0] },
        { cipher: ciphers[1] },
      );
    });

    it("clears to empty when called with an empty list", () => {
      component["handleSelectionChange"]([]);

      expect(mockSelection.clear).toHaveBeenCalled();
      expect(mockSelection.select).toHaveBeenCalledWith();
    });
  });

  describe("premium callout", () => {
    it("renders when showPremiumCallout is true", () => {
      fixture.componentRef.setInput("showPremiumCallout", true);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("bit-callout"))).not.toBeNull();
    });

    it("is absent when showPremiumCallout is false", () => {
      fixture.componentRef.setInput("showPremiumCallout", false);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("bit-callout"))).toBeNull();
    });
  });

  describe("add cipher button", () => {
    it("renders vault-new-cipher-menu when showAddCipherBtn is true", () => {
      fixture.componentRef.setInput("showAddCipherBtn", true);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("vault-new-cipher-menu"))).not.toBeNull();
    });

    it("is absent when showAddCipherBtn is false", () => {
      fixture.componentRef.setInput("showAddCipherBtn", false);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("vault-new-cipher-menu"))).toBeNull();
    });
  });
});
