import { deepFreeze } from "../../util";

import { AddyIo, AddyIoExtensions } from "./addyio";
import { Bitwarden } from "./bitwarden";
import { DuckDuckGo, DuckDuckGoExtensions } from "./duckduckgo";
import { Fastmail, FastmailExtensions } from "./fastmail";
import { ForwardEmail, ForwardEmailExtensions } from "./forwardemail";
import { Mozilla, MozillaExtensions } from "./mozilla";
import { ProxiedMail, ProxiedMailExtensions } from "./proxiedmail";
import { SimpleLogin, SimpleLoginExtensions } from "./simplelogin";

export const Vendors = deepFreeze([
  AddyIo,
  Bitwarden,
  DuckDuckGo,
  Fastmail,
  ForwardEmail,
  Mozilla,
  ProxiedMail,
  SimpleLogin,
]);

export const VendorExtensions = deepFreeze(
  [
    AddyIoExtensions,
    DuckDuckGoExtensions,
    FastmailExtensions,
    ForwardEmailExtensions,
    MozillaExtensions,
    ProxiedMailExtensions,
    SimpleLoginExtensions,
  ].flat(),
);
