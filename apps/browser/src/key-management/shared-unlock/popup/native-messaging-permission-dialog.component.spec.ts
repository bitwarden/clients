import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import {
  NativeMessagingPermissionDialogComponent,
  NativeMessagingPermissionDialogParams,
} from "./native-messaging-permission-dialog.component";

describe("NativeMessagingPermissionDialogComponent", () => {
  let component: NativeMessagingPermissionDialogComponent;
  let fixture: ComponentFixture<NativeMessagingPermissionDialogComponent>;

  const dialogRef = mock<DialogRef<boolean>>();
  const i18nService = mock<I18nService>();

  beforeEach(async () => {
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [NativeMessagingPermissionDialogComponent],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NativeMessagingPermissionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("closes with true when the user continues", () => {
    component.continue();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it("open() opens the dialog via the DialogService", () => {
    const dialogService = mock<DialogService>();

    NativeMessagingPermissionDialogComponent.open(dialogService);

    expect(dialogService.open).toHaveBeenCalledWith(
      NativeMessagingPermissionDialogComponent,
      expect.objectContaining({ positionStrategy: expect.anything() }),
    );
  });

  it("open() passes params as dialog data when provided", () => {
    const dialogService = mock<DialogService>();
    const params: NativeMessagingPermissionDialogParams = {
      descriptionKey: "biometricPermissionDesc",
    };

    NativeMessagingPermissionDialogComponent.open(dialogService, params);

    expect(dialogService.open).toHaveBeenCalledWith(
      NativeMessagingPermissionDialogComponent,
      expect.objectContaining({ data: params }),
    );
  });
});
