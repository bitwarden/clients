export class OtpResult {
  static cancel = new OtpResult("cancel", false);

  constructor(
    public passcode: string,
    public rememberMe: boolean,
  ) {}
}
