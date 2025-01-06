import { VendorId } from "../type";

export const Vendor = Object.freeze({
  addyio: "addyio" as VendorId,
  bitwarden: "bitwarden" as VendorId, // RESERVED
  duckduckgo: "duckduckgo" as VendorId,
  fastmail: "fastmail" as VendorId,
  forwardemail: "forwardemail" as VendorId,
  mozilla: "mozilla" as VendorId,
  simplelogin: "simplelogin" as VendorId,
} as const);
