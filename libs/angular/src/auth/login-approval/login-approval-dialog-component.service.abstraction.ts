/**
 * Abstraction for the LoginApprovalDialogComponent service.
 */
export abstract class LoginApprovalDialogComponentServiceAbstraction {
  /**
   * Shows a login requested alert if the window is not visible.
   */
  abstract showLoginRequestedAlertIfWindowNotVisible: (email?: string) => Promise<void>;
}
