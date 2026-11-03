export class OtpResult {
  static cancel = new OtpResult("cancel");

  constructor(public passcode: string) {}
}
