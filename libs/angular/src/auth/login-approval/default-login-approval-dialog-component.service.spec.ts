import { TestBed } from "@angular/core/testing";

import { DefaultLoginApprovalDialogComponentService } from "./default-login-approval-dialog-component.service";
import { LoginApprovalDialogComponent } from "./login-approval-dialog.component";

describe("DefaultLoginApprovalDialogComponentService", () => {
  let service: DefaultLoginApprovalDialogComponentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DefaultLoginApprovalDialogComponentService],
    });

    service = TestBed.inject(DefaultLoginApprovalDialogComponentService);
  });

  it("is created successfully", () => {
    expect(service).toBeTruthy();
  });

  it("has showLoginRequestedAlertIfWindowNotVisible method that is a no-op", async () => {
    const loginApprovalDialogComponent = {} as LoginApprovalDialogComponent;

    const result = await service.showLoginRequestedAlertIfWindowNotVisible(
      loginApprovalDialogComponent.email,
    );

    expect(result).toBeUndefined();
  });
});
