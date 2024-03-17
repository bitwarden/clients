/** Settings supported when generating an email subaddress */
export type SubaddressGenerationOptions = {
  type?: "random" | "website-name";
  email?: string;
};

/** The default options for email subaddress generation. */
export const DefaultSubaddressOptions: Partial<SubaddressGenerationOptions> = Object.freeze({
  type: "random",
});
