import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DIALOG_DATA } from "@bitwarden/components";

import { ImportRecordError, ImportRecordErrorReason } from "../../models";

import {
  ImportSkippedItemsDialogComponent,
  ImportSkippedItemsDialogData,
} from "./import-skipped-items-dialog.component";

describe("ImportSkippedItemsDialogComponent", () => {
  let dialogRef: MockProxy<DialogRef>;

  async function createComponent(
    data: ImportSkippedItemsDialogData,
  ): Promise<ComponentFixture<ImportSkippedItemsDialogComponent>> {
    dialogRef = mock<DialogRef>();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [ImportSkippedItemsDialogComponent],
      providers: [
        provideRouter([]),
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ImportSkippedItemsDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  const rowsOf = (fixture: ComponentFixture<ImportSkippedItemsDialogComponent>) =>
    (fixture.componentInstance as unknown as { dataSource: { data: unknown } }).dataSource.data;

  it("renders one row per skipped item with its identifier (UID) and localized reason", async () => {
    const fixture = await createComponent({
      errors: [
        new ImportRecordError("ssh-key-uuid", ImportRecordErrorReason.SshKeyParseFailed),
        new ImportRecordError("weird-item-uuid", ImportRecordErrorReason.Error),
      ],
    });

    expect(rowsOf(fixture)).toEqual([
      { id: "ssh-key-uuid", reason: "importSkipReasonSshKeyParse" },
      { id: "weird-item-uuid", reason: "importSkipReasonGeneric" },
    ]);
    // Two data rows rendered in the table body.
    expect((fixture.nativeElement as HTMLElement).querySelectorAll("tr[bitrow]").length).toBe(2);
  });

  it("falls back to a placeholder when the item had no identifier", async () => {
    const fixture = await createComponent({
      errors: [new ImportRecordError("", ImportRecordErrorReason.Error)],
    });

    expect(rowsOf(fixture)).toEqual([{ id: "—", reason: "importSkipReasonGeneric" }]);
  });

  it("uses the singular title key for exactly one skipped item", async () => {
    const fixture = await createComponent({
      errors: [new ImportRecordError("only-uuid", ImportRecordErrorReason.Error)],
    });
    const title = (fixture.nativeElement as HTMLElement).querySelector("[bitDialogTitle]");

    expect(title?.textContent).toContain("importPartialErrorTitleSingular");
  });

  it("uses the plural title key for multiple skipped items", async () => {
    const fixture = await createComponent({
      errors: [
        new ImportRecordError("a", ImportRecordErrorReason.Error),
        new ImportRecordError("b", ImportRecordErrorReason.Error),
      ],
    });
    const title = (fixture.nativeElement as HTMLElement).querySelector("[bitDialogTitle]");

    expect(title?.textContent).toContain("importPartialErrorTitle");
    expect(title?.textContent).not.toContain("importPartialErrorTitleSingular");
  });

  it("shows a close button and no return button without a return destination", async () => {
    const fixture = await createComponent({
      errors: [new ImportRecordError("x", ImportRecordErrorReason.Error)],
    });
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="ok-button"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="return-button"]')).toBeNull();
  });

  it("shows the return button and navigates back when a return destination is provided", async () => {
    const fixture = await createComponent({
      errors: [new ImportRecordError("x", ImportRecordErrorReason.Error)],
      returnUrl: "/vault",
      returnLabel: "Back to vault",
    });
    const navigate = jest.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;
    const returnBtn = el.querySelector<HTMLButtonElement>('[data-testid="return-button"]');

    expect(returnBtn).not.toBeNull();
    expect(returnBtn?.textContent).toContain("Back to vault");
    expect(el.querySelector('[data-testid="ok-button"]')).toBeNull();

    returnBtn!.click();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
    expect(navigate).toHaveBeenCalledWith("/vault");
  });
});
