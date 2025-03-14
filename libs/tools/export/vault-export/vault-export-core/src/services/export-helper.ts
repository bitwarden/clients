export class ExportHelper {
  static getFileName(prefix: string = "", format = "csv"): string {
    if (format === "encrypted_json") {
      if (prefix == "") {
        prefix = "encrypted";
      } else {
        prefix = "encrypted_" + prefix;
      }
      format = "json";
    }

    const now = new Date();
    const dateString =
      now.getFullYear() +
      "" +
      this.padNumber(now.getMonth() + 1, 2) +
      "" +
      this.padNumber(now.getDate(), 2) +
      this.padNumber(now.getHours(), 2) +
      "" +
      this.padNumber(now.getMinutes(), 2) +
      this.padNumber(now.getSeconds(), 2);

    return "bitwarden" + (prefix ? "_" + prefix : "") + "_export_" + dateString + "." + format;
  }

  private static padNumber(num: number, width: number, padCharacter = "0"): string {
    const numString = num.toString();
    return numString.length >= width
      ? numString
      : new Array(width - numString.length + 1).join(padCharacter) + numString;
  }
}
