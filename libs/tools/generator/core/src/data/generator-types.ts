/** Types of passwords that may be configured by the password generator */
export const PasswordTypes = Object.freeze(["password", "passphrase"] as const);

/** Types of generators that may be configured by the password generator */
export const GeneratorTypes = Object.freeze([...PasswordTypes, "username"] as const);
