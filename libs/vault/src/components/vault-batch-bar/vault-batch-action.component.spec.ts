import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { VaultBatchBarService } from "../../services/vault-batch-bar.service";

import { VaultBatchActionComponent } from "./vault-batch-action.component";

// JSDOM does not implement ResizeObserver — stub so BulkActionsBarComponent can construct.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

describe("VaultBatchActionComponent", () => {
  let component: VaultBatchActionComponent;
  let fixture: ComponentFixture<VaultBatchActionComponent>;

  const canAddToFolder = signal(false);
  const canAssignToCollections = signal(false);
  const canArchive = signal(false);
  const canUnarchive = signal(false);
  const canRestore = signal(false);
  const canDelete = signal(false);
  const inTrash = signal(false);
  const selectedCount = signal(0);

  const clearSpy = jest.fn();
  const bulkMoveToFolderSpy = jest.fn();
  const bulkAssignToCollectionsSpy = jest.fn();
  const bulkArchiveSpy = jest.fn();
  const bulkUnarchiveSpy = jest.fn();
  const bulkRestoreSpy = jest.fn();
  const bulkDeleteSpy = jest.fn();

  beforeEach(async () => {
    canAddToFolder.set(false);
    canAssignToCollections.set(false);
    canArchive.set(false);
    canUnarchive.set(false);
    canRestore.set(false);
    canDelete.set(false);
    inTrash.set(false);
    selectedCount.set(0);
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [VaultBatchActionComponent, NoopAnimationsModule],
      providers: [
        {
          provide: VaultBatchBarService,
          useValue: {
            selectedCount,
            canAddToFolder,
            canAssignToCollections,
            canArchive,
            canUnarchive,
            canRestore,
            canDelete,
            inTrash,
            selection: { clear: clearSpy },
            bulkMoveToFolder: bulkMoveToFolderSpy,
            bulkAssignToCollections: bulkAssignToCollectionsSpy,
            bulkArchive: bulkArchiveSpy,
            bulkUnarchive: bulkUnarchiveSpy,
            bulkRestore: bulkRestoreSpy,
            bulkDelete: bulkDeleteSpy,
          },
        },
        { provide: I18nService, useValue: { t: (key: string) => `translated-${key}` } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultBatchActionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("primaryActions", () => {
    it("is empty when no signals are true", () => {
      expect(component["primaryActions"]()).toHaveLength(0);
    });

    it("includes all actions when total equals threshold (3)", () => {
      canAddToFolder.set(true);
      canArchive.set(true);
      canDelete.set(true);

      expect(component["primaryActions"]()).toHaveLength(3);
      expect(component["overflowActions"]()).toHaveLength(0);
    });

    it("caps at 2 when total exceeds threshold (3)", () => {
      canAddToFolder.set(true);
      canAssignToCollections.set(true);
      canArchive.set(true);
      canDelete.set(true);

      expect(component["primaryActions"]()).toHaveLength(2);
    });

    it("contains all actions when exactly 1 is enabled", () => {
      canDelete.set(true);

      expect(component["primaryActions"]()).toHaveLength(1);
      expect(component["overflowActions"]()).toHaveLength(0);
    });

    it("contains all actions when exactly 2 are enabled", () => {
      canAddToFolder.set(true);
      canDelete.set(true);

      expect(component["primaryActions"]()).toHaveLength(2);
      expect(component["overflowActions"]()).toHaveLength(0);
    });
  });

  describe("overflowActions", () => {
    it("is empty when total is at or below the threshold (3)", () => {
      canAddToFolder.set(true);
      canDelete.set(true);

      expect(component["overflowActions"]()).toHaveLength(0);
    });

    it("contains remaining actions when total is 4", () => {
      canAddToFolder.set(true);
      canAssignToCollections.set(true);
      canArchive.set(true);
      canDelete.set(true);

      expect(component["overflowActions"]()).toHaveLength(2);
    });

    it("contains remaining actions when all 6 actions are enabled", () => {
      canAddToFolder.set(true);
      canAssignToCollections.set(true);
      canArchive.set(true);
      canUnarchive.set(true);
      canRestore.set(true);
      canDelete.set(true);

      expect(component["primaryActions"]()).toHaveLength(2);
      expect(component["overflowActions"]()).toHaveLength(4);
    });
  });

  describe("visibleActions labels and icons", () => {
    it("assigns the correct icon and translated label for move-to-folder", () => {
      canAddToFolder.set(true);

      const [action] = component["primaryActions"]();
      expect(action.icon).toBe("bwi-folder");
      expect(action.label).toBe("translated-addToFolder");
    });

    it("assigns the correct icon and translated label for assign-to-collections", () => {
      canAssignToCollections.set(true);

      const [action] = component["primaryActions"]();
      expect(action.icon).toBe("bwi-collection");
      expect(action.label).toBe("translated-assignToCollections");
    });

    it("assigns the correct icon and translated label for archive", () => {
      canArchive.set(true);

      const [action] = component["primaryActions"]();
      expect(action.icon).toBe("bwi-archive");
      expect(action.label).toBe("translated-archiveVerb");
    });

    it("assigns the correct icon and translated label for unarchive", () => {
      canUnarchive.set(true);

      const [action] = component["primaryActions"]();
      expect(action.icon).toBe("bwi-unarchive");
      expect(action.label).toBe("translated-unArchive");
    });

    it("assigns the correct icon and translated label for restore", () => {
      canRestore.set(true);

      const [action] = component["primaryActions"]();
      expect(action.icon).toBe("bwi-undo");
      expect(action.label).toBe("translated-restore");
    });

    it("assigns the correct icon and translated label for delete", () => {
      canDelete.set(true);

      const [action] = component["primaryActions"]();
      expect(action.icon).toBe("bwi-trash");
      expect(action.label).toBe("translated-delete");
    });
  });

  describe("action invocation", () => {
    it("calls service.bulkMoveToFolder when move action is invoked", () => {
      canAddToFolder.set(true);

      component["primaryActions"]()[0].action();

      expect(bulkMoveToFolderSpy).toHaveBeenCalledTimes(1);
    });

    it("calls service.bulkAssignToCollections when assign action is invoked", () => {
      canAssignToCollections.set(true);

      component["primaryActions"]()[0].action();

      expect(bulkAssignToCollectionsSpy).toHaveBeenCalledTimes(1);
    });

    it("calls service.bulkArchive when archive action is invoked", () => {
      canArchive.set(true);

      component["primaryActions"]()[0].action();

      expect(bulkArchiveSpy).toHaveBeenCalledTimes(1);
    });

    it("calls service.bulkUnarchive when unarchive action is invoked", () => {
      canUnarchive.set(true);

      component["primaryActions"]()[0].action();

      expect(bulkUnarchiveSpy).toHaveBeenCalledTimes(1);
    });

    it("calls service.bulkRestore when restore action is invoked", () => {
      canRestore.set(true);

      component["primaryActions"]()[0].action();

      expect(bulkRestoreSpy).toHaveBeenCalledTimes(1);
    });

    it("calls service.bulkDelete when delete action is invoked", () => {
      canDelete.set(true);

      component["primaryActions"]()[0].action();

      expect(bulkDeleteSpy).toHaveBeenCalledTimes(1);
    });
  });
});
