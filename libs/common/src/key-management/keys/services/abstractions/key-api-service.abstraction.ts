import { PublicAccountKeysResponseModel } from "../../response/public-account-keys.response";

export class KeyApiService {
  getUserPublicKeys: (id: string) => Promise<PublicAccountKeysResponseModel>;
}
