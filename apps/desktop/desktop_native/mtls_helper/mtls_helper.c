/* Linux Flatpak NSS worker. One bounded request per process; never writes key material to stdout. */
#define _POSIX_C_SOURCE 200809L
#include <cert.h>
#include <errno.h>
#include <nss.h>
#include <p12.h>
#include <pk11pub.h>
#include <prerror.h>
#include <prtime.h>
#include <secerr.h>
#include <secitem.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define MAX_BUNDLE (10u * 1024u * 1024u)
#define MAX_PASSWORD 4096u
#define MAX_OUTPUT (64u * 1024u)

static void wipe(void *buffer, size_t length) {
    volatile unsigned char *bytes = buffer;
    while (length--) *bytes++ = 0;
}

static unsigned int read_u32(const unsigned char *bytes) {
    return ((unsigned int)bytes[0] << 24) | ((unsigned int)bytes[1] << 16) |
           ((unsigned int)bytes[2] << 8) | bytes[3];
}

static void write_u32(unsigned char *bytes, unsigned int value) {
    bytes[0] = (unsigned char)(value >> 24);
    bytes[1] = (unsigned char)(value >> 16);
    bytes[2] = (unsigned char)(value >> 8);
    bytes[3] = (unsigned char)value;
}

static int read_exact(unsigned char *buffer, size_t length) {
    return fread(buffer, 1, length, stdin) == length;
}

static int respond(const char *json) {
    unsigned char length[4];
    size_t size = strlen(json);
    if (size > MAX_OUTPUT) return 1;
    write_u32(length, (unsigned int)size);
    return fwrite(length, 1, 4, stdout) != 4 || fwrite(json, 1, size, stdout) != size ||
           fflush(stdout) != 0;
}

static int fail(const char *code) {
    char response[128];
    snprintf(response, sizeof(response), "{\"version\":1,\"ok\":false,\"error\":\"%s\"}", code);
    return respond(response);
}

static char *empty_token_password(PK11SlotInfo *slot, PRBool retry, void *arg) {
    (void)slot;
    (void)arg;
    return retry ? NULL : PORT_Strdup("");
}

static PRBool convert_password(PRBool to_unicode, unsigned char *input,
                               unsigned int input_length, unsigned char *output,
                               unsigned int output_capacity, unsigned int *output_length,
                               PRBool swap_bytes) {
    unsigned char *copy = NULL;
    PRBool success;
    if (!to_unicode && swap_bytes) {
        if (input_length % 2) return PR_FALSE;
        copy = malloc(input_length);
        if (!copy) return PR_FALSE;
        memcpy(copy, input, input_length);
        for (unsigned int i = 0; i < input_length; i += 2) {
            unsigned char value = copy[i];
            copy[i] = copy[i + 1];
            copy[i + 1] = value;
        }
        input = copy;
    }
    success = PORT_UCS2_UTF8Conversion(to_unicode, input, input_length,
                                       output, output_capacity, output_length);
    if (success && to_unicode && swap_bytes) {
        for (unsigned int i = 0; i + 1 < *output_length; i += 2) {
            unsigned char value = output[i];
            output[i] = output[i + 1];
            output[i + 1] = value;
        }
    }
    if (copy) {
        wipe(copy, input_length);
        free(copy);
    }
    return success;
}

static SECItem *rename_collision(SECItem *old_nickname, PRBool *cancel, void *arg) {
    CERTCertificate *certificate = arg;
    SECItem *item;
    char *nickname;
    (void)old_nickname;
    *cancel = PR_FALSE;
    nickname = CERT_MakeCANickname(certificate);
    if (!nickname) return NULL;
    item = PORT_ZNew(SECItem);
    if (!item) {
        PORT_Free(nickname);
        return NULL;
    }
    item->type = siAsciiString;
    item->data = (unsigned char *)nickname;
    item->len = strlen(nickname);
    return item;
}

struct identity_name {
    char fingerprint[65];
    char nickname[128];
};

static int valid_store_id(const char *id) {
    if (!id || strlen(id) != 36) return 0;
    for (unsigned int i = 0; i < 36; i++) {
        if (i == 8 || i == 13 || i == 18 || i == 23) {
            if (id[i] != '-') return 0;
        } else if (!((id[i] >= '0' && id[i] <= '9') ||
                     (id[i] >= 'a' && id[i] <= 'f'))) return 0;
    }
    return 1;
}

static int valid_fingerprint(const char *fingerprint) {
    if (!fingerprint || strlen(fingerprint) != 64) return 0;
    for (unsigned int i = 0; i < 64; i++) {
        if (!((fingerprint[i] >= '0' && fingerprint[i] <= '9') ||
              (fingerprint[i] >= 'a' && fingerprint[i] <= 'f'))) return 0;
    }
    return 1;
}

static SECStatus rename_owned_leaf(const CERTCertificate *certificate,
                                   const SECItem *default_nickname,
                                   SECItem **new_nickname, void *argument) {
    struct identity_name *identity = argument;
    unsigned char digest[32];
    static const char hex[] = "0123456789abcdef";
    char fingerprint[65];
    (void)default_nickname;
    *new_nickname = NULL;
    if (PK11_HashBuf(SEC_OID_SHA256, digest, certificate->derCert.data,
                     certificate->derCert.len) != SECSuccess) return SECFailure;
    for (unsigned int i = 0; i < 32; i++) {
        fingerprint[i * 2] = hex[digest[i] >> 4];
        fingerprint[i * 2 + 1] = hex[digest[i] & 15];
    }
    fingerprint[64] = 0;
    if (strcmp(fingerprint, identity->fingerprint)) return SECSuccess;
    *new_nickname = SECITEM_AllocItem(NULL, NULL, strlen(identity->nickname) + 1);
    if (!*new_nickname) return SECFailure;
    (*new_nickname)->type = siAsciiString;
    memcpy((*new_nickname)->data, identity->nickname, strlen(identity->nickname) + 1);
    (*new_nickname)->len = strlen(identity->nickname);
    return SECSuccess;
}

static char *base64(const unsigned char *data, size_t length) {
    static const char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    size_t out_length = ((length + 2) / 3) * 4;
    char *out = malloc(out_length + 1);
    size_t j = 0;
    if (!out) return NULL;
    for (size_t i = 0; i < length; i += 3) {
        unsigned int value = (unsigned int)data[i] << 16;
        if (i + 1 < length) value |= (unsigned int)data[i + 1] << 8;
        if (i + 2 < length) value |= data[i + 2];
        out[j++] = alphabet[(value >> 18) & 63];
        out[j++] = alphabet[(value >> 12) & 63];
        out[j++] = i + 1 < length ? alphabet[(value >> 6) & 63] : '=';
        out[j++] = i + 2 < length ? alphabet[value & 63] : '=';
    }
    out[j] = 0;
    return out;
}

static int private_directory(const char *directory, int create) {
    struct stat info;
    if (create && mkdir(directory, 0700) != 0 && errno != EEXIST) return 0;
    if (lstat(directory, &info) != 0) return !create && errno == ENOENT;
    return S_ISDIR(info.st_mode) && info.st_uid == geteuid() && (info.st_mode & 077) == 0;
}

static int store_path(char *output, size_t capacity, int writable) {
    const char *data_home = getenv("XDG_DATA_HOME");
    const char *user_home = getenv("HOME");
    const char *app_id = getenv("FLATPAK_ID");
    char pki[4096], dbdir[4096];
#ifndef MTLS_TEST_STORE
    char expected[4096], legacy[4096];
    struct stat info;
#endif
    int count;
    if (!data_home || !user_home || !app_id ||
        (strcmp(app_id, "com.bitwarden.desktop") && strcmp(app_id, "com.bitwarden.desktop.beta")
#ifdef MTLS_TEST_APP_ID
         && strcmp(app_id, MTLS_TEST_APP_ID)
#endif
        )) return 0;
#ifndef MTLS_TEST_STORE
    count = snprintf(expected, sizeof(expected), "%s/.var/app/%s/data", user_home, app_id);
    if (count < 1 || (size_t)count >= sizeof(expected) || strcmp(data_home, expected)) return 0;
#else
    (void)user_home;
#endif
#ifndef MTLS_TEST_STORE
    count = snprintf(legacy, sizeof(legacy), "%s/.pki/nssdb", user_home);
    if (count < 1 || (size_t)count >= sizeof(legacy) ||
        lstat(legacy, &info) == 0 || errno != ENOENT) return 0;
#endif
    count = snprintf(pki, sizeof(pki), "%s/pki", data_home);
    if (count < 1 || (size_t)count >= sizeof(pki) || !private_directory(pki, writable)) return 0;
    count = snprintf(dbdir, sizeof(dbdir), "%s/nssdb", pki);
    if (count < 1 || (size_t)count >= sizeof(dbdir) || !private_directory(dbdir, writable)) return 0;
    count = snprintf(output, capacity, "sql:%s", dbdir);
    return count > 0 && (size_t)count < capacity;
}

static int delete_owned(const char *store_id, const char *fingerprint) {
    char database[4096], nickname[128];
    struct stat info;
    const char *error = "backend-failed";
    PK11SlotInfo *slot = NULL;
    CERTCertificate *certificate = NULL;
    CERTCertList *certificates = NULL;
    int initialized = 0, success = 0;
    if (!store_path(database, sizeof(database), 0)) return fail("store-location-unsupported");
    if (lstat(database + 4, &info) != 0) {
        return errno == ENOENT ? respond("{\"version\":1,\"ok\":true}") : fail("store-location-unsupported");
    }
    snprintf(nickname, sizeof(nickname), "bw-mtls/%s/%s", store_id, fingerprint);
    PK11_SetPasswordFunc(empty_token_password);
    if (NSS_InitReadWrite(database) != SECSuccess) return fail("store-corrupt");
    initialized = 1;
    slot = PK11_GetInternalKeySlot();
    if (!slot) goto done;
    if (PK11_NeedUserInit(slot) || PK11_CheckUserPassword(slot, "") != SECSuccess) {
        error = "store-password-unsupported";
        goto done;
    }
    certificate = CERT_FindCertByNickname(CERT_GetDefaultCertDB(), nickname);
    if (!certificate) {
        success = 1; /* Deletion is idempotent after an interrupted cleanup. */
        goto done;
    }
    if (!certificate->nickname || strcmp(certificate->nickname, nickname)) {
        error = "conflict";
        goto done;
    }
    {
        unsigned char digest[32];
        static const char hex[] = "0123456789abcdef";
        char actual[65];
        if (PK11_HashBuf(SEC_OID_SHA256, digest, certificate->derCert.data,
                         certificate->derCert.len) != SECSuccess) goto done;
        for (unsigned int i = 0; i < 32; i++) {
            actual[i * 2] = hex[digest[i] >> 4];
            actual[i * 2 + 1] = hex[digest[i] & 15];
        }
        actual[64] = 0;
        if (strcmp(actual, fingerprint)) { error = "conflict"; goto done; }
    }
    {
        SECKEYPrivateKey *key = PK11_FindKeyByAnyCert(certificate, NULL);
        if (!key) { error = "identity-missing"; goto done; }
        SECKEY_DestroyPrivateKey(key);
    }
    certificates = PK11_ListCerts(PK11CertListUnique, NULL);
    if (!certificates) goto done;
    for (CERTCertListNode *node = CERT_LIST_HEAD(certificates);
         !CERT_LIST_END(node, certificates); node = CERT_LIST_NEXT(node)) {
        CERTCertificate *other = node->cert;
        if (SECITEM_CompareItem(&other->derCert, &certificate->derCert) == SECEqual) continue;
        if (SECITEM_CompareItem(&other->derPublicKey, &certificate->derPublicKey) == SECEqual) {
            error = "conflict"; /* Keep the key if another certificate uses it. */
            goto done;
        }
    }
    if (PK11_DeleteTokenCertAndKey(certificate, NULL) != SECSuccess) goto done;
    success = 1;
done:
    if (certificates) CERT_DestroyCertList(certificates);
    if (certificate) CERT_DestroyCertificate(certificate);
    if (slot) PK11_FreeSlot(slot);
    if (initialized && NSS_Shutdown() != SECSuccess) {
        success = 0;
        error = "backend-failed";
    }
    return success ? respond("{\"version\":1,\"ok\":true}") : fail(error);
}

int main(int argc, char **argv) {
    unsigned char header[12], *password = NULL, *bundle = NULL, *unicode = NULL;
    unsigned int version, password_length, bundle_length;
    char database[4096], *der_base64 = NULL, *response = NULL;
    unsigned char *leaf_copy = NULL;
    SECItem password_item = { siBuffer, NULL, 0 };
    SEC_PKCS12DecoderContext *decoder = NULL;
    const SEC_PKCS12DecoderItem *item = NULL;
    PK11SlotInfo *slot = NULL;
    unsigned int keyed = 0;
    SECItem leaf_der = { siBuffer, NULL, 0 };
    struct identity_name identity = { 0 };
    int initialized = 0, result = 1;
    const char *error = "backend-failed";

    if (argc == 4 && !strcmp(argv[1], "delete") && valid_store_id(argv[2]) &&
        valid_fingerprint(argv[3])) return delete_owned(argv[2], argv[3]);
    if (!((argc == 2 && !strcmp(argv[1], "inspect")) ||
          (argc == 3 && !strcmp(argv[1], "import") && valid_store_id(argv[2])))) {
        return fail("unsupported");
    }
    if (!read_exact(header, sizeof(header))) return fail("invalid-file");
    version = read_u32(header);
    password_length = read_u32(header + 4);
    bundle_length = read_u32(header + 8);
    if (version != 1 || !password_length || password_length > MAX_PASSWORD ||
        !bundle_length || bundle_length > MAX_BUNDLE) return fail("invalid-file");
    password = malloc(password_length);
    bundle = malloc(bundle_length);
    unicode = calloc((size_t)password_length + 1, 2);
    if (!password || !bundle || !unicode || !read_exact(password, password_length) ||
        !read_exact(bundle, bundle_length)) {
        error = "invalid-file";
        goto done;
    }
    /* The UTF-8 password crosses only this pipe; NSS expects null-terminated UTF-16BE. */
    {
        size_t offset = 0, out = 0;
        while (offset < password_length) {
            unsigned int codepoint;
            unsigned char first = password[offset++];
            unsigned int extra = first < 0x80 ? 0 : first < 0xe0 ? 1 : first < 0xf0 ? 2 : first < 0xf8 ? 3 : 4;
            if (extra == 4 || offset + extra > password_length) { error = "invalid-password"; goto done; }
            codepoint = extra == 0 ? first : first & ((1u << (6 - extra)) - 1);
            for (unsigned int i = 0; i < extra; i++) {
                unsigned char next = password[offset++];
                if ((next & 0xc0) != 0x80) { error = "invalid-password"; goto done; }
                codepoint = (codepoint << 6) | (next & 0x3f);
            }
            if ((extra == 1 && codepoint < 0x80) || (extra == 2 && codepoint < 0x800) ||
                (extra == 3 && codepoint < 0x10000) || codepoint > 0x10ffff ||
                (codepoint >= 0xd800 && codepoint <= 0xdfff)) { error = "invalid-password"; goto done; }
            if (codepoint > 0xffff) {
                codepoint -= 0x10000;
                unicode[out++] = (unsigned char)((0xd800 + (codepoint >> 10)) >> 8);
                unicode[out++] = (unsigned char)(0xd800 + (codepoint >> 10));
                unicode[out++] = (unsigned char)((0xdc00 + (codepoint & 0x3ff)) >> 8);
                unicode[out++] = (unsigned char)(0xdc00 + (codepoint & 0x3ff));
            } else {
                unicode[out++] = (unsigned char)(codepoint >> 8);
                unicode[out++] = (unsigned char)codepoint;
            }
        }
        password_item.data = unicode;
        password_item.len = (unsigned int)(out + 2);
    }

    PK11_SetPasswordFunc(empty_token_password);
    if (!store_path(database, sizeof(database), !strcmp(argv[1], "import"))) {
        error = "store-location-unsupported";
        goto done;
    }
    if ((strcmp(argv[1], "inspect") ? NSS_InitReadWrite(database) : NSS_NoDB_Init(NULL)) != SECSuccess) {
        error = "store-corrupt";
        goto done;
    }
    initialized = 1;
    PORT_SetUCS2_ASCIIConversionFunction(convert_password);
    slot = PK11_GetInternalKeySlot();
    if (!slot) goto done;
    if (!strcmp(argv[1], "import")) {
        if (PK11_NeedUserInit(slot) && PK11_InitPin(slot, NULL, "") != SECSuccess) goto done;
        if (PK11_CheckUserPassword(slot, "") != SECSuccess) {
            error = "store-password-unsupported";
            goto done;
        }
        if (PK11_Authenticate(slot, PR_FALSE, NULL) != SECSuccess) goto done;
    }
    decoder = SEC_PKCS12DecoderStart(&password_item, slot, NULL, NULL, NULL, NULL, NULL, NULL);
    if (!decoder || SEC_PKCS12DecoderUpdate(decoder, bundle, bundle_length) != SECSuccess) {
        error = "invalid-file";
        goto done;
    }
    if (SEC_PKCS12DecoderVerify(decoder) != SECSuccess) {
        int nss_error = PR_GetError();
        error = nss_error == SEC_ERROR_PKCS12_INVALID_MAC ||
                        nss_error == SEC_ERROR_BAD_PASSWORD ||
                        nss_error == SEC_ERROR_PKCS12_PRIVACY_PASSWORD_INCORRECT
                    ? "invalid-password"
                    : "invalid-file";
        goto done;
    }
    if (SEC_PKCS12DecoderSetTargetTokenCAs(decoder, SECPKCS12TargetTokenNoCAs) != SECSuccess ||
        SEC_PKCS12DecoderIterateInit(decoder) != SECSuccess) {
        error = "unsupported-bundle";
        goto done;
    }
    while (SEC_PKCS12DecoderIterateNext(decoder, &item) == SECSuccess && item) {
        if (item->hasKey) {
            keyed++;
            if (keyed != 1 || item->type != SEC_OID_PKCS12_V1_CERT_BAG_ID ||
                !item->der || !item->der->data || !item->der->len || item->der->len > MAX_OUTPUT / 2) {
                error = "unsupported-bundle";
                goto done;
            }
            leaf_copy = malloc(item->der->len);
            if (!leaf_copy) goto done;
            memcpy(leaf_copy, item->der->data, item->der->len);
            leaf_der.data = leaf_copy;
            leaf_der.len = item->der->len;
            der_base64 = base64(leaf_copy, leaf_der.len);
            if (!der_base64) goto done;
        }
    }
    if (keyed != 1 || !der_base64) { error = "unsupported-bundle"; goto done; }
    {
        CERTCertificate *parsed = CERT_NewTempCertificate(CERT_GetDefaultCertDB(),
                                                          &leaf_der, NULL, PR_FALSE, PR_TRUE);
        if (!parsed) { error = "unsupported-bundle"; goto done; }
        PRTime not_before, not_after, now = PR_Now();
        if (CERT_GetCertTimes(parsed, &not_before, &not_after) != SECSuccess) {
            CERT_DestroyCertificate(parsed);
            error = "unsupported-bundle";
            goto done;
        }
        if (now < not_before) {
            CERT_DestroyCertificate(parsed);
            error = "certificate-not-yet-valid";
            goto done;
        }
        if (now > not_after) {
            CERT_DestroyCertificate(parsed);
            error = "certificate-expired";
            goto done;
        }
        if (parsed->keyUsagePresent &&
            !(parsed->rawKeyUsage & (KU_DIGITAL_SIGNATURE | KU_KEY_ENCIPHERMENT))) {
            CERT_DestroyCertificate(parsed);
            error = "unsupported-bundle";
            goto done;
        }
        CERT_DestroyCertificate(parsed);
    }
    {
        unsigned char digest[32];
        static const char hex[] = "0123456789abcdef";
        if (PK11_HashBuf(SEC_OID_SHA256, digest, leaf_der.data, leaf_der.len) != SECSuccess) goto done;
        for (unsigned int i = 0; i < 32; i++) {
            identity.fingerprint[i * 2] = hex[digest[i] >> 4];
            identity.fingerprint[i * 2 + 1] = hex[digest[i] & 15];
        }
        identity.fingerprint[64] = 0;
        if (argc == 3) {
            snprintf(identity.nickname, sizeof(identity.nickname), "bw-mtls/%s/%s",
                     argv[2], identity.fingerprint);
        }
    }
    if (!strcmp(argv[1], "inspect") &&
        SEC_PKCS12DecoderValidateBags(decoder, rename_collision) != SECSuccess) {
        error = "unsupported-bundle";
        goto done;
    }
    if (!strcmp(argv[1], "import")) {
        CERTCertificate *existing = CERT_FindCertByDERCert(CERT_GetDefaultCertDB(), &leaf_der);
        if (existing) {
            SECKEYPrivateKey *key = PK11_FindKeyByAnyCert(existing, NULL);
            int owned = existing->nickname && !strcmp(existing->nickname, identity.nickname);
            if (key) SECKEY_DestroyPrivateKey(key);
            CERT_DestroyCertificate(existing);
            if (!owned || !key) { error = "conflict"; goto done; }
        } else {
            if (SEC_PKCS12DecoderRenameCertNicknames(decoder, rename_owned_leaf, &identity) != SECSuccess ||
                SEC_PKCS12DecoderValidateBags(decoder, rename_collision) != SECSuccess ||
                SEC_PKCS12DecoderImportBags(decoder) != SECSuccess) {
                error = "backend-failed";
                goto done;
            }
        }
    }
    response = malloc(strlen(der_base64) + 64);
    if (!response) goto done;
    snprintf(response, strlen(der_base64) + 64,
             "{\"version\":1,\"ok\":true,\"certificateDer\":\"%s\"}", der_base64);
    result = 0;
done:
    if (decoder) SEC_PKCS12DecoderFinish(decoder);
    if (slot) PK11_FreeSlot(slot);
    if (initialized && NSS_Shutdown() != SECSuccess) {
        result = 1;
        error = "backend-failed";
    }
    result = result == 0 && response ? respond(response) : fail(error);
    if (password) wipe(password, password_length);
    if (unicode) wipe(unicode, ((size_t)password_length + 1) * 2);
    if (bundle) wipe(bundle, bundle_length);
    free(password);
    free(unicode);
    free(bundle);
    free(leaf_copy);
    free(der_base64);
    free(response);
    return result;
}
