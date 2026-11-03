export class OobResult {
  static cancel = new OobResult(false, "cancel");

  constructor(
    public waitForOutOfBand: boolean,
    public passcode: string,
  ) {}

  waitForApproval() {
    return new OobResult(true, "");
  }

  continueWithPasscode(passcode: string) {
    return new OobResult(false, passcode);
  }
}
