import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import {
  DaemonRegisterDialogComponent,
  DaemonRegisterDialogParams,
} from "./daemon-register-dialog.component";
import { RotationSdkService } from "../rotation-sdk.service";

import { DaemonTokenDialogComponent } from "./daemon-token-dialog.component";

describe("DaemonRegisterDialogComponent", () => {
  let fixture: ComponentFixture<DaemonRegisterDialogComponent>;
  let component: DaemonRegisterDialogComponent;
  let rotationSdk: jest.Mocked<RotationSdkService>;
  let dialogRef: jest.Mocked<DialogRef>;
  let toastService: jest.Mocked<ToastService>;
  let i18nService: jest.Mocked<I18nService>;
  /**
   * The DialogService actually injected into the component (which may come from
   * DialogModule's own providers rather than the test-level override).
   */
  let injectedDialogService: DialogService;

  const orgId = "org-1" as OrganizationId;
  const params: DaemonRegisterDialogParams = { organizationId: orgId };

  const fakeRegistration = {
    token: "0.daemon.api-id.secret:keyb64",
    daemon: { id: "d-1", apiKeyId: "api-id", clientSecret: "secret" },
  };

  beforeEach(async () => {
    rotationSdk = {
      register: jest.fn().mockResolvedValue(fakeRegistration),
    } as unknown as jest.Mocked<RotationSdkService>;

    dialogRef = {
      close: jest.fn().mockReturnValue(Promise.resolve()),
    } as unknown as jest.Mocked<DialogRef>;

    toastService = mock<ToastService>();

    i18nService = {
      t: (id: string) => id,
    } as unknown as jest.Mocked<I18nService>;

    await TestBed.configureTestingModule({
      imports: [DaemonRegisterDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
      ],
    })
      .overrideComponent(DaemonRegisterDialogComponent, {
        set: {
          providers: [{ provide: RotationSdkService, useValue: rotationSdk }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DaemonRegisterDialogComponent);
    component = fixture.componentInstance;
    // Retrieve the DialogService that the component actually uses (may be provided
    // by DialogModule rather than the test-level override).
    injectedDialogService = fixture.debugElement.injector.get(DialogService);
    fixture.detectChanges();
  });

  it("renders the form with a name field", () => {
    const input = fixture.nativeElement.querySelector("#daemon-register-dialog_input_name");
    expect(input).toBeTruthy();
  });

  it("calls rotationSdk.registerConnector with the form name on submit", async () => {
    (component as any).form.controls.name.setValue("My Daemon");
    await (component as any).submit();

    expect(rotationSdk.registerConnector).toHaveBeenCalledWith(orgId, "My Daemon");
  });

  it("does not submit when name is empty", async () => {
    (component as any).form.controls.name.setValue("");
    await (component as any).submit();

    expect(rotationSdk.registerConnector).not.toHaveBeenCalled();
  });

  it("closes the dialog after successful registration", async () => {
    (component as any).form.controls.name.setValue("Good Daemon");
    await (component as any).submit();

    expect(dialogRef.close).toHaveBeenCalledWith({ registered: true });
  });

  it("opens the token dialog after successful registration", async () => {
    const openSpy = jest
      .spyOn(injectedDialogService, "open")
      .mockReturnValue({ closed: { toPromise: jest.fn() } } as any);

    (component as any).form.controls.name.setValue("Good Daemon");
    await (component as any).submit();

    expect(openSpy).toHaveBeenCalledWith(
      DaemonTokenDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          token: fakeRegistration.token,
          daemonName: "Good Daemon",
        }),
      }),
    );
  });

  it("shows an error toast when registration fails", async () => {
    rotationSdk.registerConnector.mockRejectedValue(new ErrorResponse({ Message: "boom" }, 500));
    (component as any).form.controls.name.setValue("Bad Daemon");
    await (component as any).submit();

    expect(toastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    );
  });

  it("closes with undefined on cancel", () => {
    (component as any).cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });
});
