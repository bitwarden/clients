import { SubaddressGenerationOptions } from "../types";

/** The default options for email subaddress generation. */
export const DefaultSubaddressOptions: SubaddressGenerationOptions = Object.freeze({
  subaddressType: "random",
  subaddressEmail: "",
  website: null,
});
