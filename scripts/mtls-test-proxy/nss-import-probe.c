/* Disposable NSS import experiment. This is not the production helper. */
#include <nss.h>
#include <p12.h>
#include <pk11pub.h>
#include <prerror.h>
#include <cert.h>
#include <secitem.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static unsigned char *read_file(const char *filename, size_t *length) {
    FILE *file = fopen(filename, "rb");
    unsigned char *data;
    long size;
    if (!file || fseek(file, 0, SEEK_END) || (size = ftell(file)) < 0 ||
        fseek(file, 0, SEEK_SET)) {
        return NULL;
    }
    data = malloc((size_t)size + 1);
    if (!data || fread(data, 1, (size_t)size, file) != (size_t)size) {
        free(data);
        fclose(file);
        return NULL;
    }
    fclose(file);
    data[size] = 0;
    *length = (size_t)size;
    return data;
}

static SECItem *rename_collision(SECItem *old_nickname, PRBool *cancel, void *arg) {
    char *nickname;
    SECItem *item;
    (void)old_nickname;
    *cancel = PR_FALSE;
    nickname = CERT_MakeCANickname((CERTCertificate *)arg);
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

static unsigned int conversion_calls = 0;
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
    conversion_calls++;
    if (!to_unicode && swap_bytes) {
        if (input_length % 2) return PR_FALSE;
        copy = malloc(input_length);
        if (!copy) return PR_FALSE;
        memcpy(copy, input, input_length);
        for (unsigned int i = 0; i < input_length; i += 2) {
            unsigned char b = copy[i];
            copy[i] = copy[i + 1];
            copy[i + 1] = b;
        }
        input = copy;
    }
    success = PORT_UCS2_UTF8Conversion(to_unicode, input, input_length,
                                       output, output_capacity, output_length);
    if (success && to_unicode && swap_bytes) {
        for (unsigned int i = 0; i + 1 < *output_length; i += 2) {
            unsigned char b = output[i];
            output[i] = output[i + 1];
            output[i + 1] = b;
        }
    }
    if (copy) {
        memset(copy, 0, input_length);
        free(copy);
    }
    return success;
}

int main(int argc, char **argv) {
    unsigned char *bundle = NULL, *password = NULL, *unicode = NULL;
    SEC_PKCS12DecoderContext *decoder = NULL;
    PK11SlotInfo *slot = NULL;
    SECItem password_item = { siBuffer, NULL, 0 };
    size_t bundle_length = 0, password_length = 0;
    int status = 1;
    const char *stage = "input";
    if (argc != 4) {
        return 2;
    }
    bundle = read_file(argv[2], &bundle_length);
    password = read_file(argv[3], &password_length);
    if (!bundle || !password || bundle_length > 10 * 1024 * 1024 ||
        password_length > 4096) {
        goto done;
    }
    unicode = calloc(password_length + 1, 2);
    if (!unicode) {
        goto done;
    }
    for (size_t i = 0; i < password_length; ++i) {
        if (password[i] > 127) {
            goto done; /* This fixture probe handles ASCII passwords only. */
        }
        unicode[i * 2 + 1] = password[i];
    }
    password_item.data = unicode;
    password_item.len = (unsigned int)((password_length + 1) * 2);
    stage = "NSS initialization";
    PK11_SetPasswordFunc(empty_token_password);
    /* NSS_Init opens certificate/key databases read-only. Import needs writes. */
    if (NSS_InitReadWrite(argv[1]) != SECSuccess) {
        goto done;
    }
    PORT_SetUCS2_ASCIIConversionFunction(convert_password);
    stage = "slot initialization";
    slot = PK11_GetInternalKeySlot();
    if (!slot || (PK11_NeedUserInit(slot) && PK11_InitPin(slot, NULL, "") != SECSuccess) ||
        PK11_Authenticate(slot, PR_FALSE, NULL) != SECSuccess) {
        goto done;
    }
    stage = "PKCS12 decode";
    decoder = SEC_PKCS12DecoderStart(&password_item, slot, NULL,
                                     NULL, NULL, NULL, NULL, NULL);
    if (!decoder || SEC_PKCS12DecoderUpdate(decoder, bundle, bundle_length) != SECSuccess) {
        goto done;
    }
    stage = "PKCS12 verify";
    if (SEC_PKCS12DecoderVerify(decoder) != SECSuccess) {
        goto done;
    }
    stage = "PKCS12 CA policy";
    if (SEC_PKCS12DecoderSetTargetTokenCAs(decoder,
            getenv("MTLS_PROBE_ALL_CAS") ? SECPKCS12TargetTokenAllCAs : SECPKCS12TargetTokenNoCAs) != SECSuccess) {
        goto done;
    }
    stage = "PKCS12 validate";
    if (SEC_PKCS12DecoderValidateBags(decoder, rename_collision) != SECSuccess) {
        goto done;
    }
    const SEC_PKCS12DecoderItem *item = NULL;
    unsigned int items = 0, keyed_items = 0;
    if (SEC_PKCS12DecoderIterateInit(decoder) == SECSuccess) {
        while (SEC_PKCS12DecoderIterateNext(decoder, &item) == SECSuccess && item) {
            items++;
            if (item->hasKey) keyed_items++;
        }
    }
    fprintf(stderr, "NSS probe inspected %u items, %u with keys\n", items, keyed_items);
    stage = "PKCS12 import";
    if (SEC_PKCS12DecoderImportBags(decoder) != SECSuccess) {
        goto done;
    }
    status = 0;
done:
    if (status) {
        fprintf(stderr, "NSS probe failed at %s (code %d; conversions %u)\n",
                stage, PR_GetError(), conversion_calls);
    }
    if (decoder) SEC_PKCS12DecoderFinish(decoder);
    if (slot) PK11_FreeSlot(slot);
    NSS_Shutdown();
    if (password) memset(password, 0, password_length);
    if (unicode) memset(unicode, 0, (password_length + 1) * 2);
    free(bundle);
    free(password);
    free(unicode);
    return status;
}
