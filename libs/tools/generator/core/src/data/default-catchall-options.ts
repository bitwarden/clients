import { CatchallGenerationOptions } from "../types";

/** The default options for catchall address generation. */
export const DefaultCatchallOptions: CatchallGenerationOptions = Object.freeze({
  catchallType: "random",
  catchallDomain: "",
  website: null,
});
