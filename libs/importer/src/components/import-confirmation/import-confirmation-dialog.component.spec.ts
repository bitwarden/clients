import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import {
  ImportConfirmationDialogComponent,
  ImportConfirmationDialogData,
} from "./import-confirmation-dialog.component";

describe("ImportConfirmationDialogComponent", () => {
  let fixture: ComponentFixture<ImportConfirmationDialogComponent>;
  let dialogRef: { close: jest.Mock };

  const create = async (data: ImportConfirmationDialogData) => {
    dialogRef = { close: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [ImportConfirmationDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: dialogRef },
        { provide: LiveAnnouncer, useValue: mock<LiveAnnouncer>() },
        {
          provide: I18nService,
          useValue: mock<I18nService>({
            t: (key: string, ...args: (string | null | undefined)[]) =>
              [key, ...args.filter((a) => a != null)].join(":"),
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportConfirmationDialogComponent);
    fixture.detectChanges();
  };

  it("has a single Ok button that closes the dialog", async () => {
    await create({ summary: { total: 1, rows: [] } });

    const buttons = fixture.debugElement.queryAll(By.css("button"));
    const ok = fixture.debugElement.query(By.css("#import-confirmation-dialog_button_ok"));

    expect(ok.nativeElement.textContent.trim()).toBe("ok");
    ok.nativeElement.click();
    expect(dialogRef.close).toHaveBeenCalled();
    expect(buttons.map((b) => b.nativeElement.textContent.trim())).not.toContain(
      "viewImportedItems",
    );
  });

  it("focuses the Ok button when it opens", async () => {
    await create({ summary: { total: 1, rows: [] } });

    const ok = fixture.debugElement.query(By.css("#import-confirmation-dialog_button_ok"));
    expect(document.activeElement).toBe(ok.nativeElement);
  });

  it("gives the summary the imported file, for the tip", async () => {
    await create({ summary: { total: 3, rows: [] }, importedFile: { name: "export.csv" } });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      "importDeleteFileTip:export.csv",
    );
  });
});
