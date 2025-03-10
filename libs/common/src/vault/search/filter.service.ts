import * as lunr from "lunr";
import {
  combineLatest,
  combineLatestWith,
  map,
  NEVER,
  Observable,
  of,
  OperatorFunction,
  pipe,
  switchMap,
} from "rxjs";

// eslint-disable-next-line no-restricted-imports -- temp poc, so we're ignoring the circular package dependency. We'll need to move this to the vault team's package
import { CollectionService } from "@bitwarden/admin-console/src/common/collections/abstractions";

import { OrganizationService } from "../../admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "../../auth/abstractions/account.service";
import { UriMatchStrategy } from "../../models/domain/domain-service";
import { CipherService } from "../abstractions/cipher.service";
import { FolderService } from "../abstractions/folder/folder.service.abstraction";
import { CipherType, FieldType } from "../enums";
import { CipherView } from "../models/view/cipher.view";

import { parseQuery } from "./parse";
import { ProcessInstructions, SearchContext } from "./query.types";

export class FilterService {
  private static registeredPipeline = false;
  searchContext$: Observable<SearchContext>;
  constructor(
    accountService: AccountService,
    cipherService: CipherService,
    organizationService: OrganizationService,
    folderService: FolderService,
    collectionService: CollectionService,
  ) {
    const activeAccount$ = accountService.activeAccount$.pipe(
      switchMap((account) => {
        return account ? of(account) : NEVER;
      }),
    );
    const viewsAndIndex$ = activeAccount$.pipe(
      switchMap((account) =>
        cipherService
          .cipherViews$(account.id)
          .pipe(switchMap((views) => of([views, this.buildIndex(views)] as const))),
      ),
    );

    this.searchContext$ = activeAccount$.pipe(
      switchMap((account) => {
        const userId = account.id;
        return combineLatest([
          viewsAndIndex$,
          organizationService.organizations$(userId),
          folderService.folderViews$(userId),
          collectionService.decryptedCollections$,
        ]);
      }),
      switchMap(([[ciphers, index], organizations, folders, collections]) => {
        return of({
          ciphers,
          index,
          organizations,
          folders,
          collections,
        });
      }),
    );

    // Currently have to ensure this is only done a single time. Lunr allows you to register a function
    // multiple times but they will add a warning message to the console. The way they do that breaks when ran on a service worker.
    if (!FilterService.registeredPipeline) {
      FilterService.registeredPipeline = true;
      //register lunr pipeline function
      lunr.Pipeline.registerFunction(this.normalizeAccentsPipelineFunction, "normalizeAccents");
    }
  }

  parse = map((query: string) => parseQuery(query));

  filter(): OperatorFunction<ProcessInstructions, CipherView[]> {
    return pipe(
      combineLatestWith(this.searchContext$),
      map(([instructions, context]) => {
        return instructions.filter(context).ciphers;
      }),
    );
  }

  private buildIndex(ciphers: CipherView[]) {
    const builder = new lunr.Builder();
    builder.pipeline.add(this.normalizeAccentsPipelineFunction);
    builder.ref("id");
    builder.field("shortid", {
      boost: 100,
      extractor: lunrExtractor((c: CipherView) => c.id.substring(0, 8)),
    });
    builder.field("name", { boost: 10 });
    builder.field("subtitle", {
      boost: 5,
      extractor: lunrExtractor((c: CipherView) => {
        if (c.subTitle != null && c.type === CipherType.Card) {
          return c.subTitle.replace(/\*/g, "");
        }
        return c.subTitle;
      }),
    });
    builder.field("notes");
    builder.field("login.username", {
      extractor: lunrExtractor((c: CipherView) =>
        c.type === CipherType.Login ? c.login?.username : null,
      ),
    });
    builder.field("login.uris", {
      boost: 2,
      extractor: lunrExtractor((c: CipherView) => this.uriExtractor(c)),
    });
    builder.field("fields", {
      extractor: lunrExtractor((c: CipherView) => this.fieldExtractor(c, false)),
    });
    builder.field("fields_joined", {
      extractor: lunrExtractor((c: CipherView) => this.fieldExtractor(c, true)),
    });
    builder.field("attachments", {
      extractor: lunrExtractor((c: CipherView) => this.attachmentExtractor(c, false)),
    });
    builder.field("attachments_joined", {
      extractor: lunrExtractor((c: CipherView) => this.attachmentExtractor(c, true)),
    });
    builder.field("organizationid", {
      extractor: lunrExtractor((c: CipherView) => c.organizationId),
    });
    return lunr(function () {
      this.ref("id");
      this.field("name");
      this.field("notes");
      this.field("login.username");
      this.field("login.uris");
      this.field("login.password");
      this.field("login.totp");
      this.field("login.passwordRevisionDate");
      this.field("login.passwordHistory");
      this.field("login.passwordHistory.password");

      ciphers.forEach((c) => this.add(c));
    });
  }

  private normalizeAccentsPipelineFunction(token: lunr.Token): any {
    const searchableFields = ["name", "login.username", "subtitle", "notes"];
    const fields = (token as any).metadata["fields"];
    const checkFields = fields.every((i: any) => searchableFields.includes(i));

    if (checkFields) {
      return FilterService.normalizeSearchQuery(token.toString());
    }

    return token;
  }

  private fieldExtractor(c: CipherView, joined: boolean) {
    if (!c.hasFields) {
      return null;
    }
    let fields: string[] = [];
    c.fields.forEach((f) => {
      if (f.name != null) {
        fields.push(f.name);
      }
      if (f.type === FieldType.Text && f.value != null) {
        fields.push(f.value);
      }
    });
    fields = fields.filter((f) => f.trim() !== "");
    if (fields.length === 0) {
      return null;
    }
    return joined ? fields.join(" ") : fields;
  }

  private attachmentExtractor(c: CipherView, joined: boolean) {
    if (!c.hasAttachments) {
      return null;
    }
    let attachments: string[] = [];
    c.attachments.forEach((a) => {
      if (a != null && a.fileName != null) {
        if (joined && a.fileName.indexOf(".") > -1) {
          attachments.push(a.fileName.substr(0, a.fileName.lastIndexOf(".")));
        } else {
          attachments.push(a.fileName);
        }
      }
    });
    attachments = attachments.filter((f) => f.trim() !== "");
    if (attachments.length === 0) {
      return null;
    }
    return joined ? attachments.join(" ") : attachments;
  }

  private uriExtractor(c: CipherView) {
    if (c.type !== CipherType.Login || c.login == null || !c.login.hasUris) {
      return null;
    }
    const uris: string[] = [];
    c.login.uris.forEach((u) => {
      if (u.uri == null || u.uri === "") {
        return null;
      }
      if (u.hostname != null) {
        uris.push(u.hostname);
        return null;
      }
      let uri = u.uri;
      if (u.match !== UriMatchStrategy.RegularExpression) {
        const protocolIndex = uri.indexOf("://");
        if (protocolIndex > -1) {
          uri = uri.substr(protocolIndex + 3);
        }
        const queryIndex = uri.search(/\?|&|#/);
        if (queryIndex > -1) {
          uri = uri.substring(0, queryIndex);
        }
      }
      uris.push(uri);
    });
    return uris.length > 0 ? uris : null;
  }

  // Remove accents/diacritics characters from text. This regex is equivalent to the Diacritic unicode property escape, i.e. it will match all diacritic characters.
  private static normalizeSearchQuery(query: string): string {
    return query?.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
}

type LunrExtractor = (doc: object) => string | string[] | object | object[];

// This is just a helper to allow extractors to be expressed with meaningful types, but adhere to lunr's extractor type
// the return type of the extractor includes null to match existing lunr behavior
function lunrExtractor<InputType extends object>(
  extractor: (doc: InputType) => string | object | object[] | null,
): LunrExtractor {
  return extractor as any as LunrExtractor;
}
