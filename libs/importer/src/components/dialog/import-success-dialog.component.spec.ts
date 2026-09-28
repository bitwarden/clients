import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogRef, DIALOG_DATA } from "@bitwarden/components";

import { ImportResult } from "../../models";

import {
  ImportSuccessDialogComponent,
  ImportSuccessDialogData,
} from "./import-success-dialog.component";

function createCipher(type: CipherType = CipherType.Login): CipherView {
  const cipher = new CipherView();
  cipher.type = type;
  return cipher;
}

describe("ImportSuccessDialogComponent", () => {
  async function createComponent(
    data: ImportSuccessDialogData,
  ): Promise<ComponentFixture<ImportSuccessDialogComponent>> {
    const dialogRef: MockProxy<DialogRef> = mock<DialogRef>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [ImportSuccessDialogComponent],
      providers: [
        provideRouter([]),
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ImportSuccessDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  const rowsOf = (fixture: ComponentFixture<ImportSuccessDialogComponent>) =>
    (fixture.componentInstance as unknown as { dataSource: { data: unknown } }).dataSource.data;

  it("imports into root with no folders shows only the cipher type row", async () => {
    const importResult = new ImportResult();
    importResult.ciphers = [createCipher(), createCipher()];

    const fixture = await createComponent({ importResult });

    expect(rowsOf(fixture)).toEqual([{ icon: "globe", type: "typeLogin", count: 2 }]);
  });

  it("imports into an existing folder with no source folders does not show a Folders row", async () => {
    const importResult = new ImportResult();
    importResult.ciphers = [createCipher()];
    importResult.folders = [Object.assign(new FolderView(), { id: "existing", name: "Work" })];
    importResult.targetFolderIncluded = true;

    const fixture = await createComponent({ importResult });

    expect(rowsOf(fixture)).toEqual([{ icon: "globe", type: "typeLogin", count: 1 }]);
  });

  it("imports into an existing folder with nested source folders shows only the new folder count", async () => {
    const importResult = new ImportResult();
    importResult.ciphers = [createCipher()];
    importResult.folders = [
      Object.assign(new FolderView(), { id: "existing", name: "Work" }),
      Object.assign(new FolderView(), { name: "Work/Nested" }),
    ];
    importResult.targetFolderIncluded = true;

    const fixture = await createComponent({ importResult });

    expect(rowsOf(fixture)).toEqual([
      { icon: "globe", type: "typeLogin", count: 1 },
      { icon: "folder", type: "folders", count: 1 },
    ]);
  });

  it("imports into an existing collection with no source collections does not show a Collections row", async () => {
    const importResult = new ImportResult();
    importResult.ciphers = [createCipher()];
    importResult.collections = [
      new CollectionView({
        id: "existing" as CollectionId,
        name: "Engineering",
        organizationId: "org" as OrganizationId,
      }),
    ];
    importResult.targetCollectionIncluded = true;

    const fixture = await createComponent({ importResult });

    expect(rowsOf(fixture)).toEqual([{ icon: "globe", type: "typeLogin", count: 1 }]);
  });
});
