import { SendView } from "../tools/send/models/view/send.view";
import { CipherView } from "../vault/models/view/cipher.view";

export abstract class SearchService {
  indexedEntityId?: string = null;
  clearIndex: () => void;
  isSearchable: (query: string) => boolean;
  indexCiphers: (ciphersToIndex: CipherView[], indexedEntityGuid?: string) => Promise<void>;
  searchCiphers: (
    query: string,
    filter?: ((cipher: CipherView) => boolean) | ((cipher: CipherView) => boolean)[],
    ciphers?: CipherView[],
  ) => Promise<CipherView[]>;
  searchCiphersBasic: (ciphers: CipherView[], query: string, deleted?: boolean) => CipherView[];
  searchSends: (sends: SendView[], query: string) => SendView[];
}
