import { LoginApprovalComponentServiceAbstraction } from "../../common/abstractions/login-approval-component.service.abstraction";

/**
 * Default implementation of the LoginApprovalComponentServiceAbstraction.
 */
export class DefaultLoginApprovalComponentService
  implements LoginApprovalComponentServiceAbstraction
{
  /**
   * No-op implementation of the showLoginRequestedAlertIfWindowNotVisible method.
   * @returns
   */
  async showLoginRequestedAlertIfWindowNotVisible(email?: string): Promise<void> {
    return;
  }
}
