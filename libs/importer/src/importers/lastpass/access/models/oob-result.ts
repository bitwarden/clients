export class OobResult {
  static cancel = new OobResult(false, "cancel", false);

  constructor(
    public waitForOutOfBand: boolean,
    public passcode: string,
    public rememberMe: boolean,
  ) {}

  waitForApproval(rememberMe: boolean) {
    return new OobResult(true, "", rememberMe);
  }

  continueWithPasscode(passcode: string, rememberMe: boolean) {
    return new OobResult(false, passcode, rememberMe);
  }
}
