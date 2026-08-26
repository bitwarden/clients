// Node-only entry point. Kept out of the root barrel so that `crypto` never reaches a browser bundle.
export { NodeCryptoFunctionService } from "./node-crypto-function.service";
