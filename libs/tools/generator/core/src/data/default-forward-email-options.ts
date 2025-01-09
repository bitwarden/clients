import { ApiOptions, EmailDomainOptions } from "../types";

export const DefaultForwardEmailOptions: ApiOptions & EmailDomainOptions = Object.freeze({
  website: null,
  token: "",
  domain: "",
});
