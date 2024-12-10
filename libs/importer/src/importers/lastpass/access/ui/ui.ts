// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OobResult, OtpResult } from "../models";
export abstract class Ui {
  // To cancel return OtpResult.Cancel, otherwise only valid data is expected.
  provideGoogleAuthPasscode: () => Promise<OtpResult>;
  provideMicrosoftAuthPasscode: () => Promise<OtpResult>;
  provideYubikeyPasscode: () => Promise<OtpResult>;

  /*
  The UI implementations should provide the following possibilities for the user:
  
  1. Cancel. Return OobResult.Cancel to cancel.
  
  2. Go through with the out-of-band authentication where a third party app is used to approve or decline
      the action. In this case return OobResult.waitForApproval(rememberMe). The UI should return as soon
      as possible to allow the library to continue polling the service. Even though it's possible to return
      control to the library only after the user performed the out-of-band action, it's not necessary. It
      could be also done sooner.
  
  3. Allow the user to provide the passcode manually. All supported OOB methods allow to enter the
      passcode instead of performing an action in the app. In this case the UI should return
      OobResult.continueWithPasscode(passcode, rememberMe).
  */
  approveLastPassAuth: () => Promise<OobResult>;
  approveDuo: () => Promise<OobResult>;
  approveSalesforceAuth: () => Promise<OobResult>;

  /** Close MFA dialog on import success or error */
  closeMFADialog: () => void;
}
