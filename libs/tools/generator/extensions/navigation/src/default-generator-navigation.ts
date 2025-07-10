import { GeneratorNavigation } from "./generator-navigation";

/** The default options for password generation. */
export const DefaultGeneratorNavigation: Partial<GeneratorNavigation> = Object.freeze({
  type: "password",
  username: "word",
  forwarder: "",
});
