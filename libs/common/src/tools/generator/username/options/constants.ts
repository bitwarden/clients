import { ForwarderMetadata } from "./forwarder-options";
import { UsernameGeneratorOptions } from "./generator-options";

/** Metadata about an email forwarding service.
 *  @remarks This is used to populate the forwarder selection list
 *  and to identify forwarding services in error messages.
 */
export const Forwarders = Object.freeze({
  /** For https://addy.io/ */
  AddyIo: Object.freeze({
    id: "anonaddy",
    name: "Addy.io",
    validForSelfHosted: true,
  } as ForwarderMetadata),

  /** For https://duckduckgo.com/email/ */
  DuckDuckGo: Object.freeze({
    id: "duckduckgo",
    name: "DuckDuckGo",
    validForSelfHosted: false,
  } as ForwarderMetadata),

  /** For https://www.fastmail.com. */
  Fastmail: Object.freeze({
    id: "fastmail",
    name: "Fastmail",
    validForSelfHosted: true,
  } as ForwarderMetadata),

  /** For https://relay.firefox.com/ */
  FirefoxRelay: Object.freeze({
    id: "firefoxrelay",
    name: "Firefox Relay",
    validForSelfHosted: false,
  } as ForwarderMetadata),

  /** For https://forwardemail.net/ */
  ForwardEmail: Object.freeze({
    id: "forwardemail",
    name: "Forward Email",
    validForSelfHosted: true,
  } as ForwarderMetadata),

  /** For https://simplelogin.io/ */
  SimpleLogin: Object.freeze({
    id: "simplelogin",
    name: "SimpleLogin",
    validForSelfHosted: true,
  } as ForwarderMetadata),
});

/** Padding values used to prevent leaking the length of the encrypted options. */
export const SecretPadding = Object.freeze({
  /** The length to pad out encrypted members. This should be at least as long
   *  as the JSON content for the longest JSON payload being encrypted.
   */
  length: 512,

  /** The character to use for padding. */
  character: "0",

  /** A regular expression for detecting invalid padding. When the character
   *  changes, this should be updated to include the new padding pattern.
   */
  hasInvalidPadding: /[^0]/,
});

/** Default options for username generation. */
// freeze all the things to prevent mutation
export const DefaultOptions: UsernameGeneratorOptions = Object.freeze({
  type: "word",
  website: "",
  word: Object.freeze({
    capitalize: true,
    includeNumber: true,
  }),
  subaddress: Object.freeze({
    algorithm: "random",
    email: "",
  }),
  catchall: Object.freeze({
    algorithm: "random",
    domain: "",
  }),
  forwarders: Object.freeze({
    service: Forwarders.Fastmail.id,
    fastMail: Object.freeze({
      website: null,
      domain: "",
      prefix: "",
      token: "",
    }),
    addyIo: Object.freeze({
      website: null,
      baseUrl: "https://app.addy.io",
      domain: "",
      token: "",
    }),
    forwardEmail: Object.freeze({
      website: null,
      token: "",
      domain: "",
    }),
    simpleLogin: Object.freeze({
      website: null,
      baseUrl: "https://app.simplelogin.io",
      token: "",
    }),
    duckDuckGo: Object.freeze({
      website: null,
      token: "",
    }),
    firefoxRelay: Object.freeze({
      website: null,
      token: "",
    }),
  }),
});
