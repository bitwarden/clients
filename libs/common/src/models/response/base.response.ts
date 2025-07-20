// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export abstract class BaseResponse {
  private response: any;

  constructor(response: any) {
    this.response = response;
  }

  protected getResponseProperty(
    propertyName: string,
    response: any = null,
    exactName = false,
  ): any {
    if (propertyName == null || propertyName === "") {
      throw new Error("propertyName must not be null/empty.");
    }
    if (response == null && this.response != null) {
      response = this.response;
    }
    if (response == null) {
      return null;
    }
    if (!exactName && response[propertyName] === undefined) {
      let otherCasePropertyName: string = null;
      if (propertyName.charAt(0) === propertyName.charAt(0).toUpperCase()) {
        otherCasePropertyName = propertyName.charAt(0).toLowerCase();
      } else {
        otherCasePropertyName = propertyName.charAt(0).toUpperCase();
      }
      if (propertyName.length > 1) {
        otherCasePropertyName += propertyName.slice(1);
      }

      propertyName = otherCasePropertyName;
      if (response[propertyName] === undefined) {
        propertyName = propertyName.toLowerCase();
      }
      if (response[propertyName] === undefined) {
        propertyName = propertyName.toUpperCase();
      }
    }
    return response[propertyName];
  }
}
