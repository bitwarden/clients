import OssMainBackground from "@bitwarden/browser/background/main.background";

export default class MainBackground {
  private ossMain = new OssMainBackground();

  async bootstrap() {
    await this.ossMain.bootstrap();
  }
}
