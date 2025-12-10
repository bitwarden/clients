import { PublicKeysResponseModel } from "../../response/public-keys.response";

export abstract class KeyApiService {
  abstract getUserPublicKeys(id: string): Promise<PublicKeysResponseModel>;
}
