import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import {
  DaemonTokenDialogComponent,
  DaemonTokenDialogParams,
} from "./daemon-token-dialog.component";

describe("DaemonTokenDialogComponent", () => {
  let fixture: ComponentFixture<DaemonTokenDialogComponent>;
  let component: DaemonTokenDialogComponent;
  let platformUtilsService: jest.Mocked<PlatformUtilsService>;
  let toastService: jest.Mocked<ToastService>;
  let dialogRef: jest.Mocked<DialogRef>;
  let i18nService: jest.Mocked<I18nService>;

  const params: DaemonTokenDialogParams = {
    daemonName: "Prod Daemon",
    token: "0.daemon.api-id.secret:keyb64==",
  };

  beforeEach(async () => {
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    dialogRef = {
      close: jest.fn().mockReturnValue(Promise.resolve()),
    } as unknown as jest.Mocked<DialogRef>;
    i18nService = {
      t: (key: string) => key,
    } as unknown as jest.Mocked<I18nService>;

    await TestBed.configureTestingModule({
      imports: [DaemonTokenDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DaemonTokenDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("renders the token in a readonly input", () => {
    const input = fixture.nativeElement.querySelector(
      "#daemon-token-dialog_input_token",
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe(params.token);
  });

  it("copies the token to clipboard on copyToken", () => {
    (component as any).copyToken();
    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(params.token);
  });

  it("shows a success toast after copying", () => {
    (component as any).copyToken();
    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("does not close the dialog after copying", () => {
    (component as any).copyToken();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it("closes the dialog on close()", () => {
    (component as any).close();
    expect(dialogRef.close).toHaveBeenCalled();
  });

  describe("open", () => {
    let dialogService: jest.Mocked<DialogService>;
    let openedRef: jest.Mocked<DialogRef>;

    beforeEach(() => {
      dialogService = mock<DialogService>();
      openedRef = mock<DialogRef>();
      dialogService.open.mockReturnValue(openedRef);
    });

    it("requests a dialog that cannot be dismissed by Escape, backdrop or the header X", () => {
      const result = DaemonTokenDialogComponent.open(dialogService, { data: params });

      expect(dialogService.open).toHaveBeenCalledWith(
        DaemonTokenDialogComponent,
        expect.objectContaining({ data: params, disableClose: true }),
      );
      expect(result).toBe(openedRef);
    });

    it("ignores a caller that asks for a dismissable dialog", () => {
      DaemonTokenDialogComponent.open(dialogService, { data: params, disableClose: false });

      expect(dialogService.open).toHaveBeenCalledWith(
        DaemonTokenDialogComponent,
        expect.objectContaining({ disableClose: true }),
      );
    });
  });
});
