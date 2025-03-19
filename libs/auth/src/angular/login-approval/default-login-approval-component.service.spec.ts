import { TestBed } from "@angular/core/testing";

import { DefaultLoginApprovalComponentService } from "./default-login-approval-component.service";
import { LoginApprovalComponent } from "./login-approval.component";

describe("DefaultLoginApprovalComponentService", () => {
  let service: DefaultLoginApprovalComponentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DefaultLoginApprovalComponentService],
    });

    service = TestBed.inject(DefaultLoginApprovalComponentService);
  });

  it("is created successfully", () => {
    expect(service).toBeTruthy();
  });

  it("has showLoginRequestedAlertIfWindowNotVisible method that is a no-op", async () => {
    const loginApprovalComponent = {} as LoginApprovalComponent;
    await service.showLoginRequestedAlertIfWindowNotVisible(loginApprovalComponent.email);
  });
});
