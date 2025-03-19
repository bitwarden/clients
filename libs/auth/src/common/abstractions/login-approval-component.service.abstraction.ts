/**
 * Abstraction for the LoginApprovalComponent service.
 */
export abstract class LoginApprovalComponentServiceAbstraction {
  /**
   * Shows a login requested alert if the window is not visible.
   */
  abstract showLoginRequestedAlertIfWindowNotVisible: (email?: string) => Promise<void>;
}
