import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { EMPTY, of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  CipherRowMenuService,
  VaultBatchBarService,
  VaultCopyButtonsService,
} from "@bitwarden/vault";

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
  let mockGetRowActions: jest.Mock;

  async function setup(extraProviders: unknown[] = []) {
    mockGetRowActions = jest.fn(() => []);

    await TestBed.configureTestingModule({
      imports: [VaultListTableComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        { provide: CipherRowMenuService, useValue: { getRowActions: mockGetRowActions } },
        {
          provide: VaultCopyButtonsService,
          useValue: { showQuickCopyActions$: of(false) },
        },
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

  describe("itemAction", () => {
    it("emits a viewCipher event for any cipher", () => {
      const cipher = cipherView();
      const emitted: unknown[] = [];
      component.onEvent.subscribe((e) => emitted.push(e));
      component["itemAction"](cipher);
      expect(emitted).toEqual([{ type: "viewCipher", item: cipher }]);
    });
  });

  describe("copyPresentation", () => {
    // The outer `beforeEach` already stood a component up, so these cases have to tear the module
    // down before re-configuring it with their own setting value.
    const setupWith = async (settingEnabled: boolean) => {
      TestBed.resetTestingModule();
      await setup([
        {
          provide: VaultCopyButtonsService,
          useValue: { showQuickCopyActions$: of(settingEnabled) },
        },
      ]);
    };

    it("expands the copy actions when the setting is on", async () => {
      await setupWith(true);

      expect(component["copyPresentation"]()).toBe("expanded");
    });

    it("stays collapsed when the setting is off", async () => {
      await setupWith(false);

      expect(component["copyPresentation"]()).toBe("collapsed");
    });
  });

  describe("rowActions", () => {
    it("passes the unscoped allCollections input to CipherRowMenuService.getRowActions", () => {
      const scoped = { id: "col-1" } as CollectionView;
      const unscoped = { id: "col-2" } as CollectionView;
      fixture.componentRef.setInput("collections", [scoped]);
      fixture.componentRef.setInput("allCollections", [scoped, unscoped]);

      component["rowActions"]();

      expect(mockGetRowActions).toHaveBeenCalledWith(
        [scoped, unscoped],
        expect.objectContaining({
          edit: expect.any(Function),
          clone: expect.any(Function),
          assignToCollections: expect.any(Function),
        }),
      );
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
          useValue: { selection: mockSelection, cleared$: EMPTY },
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

  describe("import button", () => {
    it("emits onImport when clicked", () => {
      const emit = jest.fn();
      component.onImport.subscribe(emit);
      fixture.componentRef.setInput("showAddCipherBtn", true);
      fixture.detectChanges();

      fixture.debugElement
        .query(By.css("#vault-list-table_button_import"))
        .triggerEventHandler("click", {});

      expect(emit).toHaveBeenCalled();
    });
  });
});
