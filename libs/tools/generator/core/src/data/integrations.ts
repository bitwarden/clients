import { AddyIo } from "../integration/addy-io";
import { DuckDuckGo } from "../integration/duck-duck-go";
import { Fastmail } from "../integration/fastmail";
import { FirefoxRelay } from "../integration/firefox-relay";
import { ForwardEmail } from "../integration/forward-email";
import { SimpleLogin } from "../integration/simple-login";

export const Integrations = Object.freeze({
  AddyIo,
  DuckDuckGo,
  Fastmail,
  FirefoxRelay,
  ForwardEmail,
  SimpleLogin,
} as const);
