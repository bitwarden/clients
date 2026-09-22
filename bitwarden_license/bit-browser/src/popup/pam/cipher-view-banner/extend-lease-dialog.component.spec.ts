import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { EXTENSION_DURATION_OPTIONS } from "@bitwarden/bit-common/pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef } from "@bitwarden/components";

import { ExtendLeaseDialogComponent } from "./extend-lease-dialog.component";

describe("ExtendLeaseDialogComponent", () => {
  let fixture: ComponentFixture<ExtendLeaseDialogComponent>;
  let component: ExtendLeaseDialogComponent;
  let dialogRef: MockProxy<DialogRef>;

  beforeEach(() => {
    dialogRef = mock<DialogRef>();

    TestBed.configureTestingModule({
      imports: [ExtendLeaseDialogComponent],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
      ],
    });

    fixture = TestBed.createComponent(ExtendLeaseDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("seeds the picker with the shortest offered extension", () => {
    expect(component["formGroup"].controls.durationSeconds.value).toBe(
      EXTENSION_DURATION_OPTIONS[0].seconds,
    );
  });

  it("resolves with the chosen duration and reason", async () => {
    component["formGroup"].patchValue({ durationSeconds: 7200, reason: "still cutting over" });

    await component["submit"]();

    expect(dialogRef.close).toHaveBeenCalledWith({
      durationSeconds: 7200,
      reason: "still cutting over",
    });
  });

  it("does not resolve without a reason, which the server rejects", async () => {
    component["formGroup"].patchValue({ durationSeconds: 3600, reason: "" });

    await component["submit"]();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component["formGroup"].controls.reason.touched).toBe(true);
  });
});
