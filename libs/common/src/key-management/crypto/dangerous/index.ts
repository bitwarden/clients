// Provides legacy / compatibility crypto that should not be used by anything other than the external
// integration.

export { DANGEROUS_aesDecryptDuckDuckGoNoPaddingAes256CbcHmac } from "./dangerous_duckduckgo_crypto";
export {
  DANGEROUS_aesEcbDecryptLastpassImport,
  DANGEROUS_aesCbcDecryptLastpassImport,
} from "./dangerous_lastpass_crypto";
