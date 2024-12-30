// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { SendView } from "../tools/send/models/view/send.view";
import { IndexedEntityId } from "../types/guid";
import { CipherView } from "../vault/models/view/cipher.view";

export abstract class SearchService {
  indexedEntityId$: Observable<IndexedEntityId | null>;

  clearIndex: () => Promise<void>;
  isSearchable: (query: string) => Promise<boolean>;
  indexCiphers: (ciphersToIndex: CipherView[], indexedEntityGuid?: string) => Promise<void>;
  searchCiphers: (
    query: string,
    filter?: ((cipher: CipherView) => boolean) | ((cipher: CipherView) => boolean)[],
    ciphers?: CipherView[],
  ) => Promise<CipherView[]>;
  searchCiphersBasic: (ciphers: CipherView[], query: string, deleted?: boolean) => CipherView[];
  searchSends: (sends: SendView[], query: string) => SendView[];
}
