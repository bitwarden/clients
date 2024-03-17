/** Settings supported when generating an email subaddress */
export type CatchallGenerationOptions = {
  type?: "random" | "website-name";
  domain?: string;
};

/** The default options for email subaddress generation. */
export const DefaultCatchallOptions: Partial<CatchallGenerationOptions> = Object.freeze({
  type: "random",
});
