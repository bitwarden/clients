import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import {
  AccessConnectorTokenDialogComponent,
  AccessConnectorTokenDialogParams,
} from "./access-connector-token-dialog.component";

describe("AccessConnectorTokenDialogComponent", () => {
  let fixture: ComponentFixture<AccessConnectorTokenDialogComponent>;
  let component: AccessConnectorTokenDialogComponent;
  let platformUtilsService: jest.Mocked<PlatformUtilsService>;
  let toastService: jest.Mocked<ToastService>;
  let dialogRef: jest.Mocked<DialogRef>;
  let i18nService: jest.Mocked<I18nService>;

  const params: AccessConnectorTokenDialogParams = {
    token: "0.access-connector.api-id.secret:keyb64==",
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
      imports: [AccessConnectorTokenDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessConnectorTokenDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const closeButton = (): HTMLButtonElement =>
    el().querySelector("#access-connector-token-dialog_button_close") as HTMLButtonElement;
  const storedCheckbox = (): HTMLInputElement =>
    el().querySelector("#access-connector-token-dialog_checkbox_stored") as HTMLInputElement;

  function checkStored(checked = true): void {
    storedCheckbox().checked = checked;
    storedCheckbox().dispatchEvent(new Event("change"));
    fixture.detectChanges();
  }

  it("renders the token as text", () => {
    const token = el().querySelector("#access-connector-token-dialog_text_token");
    expect(token?.textContent?.trim()).toBe(params.token);
  });

  it("starts with the stored checkbox unchecked and Close disabled", () => {
    expect(storedCheckbox().checked).toBe(false);
    expect(closeButton().getAttribute("aria-disabled")).toBe("true");
  });

  it("enables Close once the admin confirms they stored the token", () => {
    checkStored();
    expect(closeButton().getAttribute("aria-disabled")).not.toBe("true");
  });

  it("disables Close again when the box is unchecked", () => {
    checkStored();
    checkStored(false);
    expect(closeButton().getAttribute("aria-disabled")).toBe("true");
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

  it("does not close before the token is confirmed stored", () => {
    (component as any).close();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it("closes the dialog on Close once the token is confirmed stored", () => {
    checkStored();
    closeButton().click();
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
      const result = AccessConnectorTokenDialogComponent.open(dialogService, { data: params });

      expect(dialogService.open).toHaveBeenCalledWith(
        AccessConnectorTokenDialogComponent,
        expect.objectContaining({ data: params, disableClose: true }),
      );
      expect(result).toBe(openedRef);
    });

    it("ignores a caller that asks for a dismissable dialog", () => {
      AccessConnectorTokenDialogComponent.open(dialogService, {
        data: params,
        disableClose: false,
      });

      expect(dialogService.open).toHaveBeenCalledWith(
        AccessConnectorTokenDialogComponent,
        expect.objectContaining({ disableClose: true }),
      );
    });
  });
});
