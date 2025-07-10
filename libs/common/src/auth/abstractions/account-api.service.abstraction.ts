import { SecretVerificationRequest } from "../models/request/secret-verification.request";

export abstract class AccountApiService {
  abstract deleteAccount(request: SecretVerificationRequest): Promise<void>;
}
