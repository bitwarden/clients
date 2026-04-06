import { SendHashedPasswordB64 } from "./send-hashed-password-b64.type";
import { SendOtp } from "./send-otp.type";

/**
 * The domain facing send access credentials
 * Will be internally mapped to the SDK types
 */
export type SendAccessDomainCredentials =
  | { kind: "password"; passwordHashB64: SendHashedPasswordB64 }
  | { kind: "email"; email: string }
  | { kind: "email_otp"; email: string; otp: SendOtp };
