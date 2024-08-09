import { GeneratorTypes, PasswordTypes } from "../data/generator-types";

/** The kind of credential being generated. */
export type GeneratorType = (typeof GeneratorTypes)[number];

/** The kinds of passwords that can be generated. */
export type PasswordType = (typeof PasswordTypes)[number];
