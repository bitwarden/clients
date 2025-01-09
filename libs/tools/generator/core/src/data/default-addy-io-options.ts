import { EmailDomainOptions, SelfHostedApiOptions } from "../types";

export const DefaultAddyIoOptions: SelfHostedApiOptions & EmailDomainOptions = Object.freeze({
  website: null,
  baseUrl: "https://app.addy.io",
  token: "",
  domain: "",
});
