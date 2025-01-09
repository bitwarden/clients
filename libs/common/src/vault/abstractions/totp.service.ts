// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export abstract class TotpService {
  getCode: (key: string) => Promise<string>;
  getTimeInterval: (key: string) => number;
}
