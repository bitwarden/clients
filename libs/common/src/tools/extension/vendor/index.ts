import { deepFreeze } from "../../util";

import { AddyIo, AddyIoExtensions } from "./addyio";
import { Bitwarden } from "./bitwarden";
import { DuckDuckGo, DuckDuckGoExtensions } from "./duckduckgo";
import { Fastmail, FastmailExtensions } from "./fastmail";
import { ForwardEmail, ForwardEmailExtensions } from "./forwardemail";
import { Mozilla, MozillaExtensions } from "./mozilla";
import { SimpleLogin, SimpleLoginExtensions } from "./simplelogin";

export const Vendors = deepFreeze([
  AddyIo,
  Bitwarden,
  DuckDuckGo,
  Fastmail,
  ForwardEmail,
  Mozilla,
  SimpleLogin,
]);

export const VendorExtensions = deepFreeze(
  [
    AddyIoExtensions,
    DuckDuckGoExtensions,
    FastmailExtensions,
    ForwardEmailExtensions,
    MozillaExtensions,
    SimpleLoginExtensions,
  ].flat(),
);
