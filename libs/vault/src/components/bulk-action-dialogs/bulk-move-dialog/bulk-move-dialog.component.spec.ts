import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogRef, DIALOG_DATA, ToastService } from "@bitwarden/components";

import { Vfo1TerminologyService } from "../../../services/vfo1-terminology.service";

import {
  BulkMoveDialogCipher,
  BulkMoveDialogComponent,
  BulkMoveDialogResult,
} from "./bulk-move-dialog.component";

const userId = "user-1" as UserId;

describe("BulkMoveDialogComponent", () => {
  const cipherService = mock<CipherService>();
  const toastService = mock<ToastService>();
  const dialogRef = mock<DialogRef>();
  const i18nService = mock<I18nService>();

  function create(ciphers: BulkMoveDialogCipher[]): BulkMoveDialogComponent {
    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(of([new FolderView()]));

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [BulkMoveDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { ciphers } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: CipherService, useValue: cipherService },
        { provide: I18nService, useValue: i18nService },
        { provide: FolderService, useValue: folderService },
        { provide: ToastService, useValue: toastService },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: userId }) },
        },
        { provide: Vfo1TerminologyService, useValue: { enabled: signal(true) } },
      ],
    }).overrideTemplate(BulkMoveDialogComponent, "");

    return TestBed.createComponent(BulkMoveDialogComponent).componentInstance;
  }

  // The specs read the template-facing members directly.
  const view = (component: BulkMoveDialogComponent) => component as any;

  beforeEach(() => {
    jest.clearAllMocks();
    i18nService.t.mockImplementation((key) => key);
  });

  it("preselects the folder when every item is already in it, with Save disabled", () => {
    const component = view(
      create([
        { id: "a", folderId: "work" },
        { id: "b", folderId: "work" },
      ]),
    );

    expect(component.sharedFolderId).toBe("work");
    expect(component.formGroup.value.folderId).toBe("work");
    expect(component.saveDisabled()).toBe(true);
  });

  it("treats items with no folder as sharing the No folder option", () => {
    const component = view(create([{ id: "a" }, { id: "b", folderId: null }]));

    expect(component.sharedFolderId).toBe("");
    expect(component.saveDisabled()).toBe(true);
  });

  it("preselects nothing when the items are in different folders", () => {
    const component = view(create([{ id: "a", folderId: "work" }, { id: "b" }]));

    expect(component.sharedFolderId).toBeUndefined();
    expect(component.formGroup.value.folderId).toBeNull();
    expect(component.saveDisabled()).toBe(true);
  });

  it("moves only the items not already in the chosen folder", async () => {
    const component = view(
      create([{ id: "a", folderId: "work" }, { id: "b", folderId: "family" }, { id: "c" }]),
    );
    component.formGroup.controls.folderId.setValue("family");

    await component.submit();

    expect(cipherService.moveManyWithServer).toHaveBeenCalledWith(["a", "c"], "family", userId);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "itemsAddedToFolder" }),
    );
    expect(dialogRef.close).toHaveBeenCalledWith(BulkMoveDialogResult.Moved);
  });

  it("uses the no-folder toast when clearing a single item's folder", async () => {
    const component = view(create([{ id: "a", folderId: "work" }, { id: "b" }]));
    component.formGroup.controls.folderId.setValue("");

    await component.submit();

    expect(cipherService.moveManyWithServer).toHaveBeenCalledWith(["a"], "", userId);
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "itemNowHasNoFolder" }),
    );
  });

  it("does nothing when no item would change", async () => {
    const component = view(create([{ id: "a", folderId: "work" }]));

    await component.submit();

    expect(cipherService.moveManyWithServer).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
