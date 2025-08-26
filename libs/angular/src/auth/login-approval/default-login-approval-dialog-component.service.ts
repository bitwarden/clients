import { LoginApprovalDialogComponentServiceAbstraction } from "./login-approval-dialog-component.service.abstraction";

/**
 * Default implementation of the LoginApprovalDialogComponentServiceAbstraction.
 */
export class DefaultLoginApprovalDialogComponentService
  implements LoginApprovalDialogComponentServiceAbstraction
{
  /**
   * No-op implementation of the showLoginRequestedAlertIfWindowNotVisible method.
   * @returns
   */
  async showLoginRequestedAlertIfWindowNotVisible(email?: string): Promise<void> {
    return;
  }
}
