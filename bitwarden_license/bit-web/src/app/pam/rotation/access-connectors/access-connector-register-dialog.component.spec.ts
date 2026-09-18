import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogCloseRef,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { RotationSdkService } from "../rotation-sdk.service";
import { ORGANIZATION_ID, connectorId } from "../testing/rotation-builders";

import {
  AccessConnectorRegisterDialogComponent,
  AccessConnectorRegisterDialogParams,
} from "./access-connector-register-dialog.component";
import { AccessConnectorTokenDialogComponent } from "./access-connector-token-dialog.component";

describe("AccessConnectorRegisterDialogComponent", () => {
  let fixture: ComponentFixture<AccessConnectorRegisterDialogComponent>;
  let component: AccessConnectorRegisterDialogComponent;
  let rotationSdk: jest.Mocked<RotationSdkService>;
  let dialogRef: jest.Mocked<DialogRef>;
  let toastService: jest.Mocked<ToastService>;
  let i18nService: jest.Mocked<I18nService>;
  /**
   * The DialogService actually injected into the component (which may come from
   * DialogModule's own providers rather than the test-level override).
   */
  let injectedDialogService: DialogService;

  const orgId = ORGANIZATION_ID as OrganizationId;
  const params: AccessConnectorRegisterDialogParams = { organizationId: orgId };

  const fakeRegistration = {
    id: connectorId("d-1"),
    organizationId: ORGANIZATION_ID,
    name: "Good access connector",
    status: "enabled",
    creationDate: "2026-01-01T00:00:00Z",
    token: "0.access-connector.api-id.secret:keyb64",
  };

  beforeEach(async () => {
    rotationSdk = {
      registerConnector: jest.fn().mockResolvedValue(fakeRegistration),
    } as unknown as jest.Mocked<RotationSdkService>;

    dialogRef = {
      close: jest.fn().mockReturnValue(Promise.resolve()),
    } as unknown as jest.Mocked<DialogRef>;

    toastService = mock<ToastService>();

    i18nService = {
      t: (id: string) => id,
    } as unknown as jest.Mocked<I18nService>;

    await TestBed.configureTestingModule({
      imports: [AccessConnectorRegisterDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
      ],
    })
      .overrideComponent(AccessConnectorRegisterDialogComponent, {
        set: {
          providers: [{ provide: RotationSdkService, useValue: rotationSdk }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AccessConnectorRegisterDialogComponent);
    component = fixture.componentInstance;
    // Retrieves the DialogService the component actually uses, which may come from
    // DialogModule, not the test override.
    injectedDialogService = fixture.debugElement.injector.get(DialogService);
    fixture.detectChanges();
  });

  it("renders the form with a name field", () => {
    const input = fixture.nativeElement.querySelector(
      "#access-connector-register-dialog_input_name",
    );
    expect(input).toBeTruthy();
  });

  it("calls rotationSdk.registerConnector with the form name on submit", async () => {
    (component as any).form.controls.name.setValue("My access connector");
    await (component as any).submit();

    expect(rotationSdk.registerConnector).toHaveBeenCalledWith(orgId, "My access connector");
  });

  it("does not submit when name is empty", async () => {
    (component as any).form.controls.name.setValue("");
    await (component as any).submit();

    expect(rotationSdk.registerConnector).not.toHaveBeenCalled();
  });

  it("closes the dialog after successful registration", async () => {
    (component as any).form.controls.name.setValue("Good access connector");
    await (component as any).submit();

    expect(dialogRef.close).toHaveBeenCalledWith({ registered: true });
  });

  it("opens the token dialog after successful registration", async () => {
    const openSpy = jest
      .spyOn(injectedDialogService, "open")
      .mockReturnValue({ closed: { toPromise: jest.fn() } } as any);

    (component as any).form.controls.name.setValue("Good access connector");
    await (component as any).submit();

    expect(openSpy).toHaveBeenCalledWith(
      AccessConnectorTokenDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          token: fakeRegistration.token,
          accessConnectorName: "Good access connector",
        }),
      }),
    );
  });

  it("does not open the token dialog until the register dialog has closed", async () => {
    let resolveClose!: (value: DialogCloseRef) => void;
    dialogRef.close.mockReturnValue(
      new Promise<DialogCloseRef>((resolve) => (resolveClose = resolve)),
    );
    const openSpy = jest
      .spyOn(injectedDialogService, "open")
      .mockReturnValue({ closed: { toPromise: jest.fn() } } as any);

    (component as any).form.controls.name.setValue("Good access connector");
    const submitted = (component as any).submit();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dialogRef.close).toHaveBeenCalledWith({ registered: true });
    expect(openSpy).not.toHaveBeenCalled();

    resolveClose({ closed: true });
    await submitted;

    expect(openSpy).toHaveBeenCalledWith(AccessConnectorTokenDialogComponent, expect.anything());
  });

  it("does not open the token dialog when registration fails", async () => {
    rotationSdk.registerConnector.mockRejectedValue(new ErrorResponse({ Message: "boom" }, 500));
    const openSpy = jest.spyOn(injectedDialogService, "open");

    (component as any).form.controls.name.setValue("Bad access connector");
    await (component as any).submit();

    expect(openSpy).not.toHaveBeenCalled();
  });

  it("shows an error toast when registration fails", async () => {
    rotationSdk.registerConnector.mockRejectedValue(new ErrorResponse({ Message: "boom" }, 500));
    (component as any).form.controls.name.setValue("Bad access connector");
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
