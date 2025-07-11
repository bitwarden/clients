import { PublicAccountKeysResponseModel } from "../../response/public-account-keys.response";

export abstract class KeyApiService {
  abstract getUserPublicKeys: (id: string) => Promise<PublicAccountKeysResponseModel>;
}
