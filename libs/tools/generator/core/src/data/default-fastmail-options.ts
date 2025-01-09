import { ApiOptions, EmailPrefixOptions } from "../types";

export const DefaultFastmailOptions: ApiOptions & EmailPrefixOptions = Object.freeze({
  website: "",
  domain: "",
  prefix: "",
  token: "",
});
