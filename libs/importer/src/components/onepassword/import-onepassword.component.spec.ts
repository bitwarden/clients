import { ChangeDetectionStrategy, Component, viewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OnePasswordImportSummary } from "../../sdk";

import {
  ImportOnePasswordComponent,
  OnePasswordImportContext,
} from "./import-onepassword.component";
import { OnePasswordDirectImportService } from "./onepassword-direct-import.service";

@Component({
  template: `<form [formGroup]="form"><import-onepassword /></form>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ImportOnePasswordComponent],
})
class HostComponent {
  readonly form: FormGroup = new FormGroup({});
  readonly importer = viewChild.required(ImportOnePasswordComponent);
}

describe("ImportOnePasswordComponent", () => {
  const summary: OnePasswordImportSummary = {
    imported: { ciphers: [], folders: 1, collections: 0 },
    skipped_vaults: [],
    skipped_items: [],
  };
  const context: OnePasswordImportContext = {
    organizationId: undefined,
    selectedImportTarget: undefined,
    canAccessImportExport: false,
  };

  let fixture: ComponentFixture<HostComponent>;
  let directImportService: MockProxy<OnePasswordDirectImportService>;
  let onImported: jest.Mock<Promise<void>, [OnePasswordImportSummary]>;

  beforeEach(async () => {
    directImportService = mock<OnePasswordDirectImportService>();
    onImported = jest.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    })
      .overrideComponent(ImportOnePasswordComponent, {
        set: {
          providers: [{ provide: OnePasswordDirectImportService, useValue: directImportService }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  function options(): FormGroup {
    return fixture.componentInstance.form.controls["onepasswordOptions"] as FormGroup;
  }

  function fillIn() {
    options().setValue({
      email: " user@example.com ",
      subdomain: "my",
      domain: "Global",
    });
  }

  async function submit() {
    await fixture.componentInstance.importer().submitDirect(context, onImported);
    fixture.detectChanges();
  }

  function errorText(): string | undefined {
    const callout = (fixture.nativeElement as HTMLElement).querySelector("bit-callout");
    return callout?.textContent?.trim();
  }

  it("does not import an incomplete form", async () => {
    await submit();

    expect(directImportService.handleImport).not.toHaveBeenCalled();
  });

  it("imports the account that was entered and hands the summary over", async () => {
    directImportService.handleImport.mockResolvedValue(summary);
    fillIn();

    await submit();

    expect(directImportService.handleImport).toHaveBeenCalledWith(
      { email: "user@example.com", subdomain: "my", domain: "Global" },
      undefined,
      undefined,
      false,
    );
    expect(onImported).toHaveBeenCalledWith(summary);
  });

  it("does nothing more when the user cancels a prompt", async () => {
    directImportService.handleImport.mockResolvedValue(undefined);
    fillIn();

    await submit();

    expect(onImported).not.toHaveBeenCalled();
    expect(errorText()).toBeUndefined();
  });

  it("shows why an import failed and keeps the form valid, so the same details can be retried", async () => {
    directImportService.handleImport.mockRejectedValueOnce(new Error("failed"));
    fillIn();

    await submit();

    expect(errorText()).toContain("errorOccurred");
    expect(fixture.componentInstance.form.valid).toBe(true);
    expect(onImported).not.toHaveBeenCalled();

    directImportService.handleImport.mockResolvedValueOnce(summary);
    await submit();

    expect(errorText()).toBeUndefined();
    expect(onImported).toHaveBeenCalledWith(summary);
  });
});
