#include "pch.h"
#include "PluginAuthenticatorImpl.h"
#include <App.xaml.h>
#include <PluginManagement/PluginRegistrationManager.h>
#include <PluginManagement/PluginCredentialManager.h>
#include <include/cbor-lite/codec.h>
#include <string>
#include <iostream>
#include <fstream>
#include <helpers/buffer_read_write.h>
namespace winrt
{
    using namespace winrt::Windows::Foundation;
    using namespace winrt::Microsoft::UI::Windowing;
    using namespace winrt::Microsoft::UI::Xaml;
    using namespace winrt::Microsoft::UI::Xaml::Controls;
    using namespace winrt::Microsoft::UI::Xaml::Navigation;
    using namespace PasskeyManager;
    using namespace PasskeyManager::implementation;
    using namespace CborLite;
}

namespace winrt::PasskeyManager::implementation
{
    static std::vector<uint8_t> GetRequestSigningPubKey()
    {
        return wil::reg::get_value_binary(HKEY_CURRENT_USER, c_pluginRegistryPath, c_windowsPluginRequestSigningKeyRegKeyName, REG_BINARY);
    }

    /*
    * This function is used to verify the signature of a request buffer.
    * The public key is part of response to plugin registration.
    */
    static HRESULT VerifySignatureHelper(
        std::vector<BYTE>& dataBuffer,
        PBYTE pbKeyData,
        DWORD cbKeyData,
        PBYTE pbSignature,
        DWORD cbSignature)
    {
        // Create key provider
        wil::unique_ncrypt_prov hProvider;
        wil::unique_ncrypt_key reqSigningKey;

        // Get the provider
        RETURN_IF_FAILED(NCryptOpenStorageProvider(&hProvider, nullptr, 0));
        // Create a NCrypt key handle from the public key
        RETURN_IF_FAILED(NCryptImportKey(
            hProvider.get(),
            NULL,
            BCRYPT_ECCPUBLIC_BLOB,
            NULL,
            &reqSigningKey,
            pbKeyData,
            cbKeyData, 0));

        // Verify the signature over the hash of dataBuffer using the hKey
        DWORD objLenSize = 0;
        DWORD bytesRead = 0;
        RETURN_IF_NTSTATUS_FAILED(BCryptGetProperty(
            BCRYPT_SHA256_ALG_HANDLE,
            BCRYPT_OBJECT_LENGTH,
            reinterpret_cast<PBYTE>(&objLenSize),
            sizeof(objLenSize),
            &bytesRead, 0));

        auto objLen = wil::make_unique_cotaskmem<BYTE[]>(objLenSize);
        wil::unique_bcrypt_hash hashHandle;
        RETURN_IF_NTSTATUS_FAILED(BCryptCreateHash(
            BCRYPT_SHA256_ALG_HANDLE,
            wil::out_param(hashHandle),
            objLen.get(),
            objLenSize,
            nullptr, 0, 0));
        RETURN_IF_NTSTATUS_FAILED(BCryptHashData(
            hashHandle.get(),
            dataBuffer.data(),
            static_cast<ULONG>(dataBuffer.size()), 0));

        DWORD localHashByteCount = 0;
        RETURN_IF_NTSTATUS_FAILED(BCryptGetProperty(
            BCRYPT_SHA256_ALG_HANDLE,
            BCRYPT_HASH_LENGTH,
            reinterpret_cast<PBYTE>(&localHashByteCount),
            sizeof(localHashByteCount),
            &bytesRead, 0));

        auto localHashBuffer = wil::make_unique_cotaskmem<BYTE[]>(localHashByteCount);
        RETURN_IF_NTSTATUS_FAILED(BCryptFinishHash(hashHandle.get(), localHashBuffer.get(), localHashByteCount, 0));
        RETURN_IF_WIN32_ERROR(NCryptVerifySignature(
                reqSigningKey.get(),
                nullptr,
                localHashBuffer.get(),
                localHashByteCount,
                pbSignature,
                cbSignature, 0));

        return S_OK;
    }

    HRESULT CheckHelloConsentCompleted()
    {
        winrt::com_ptr<App> curApp = winrt::Microsoft::UI::Xaml::Application::Current().as<App>();
        HANDLE handles[2] = { curApp->m_hVaultConsentComplete.get(), curApp->m_hVaultConsentFailed.get() };

        DWORD cWait = ARRAYSIZE(handles);
        DWORD hIndex = 0;
        RETURN_IF_FAILED(CoWaitForMultipleHandles(COWAIT_DISPATCH_WINDOW_MESSAGES | COWAIT_DISPATCH_CALLS, INFINITE, cWait, handles, &hIndex));
        if (hIndex == 1) // Consent failed
        {
            RETURN_HR(E_FAIL);
        }
        return S_OK;
    }

    HRESULT PerformUv(
        winrt::com_ptr<winrt::PasskeyManager::implementation::App>& curApp,
        HWND hWnd,
        wil::shared_hmodule webauthnDll,
        GUID transactionId,
        PluginOperationType operationType,
        std::vector<BYTE> requestBuffer,
        wil::shared_cotaskmem_string rpName,
        wil::shared_cotaskmem_string userName)
    {
        curApp->SetPluginPerformOperationOptions(hWnd, operationType, rpName.get(), userName.get());

        // Wait for the app main window to be ready.
        DWORD hIndex = 0;
        RETURN_IF_FAILED(CoWaitForMultipleHandles(COWAIT_DISPATCH_WINDOW_MESSAGES | COWAIT_DISPATCH_CALLS, INFINITE, 1, curApp->m_hWindowReady.addressof(), &hIndex));

        // Trigger a Consent Verifier Dialog to simulate a Windows Hello unlock flow
        // This is to demonstrate a vault unlock flow using Windows Hello and is not the recommended way to secure the vault
        if (PluginCredentialManager::getInstance().GetVaultLock())
        {
            curApp->GetDispatcherQueue().TryEnqueue([curApp]()
                {
                    curApp->SimulateUnLockVaultUsingConsentVerifier();
                });
            RETURN_IF_FAILED(CheckHelloConsentCompleted());
        }
        else
        {
            SetEvent(curApp->m_hVaultConsentComplete.get());
        }

        // Wait for user confirmation to proceed with the operation Create/Signin/Cancel button
        // This is a mock up for plugin requiring UI.
        {
            HANDLE handles[2] = { curApp->m_hPluginProceedButtonEvent.get(), curApp->m_hPluginUserCancelEvent.get() };
            DWORD cWait = ARRAYSIZE(handles);

            RETURN_IF_FAILED(CoWaitForMultipleHandles(COWAIT_DISPATCH_WINDOW_MESSAGES | COWAIT_DISPATCH_CALLS, INFINITE, cWait, handles, &hIndex));
            if (hIndex == 1) // Cancel button clicked
            {
                // User cancelled the operation. NTE_USER_CANCELLED allows Windows to distinguish between user cancellation and other errors.
                return NTE_USER_CANCELLED;
            }
        }

        // Skip user verification if the user has already performed a gesture to unlock the vault to avoid double prompting
        if (PluginCredentialManager::getInstance().GetVaultLock())
        {
            return S_OK;
        }

        EXPERIMENTAL_WEBAUTHN_PLUGIN_PERFORM_UV pluginPerformUv{};
        pluginPerformUv.transactionId = &transactionId;

        if (curApp->m_silentMode)
        {
            // If the app did not display any UI, use the hwnd of the caller here. This was included in the request to the plugin. Refer: EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST
            pluginPerformUv.hwnd = hWnd;
        }
        else
        {
            // If the app displayed UI, use the hwnd of the app window here
            pluginPerformUv.hwnd = curApp->GetNativeWindowHandle();
        }

        EXPERIMENTAL_PWEBAUTHN_PLUGIN_PERFORM_UV_RESPONSE pPluginPerformUvResponse = nullptr;

        auto webAuthNPluginPerformUv = GetProcAddressByFunctionDeclaration(webauthnDll.get(), EXPERIMENTAL_WebAuthNPluginPerformUv);
        RETURN_HR_IF_NULL(E_NOTIMPL, webAuthNPluginPerformUv);

        // Step 1: Get the UV count
        pluginPerformUv.type = EXPERIMENTAL_WEBAUTHN_PLUGIN_PERFORM_UV_OPERATION_TYPE::GetUvCount;
        RETURN_IF_FAILED(webAuthNPluginPerformUv(&pluginPerformUv, &pPluginPerformUvResponse));

        /*
        * pPluginPerformUvResponse->pbResponse contains the UV count
        * The UV count tracks the number of times the user has performed a gesture to unlock the vault
        */

        // Step 2: Get the public key
        pluginPerformUv.type = EXPERIMENTAL_WEBAUTHN_PLUGIN_PERFORM_UV_OPERATION_TYPE::GetPubKey;
        RETURN_IF_FAILED(webAuthNPluginPerformUv(&pluginPerformUv, &pPluginPerformUvResponse));

        // stash public key in a new buffer for later use
        DWORD cbPubData = pPluginPerformUvResponse->cbResponse;
        wil::unique_hlocal_ptr<BYTE[]> ppbPubKeyData = wil::make_unique_hlocal<BYTE[]>(cbPubData);
        memcpy_s(ppbPubKeyData.get(), cbPubData, pPluginPerformUvResponse->pbResponse, pPluginPerformUvResponse->cbResponse);

        // Step 3: Perform UV. This step uses a Windows Hello prompt to authenticate the user
        pluginPerformUv.type = EXPERIMENTAL_WEBAUTHN_PLUGIN_PERFORM_UV_OPERATION_TYPE::PerformUv;
        pluginPerformUv.pwszUsername = wil::make_cotaskmem_string(userName.get()).release();
        // pwszContext can be used to provide additional context to the user. This is displayed alongside the username in the Windows Hello passkey user verification dialog.
        pluginPerformUv.pwszContext = wil::make_cotaskmem_string(L"Context String").release();
        RETURN_IF_FAILED(webAuthNPluginPerformUv(&pluginPerformUv, &pPluginPerformUvResponse));

        // Verify the signature over the hash of requestBuffer using the hKey
        auto signatureVerifyResult = VerifySignatureHelper(
            requestBuffer,
            ppbPubKeyData.get(),
            cbPubData,
            pPluginPerformUvResponse->pbResponse,
            pPluginPerformUvResponse->cbResponse);
        curApp->GetDispatcherQueue().TryEnqueue([curApp, signatureVerifyResult]()
            {
                if (FAILED(signatureVerifyResult))
                {
                    curApp->m_pluginOperationStatus.uvSignatureVerificationStatus = signatureVerifyResult;
                }
            });
        return S_OK;
    }

    /*
    * This function is used to create a simplified version of authenticator data for the webauthn authenticator operations.
    * Refer: https://www.w3.org/TR/webauthn-3/#authenticator-data for more details.
    */
    HRESULT CreateAuthenticatorData(wil::shared_ncrypt_key hKey,
        DWORD cbRpId,
        PBYTE pbRpId,
        DWORD& pcbPackedAuthenticatorData,
        wil::unique_hlocal_ptr<BYTE[]>& ppbpackedAuthenticatorData,
        std::vector<uint8_t>& vCredentialIdBuffer)
    {
        // Get the public key blob
        DWORD cbPubKeyBlob = 0;
        THROW_IF_FAILED(NCryptExportKey(
            hKey.get(),
            NULL,
            BCRYPT_ECCPUBLIC_BLOB,
            NULL,
            NULL,
            0,
            &cbPubKeyBlob,
            0));
        auto pbPubKeyBlob = std::make_unique<BYTE[]>(cbPubKeyBlob);
        THROW_HR_IF(E_UNEXPECTED, pbPubKeyBlob == nullptr);
        DWORD cbPubKeyBlobOutput = 0;
        THROW_IF_FAILED(NCryptExportKey(
            hKey.get(),
            NULL,
            BCRYPT_ECCPUBLIC_BLOB,
            NULL,
            pbPubKeyBlob.get(),
            cbPubKeyBlob,
            &cbPubKeyBlobOutput,
            0));

        BCRYPT_ECCKEY_BLOB* pPubKeyBlobHeader = reinterpret_cast<BCRYPT_ECCKEY_BLOB*>(pbPubKeyBlob.get());
        DWORD cbXCoord = pPubKeyBlobHeader->cbKey;
        PBYTE pbXCoord = reinterpret_cast<PBYTE>(&pPubKeyBlobHeader[1]);
        DWORD cbYCoord = pPubKeyBlobHeader->cbKey;
        PBYTE pbYCoord = pbXCoord + cbXCoord;

        // create byte span for x and y
        std::span<const BYTE> xCoord(pbXCoord, cbXCoord);
        std::span<const BYTE> yCoord(pbYCoord, cbYCoord);

        // CBOR encode the public key in this order: kty, alg, crv, x, y
        std::vector<BYTE> buffer;

#pragma warning(push)
#pragma warning(disable: 4293)
        size_t bufferSize = CborLite::encodeMapSize(buffer, 5u);
#pragma warning(pop)

        // COSE CBOR encoding format. Refer to https://datatracker.ietf.org/doc/html/rfc9052#section-7 for more details.
        const int8_t ktyIndex = 1;
        const int8_t algIndex = 3;
        const int8_t crvIndex = -1;
        const int8_t xIndex = -2;
        const int8_t yIndex = -3;

        // Example values for EC2 P-256 ES256 Keys. Refer to https://www.w3.org/TR/webauthn-3/#example-bdbd14cc
        // Note that this sample authenticator only supports ES256 keys.
        const int8_t kty = 2; // Key type is EC2
        const int8_t crv = 1; // Curve is P-256
        const int8_t alg = -7; // Algorithm is ES256

        bufferSize += CborLite::encodeInteger(buffer, ktyIndex);
        bufferSize += CborLite::encodeInteger(buffer, kty);
        bufferSize += CborLite::encodeInteger(buffer, algIndex);
        bufferSize += CborLite::encodeInteger(buffer, alg);
        bufferSize += CborLite::encodeInteger(buffer, crvIndex);
        bufferSize += CborLite::encodeInteger(buffer, crv);
        bufferSize += CborLite::encodeInteger(buffer, xIndex);
        bufferSize += CborLite::encodeBytes(buffer, xCoord);
        bufferSize += CborLite::encodeInteger(buffer, yIndex);
        bufferSize += CborLite::encodeBytes(buffer, yCoord);

        wil::unique_bcrypt_hash hashHandle;
        THROW_IF_NTSTATUS_FAILED(BCryptCreateHash(
            BCRYPT_SHA256_ALG_HANDLE,
            &hashHandle,
            nullptr,
            0,
            nullptr,
            0,
            0));

        THROW_IF_NTSTATUS_FAILED(BCryptHashData(hashHandle.get(), reinterpret_cast<PUCHAR>(pbXCoord), cbXCoord, 0));
        THROW_IF_NTSTATUS_FAILED(BCryptHashData(hashHandle.get(), reinterpret_cast<PUCHAR>(pbYCoord), cbYCoord, 0));

        DWORD cbHash = 0;
        DWORD bytesRead = 0;
        THROW_IF_NTSTATUS_FAILED(BCryptGetProperty(
            hashHandle.get(),
            BCRYPT_HASH_LENGTH,
            reinterpret_cast<PBYTE>(&cbHash),
            sizeof(cbHash),
            &bytesRead,
            0));

        wil::unique_hlocal_ptr<BYTE[]> pbCredentialId = wil::make_unique_hlocal<BYTE[]>(cbHash);
        THROW_IF_NTSTATUS_FAILED(BCryptFinishHash(hashHandle.get(), pbCredentialId.get(), cbHash, 0));

        // Close the key and hash handle
        hKey.reset();
        hashHandle.reset();

        com_ptr<App> curApp = winrt::Microsoft::UI::Xaml::Application::Current().as<App>();
        PluginOperationType operationType = PLUGIN_OPERATION_TYPE_MAKE_CREDENTIAL;
        if (curApp &&
            curApp->m_pluginOperationOptions.operationType == PLUGIN_OPERATION_TYPE_GET_ASSERTION)
        {
            operationType = PLUGIN_OPERATION_TYPE_GET_ASSERTION;
        }

        // Refer to learn about packing credential data https://www.w3.org/TR/webauthn-3/#sctn-authenticator-data
        const DWORD rpidsha256Size = 32; // SHA256 hash of rpId
        const DWORD flagsSize = 1; // flags
        const DWORD signCountSize = 4; // signCount
        DWORD cbPackedAuthenticatorData = rpidsha256Size + flagsSize + signCountSize;

        if (operationType == PLUGIN_OPERATION_TYPE_MAKE_CREDENTIAL)
        {
            cbPackedAuthenticatorData += sizeof(GUID); // aaGuid
            cbPackedAuthenticatorData += sizeof(WORD); // credentialId length
            cbPackedAuthenticatorData += cbHash; // credentialId
            cbPackedAuthenticatorData += static_cast<DWORD>(buffer.size()); // public key
        }

        std::vector<BYTE> vPackedAuthenticatorData(cbPackedAuthenticatorData);
        auto writer = buffer_writer{ vPackedAuthenticatorData };

        auto rgbRpIdHash = writer.reserve_space<std::array<BYTE, rpidsha256Size>>(); // 32 bytes of rpIdHash which is SHA256 hash of rpName. https://www.w3.org/TR/webauthn-3/#sctn-authenticator-data
        DWORD cbRpIdHash;
        THROW_IF_WIN32_BOOL_FALSE(CryptHashCertificate2(BCRYPT_SHA256_ALGORITHM,
            0,
            nullptr,
            pbRpId,
            cbRpId,
            rgbRpIdHash->data(),
            &cbRpIdHash));

        // Flags uv, up, be, and at are set
        if (operationType == PLUGIN_OPERATION_TYPE_GET_ASSERTION)
        {
            // Refer https://www.w3.org/TR/webauthn-3/#authdata-flags
            *writer.reserve_space<uint8_t>() = 0x1d; // credential data flags of size 1 byte

            *writer.reserve_space<uint32_t>() = 0u; // Sign count of size 4 bytes is set to 0

            vCredentialIdBuffer.assign(pbCredentialId.get(), pbCredentialId.get() + cbHash);
        }
        else
        {
            // Refer https://www.w3.org/TR/webauthn-3/#authdata-flags
            *writer.reserve_space<uint8_t>() = 0x5d; // credential data flags of size 1 byte

            *writer.reserve_space<uint32_t>() = 0u; // Sign count of size 4 bytes is set to 0

            *writer.reserve_space<GUID>() = GUID_NULL; // aaGuid of size 16 bytes is set to 0

            // Retrieve credential id
            WORD cbCredentialId = static_cast<WORD>(cbHash);
            WORD cbCredentialIdBigEndian = _byteswap_ushort(cbCredentialId);

            *writer.reserve_space<WORD>() = cbCredentialIdBigEndian; // Size of credential id in unsigned big endian of size 2 bytes

            writer.add(std::span<BYTE>(pbCredentialId.get(), cbHash)); // Set credential id

            vCredentialIdBuffer.assign(pbCredentialId.get(), pbCredentialId.get() + cbHash);

            writer.add(std::span<BYTE>(buffer.data(), buffer.size())); // Set CBOR encoded public key
        }

        pcbPackedAuthenticatorData = static_cast<DWORD>(vPackedAuthenticatorData.size());
        ppbpackedAuthenticatorData = wil::make_unique_hlocal<BYTE[]>(pcbPackedAuthenticatorData);
        memcpy_s(ppbpackedAuthenticatorData.get(), pcbPackedAuthenticatorData, vPackedAuthenticatorData.data(), pcbPackedAuthenticatorData);

        return S_OK;
    }

    /*
    * This function is invoked by the platform to request the plugin to handle a make credential operation.
    * Refer: pluginauthenticator.h/pluginauthenticator.idl
    */
    HRESULT STDMETHODCALLTYPE ContosoPlugin::EXPERIMENTAL_PluginMakeCredential(
        /* [in] */ __RPC__in EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST pPluginMakeCredentialRequest,
        /* [out] */ __RPC__deref_out_opt EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE* response) noexcept
    {
        try
        {
            SetEvent(App::s_pluginOpRequestRecievedEvent.get()); // indicate COM message received
            DWORD hIndex = 0;
            RETURN_IF_FAILED(CoWaitForMultipleHandles( // wait for app to be ready
                COWAIT_DISPATCH_WINDOW_MESSAGES | COWAIT_DISPATCH_CALLS,
                INFINITE,
                1,
                App::s_hAppReadyForPluginOpEvent.addressof(),
                &hIndex));
            com_ptr<App> curApp = winrt::Microsoft::UI::Xaml::Application::Current().as<App>();

            wil::shared_hmodule webauthnDll(LoadLibraryExW(L"webauthn.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32));
            if (webauthnDll == nullptr)
            {
                return E_ABORT;
            }

            wil::unique_cotaskmem_ptr<EXPERIMENTAL_WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST> pDecodedMakeCredentialRequest;
            auto webauthnDecodeMakeCredentialRequest = GetProcAddressByFunctionDeclaration(webauthnDll.get(), EXPERIMENTAL_WebAuthNDecodeMakeCredentialRequest);
            THROW_IF_FAILED(webauthnDecodeMakeCredentialRequest(
                pPluginMakeCredentialRequest->cbEncodedRequest,
                pPluginMakeCredentialRequest->pbEncodedRequest,
                wil::out_param(pDecodedMakeCredentialRequest)));
            auto rpName = wil::make_cotaskmem_string(pDecodedMakeCredentialRequest->pRpInformation->pwszName);
            auto userName = wil::make_cotaskmem_string(pDecodedMakeCredentialRequest->pUserInformation->pwszName);
            std::vector<BYTE> requestBuffer(
                pPluginMakeCredentialRequest->pbEncodedRequest,
                pPluginMakeCredentialRequest->pbEncodedRequest + pPluginMakeCredentialRequest->cbEncodedRequest);

            auto ppbPubKeyData = GetRequestSigningPubKey();
            HRESULT requestSignResult = E_FAIL;
            if (!ppbPubKeyData.empty())
            {
                requestSignResult = VerifySignatureHelper(
                    requestBuffer,
                    ppbPubKeyData.data(),
                    static_cast<DWORD>(ppbPubKeyData.size()),
                    pPluginMakeCredentialRequest->pbRequestSignature,
                    pPluginMakeCredentialRequest->cbRequestSignature);
            }
            {
                std::lock_guard<std::mutex> lock(curApp->m_pluginOperationOptionsMutex);
                curApp->m_pluginOperationStatus.requestSignatureVerificationStatus = requestSignResult;
            }

            THROW_IF_FAILED(PerformUv(curApp,
                pPluginMakeCredentialRequest->hWnd,
                webauthnDll,
                pPluginMakeCredentialRequest->transactionId,
                PLUGIN_OPERATION_TYPE_MAKE_CREDENTIAL,
                requestBuffer,
                std::move(rpName),
                std::move(userName)));

            //create a persisted key using ncrypt
            wil::unique_ncrypt_prov hProvider;
            wil::unique_ncrypt_key hKey;

            // get the provider
            THROW_IF_FAILED(NCryptOpenStorageProvider(&hProvider, nullptr, 0));

            // get the user handle as a string
            std::wstring keyNameStr = contosoplugin_key_domain;
            std::wstringstream keyNameStream;
            for (DWORD idx = 0; idx < pDecodedMakeCredentialRequest->pUserInformation->cbId; idx++)
            {
                keyNameStream << std::hex << std::setw(2) << std::setfill(L'0') <<
                    static_cast<int>(pDecodedMakeCredentialRequest->pUserInformation->pbId[idx]);
            }
            keyNameStr += keyNameStream.str();

            // create the key
            THROW_IF_FAILED(NCryptCreatePersistedKey(
                hProvider.get(),
                &hKey,
                BCRYPT_ECDH_P256_ALGORITHM,
                keyNameStr.c_str(),
                0,
                NCRYPT_OVERWRITE_KEY_FLAG));

            // set the export policy
            DWORD exportPolicy = NCRYPT_ALLOW_PLAINTEXT_EXPORT_FLAG;
            THROW_IF_FAILED(NCryptSetProperty(
                hKey.get(),
                NCRYPT_EXPORT_POLICY_PROPERTY,
                reinterpret_cast<PBYTE>(&exportPolicy),
                sizeof(exportPolicy),
                NCRYPT_PERSIST_FLAG));

            // allow both signing and encryption
            DWORD keyUsage = NCRYPT_ALLOW_SIGNING_FLAG | NCRYPT_ALLOW_DECRYPT_FLAG;
            THROW_IF_FAILED(NCryptSetProperty(
                hKey.get(),
                NCRYPT_KEY_USAGE_PROPERTY,
                reinterpret_cast<PBYTE>(&keyUsage),
                sizeof(keyUsage),
                NCRYPT_PERSIST_FLAG));
            HWND hWnd;
            if (curApp->m_silentMode)
            {
                hWnd = curApp->m_pluginOperationOptions.hWnd;
            }
            else
            {
                hWnd = curApp->GetNativeWindowHandle();
            }
            THROW_IF_FAILED(NCryptSetProperty(
                hKey.get(),
                NCRYPT_WINDOW_HANDLE_PROPERTY,
                reinterpret_cast<PBYTE>(&hWnd),
                sizeof(HWND),
                0));

            // finalize the key
            THROW_IF_FAILED(NCryptFinalizeKey(hKey.get(), 0));

            DWORD cbPackedAuthenticatorData = 0;
            wil::unique_hlocal_ptr<BYTE[]> packedAuthenticatorData;
            std::vector<uint8_t> vCredentialIdBuffer;
            THROW_IF_FAILED(CreateAuthenticatorData(
                std::move(hKey),
                pDecodedMakeCredentialRequest->cbRpId,
                pDecodedMakeCredentialRequest->pbRpId,
                cbPackedAuthenticatorData,
                packedAuthenticatorData,
                vCredentialIdBuffer));

            auto operationResponse = wil::make_unique_cotaskmem<EXPERIMENTAL_WEBAUTHN_PLUGIN_OPERATION_RESPONSE>();

            WEBAUTHN_CREDENTIAL_ATTESTATION attestationResponse{};
            attestationResponse.dwVersion = WEBAUTHN_CREDENTIAL_ATTESTATION_CURRENT_VERSION;
            attestationResponse.pwszFormatType = WEBAUTHN_ATTESTATION_TYPE_NONE;
            attestationResponse.cbAttestation = 0;
            attestationResponse.pbAttestation = nullptr;
            attestationResponse.cbAuthenticatorData = 0;
            attestationResponse.pbAuthenticatorData = nullptr;

            attestationResponse.pbAuthenticatorData = packedAuthenticatorData.get();
            attestationResponse.cbAuthenticatorData = cbPackedAuthenticatorData;

            DWORD cbAttestationBuffer = 0;
            PBYTE pbattestationBuffer;

            auto webauthnEncodeMakeCredentialResponse = GetProcAddressByFunctionDeclaration(webauthnDll.get(), EXPERIMENTAL_WebAuthNEncodeMakeCredentialResponse);
            THROW_IF_FAILED(webauthnEncodeMakeCredentialResponse(
                &attestationResponse,
                &cbAttestationBuffer,
                &pbattestationBuffer));
            operationResponse->cbEncodedResponse = cbAttestationBuffer;
            operationResponse->pbEncodedResponse = wil::make_unique_cotaskmem<BYTE[]>(cbAttestationBuffer).release();
            memcpy_s(operationResponse->pbEncodedResponse,
                operationResponse->cbEncodedResponse,
                pbattestationBuffer,
                cbAttestationBuffer);

            *response = operationResponse.release();

            WEBAUTHN_CREDENTIAL_DETAILS credentialDetails{};
            credentialDetails.dwVersion = WEBAUTHN_CREDENTIAL_DETAILS_CURRENT_VERSION;
            credentialDetails.pUserInformation = const_cast<PWEBAUTHN_USER_ENTITY_INFORMATION>(pDecodedMakeCredentialRequest->pUserInformation);
            credentialDetails.pRpInformation = const_cast<PWEBAUTHN_RP_ENTITY_INFORMATION>(pDecodedMakeCredentialRequest->pRpInformation);
            credentialDetails.cbCredentialID = static_cast<DWORD>(vCredentialIdBuffer.size());
            credentialDetails.pbCredentialID = wil::make_unique_cotaskmem<BYTE[]>(vCredentialIdBuffer.size()).release();
            memcpy_s(credentialDetails.pbCredentialID, credentialDetails.cbCredentialID, vCredentialIdBuffer.data(), static_cast<DWORD>(vCredentialIdBuffer.size()));
            if (!PluginCredentialManager::getInstance().SaveCredentialMetadataToMockDB(credentialDetails))
            {
                std::lock_guard<std::mutex> lock(curApp->m_pluginOperationOptionsMutex);
                curApp->m_pluginOperationStatus.performOperationStatus = E_FAIL;
            }
            pDecodedMakeCredentialRequest.reset();
            SetEvent(App::s_hPluginOpCompletedEvent.get());
            return S_OK;
        }
        catch (...)
        {
            HRESULT hr = wil::ResultFromCaughtException();
            com_ptr<App> curApp = winrt::Microsoft::UI::Xaml::Application::Current().as<App>();
            if (curApp)
            {
                hr = winrt::to_hresult();
                std::lock_guard<std::mutex> lock(curApp->m_pluginOperationOptionsMutex);
                curApp->m_pluginOperationStatus.performOperationStatus = hr;
            };
            SetEvent(App::s_hPluginOpCompletedEvent.get());
            return hr;
        }
    }

    /*
    * This function is invoked by the platform to request the plugin to handle a get assertion operation.
    * Refer: pluginauthenticator.h/pluginauthenticator.idl
    */
    HRESULT STDMETHODCALLTYPE ContosoPlugin::EXPERIMENTAL_PluginGetAssertion(
        /* [in] */ __RPC__in EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST pPluginGetAssertionRequest,
        /* [out] */ __RPC__deref_out_opt EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE* response) noexcept
    {
        try
        {
            SetEvent(App::s_pluginOpRequestRecievedEvent.get());
            DWORD hIndex = 0;
            RETURN_IF_FAILED(CoWaitForMultipleHandles(
                COWAIT_DISPATCH_WINDOW_MESSAGES | COWAIT_DISPATCH_CALLS,
                INFINITE,
                1,
                App::s_hAppReadyForPluginOpEvent.addressof(),
                &hIndex));
            com_ptr<App> curApp = winrt::Microsoft::UI::Xaml::Application::Current().as<App>();

            wil::shared_hmodule webauthnDll(LoadLibraryExW(L"webauthn.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32));
            if (webauthnDll == nullptr)
            {
                return E_ABORT;
            }

            wil::unique_cotaskmem_ptr<EXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST> pDecodedAssertionRequest;
            // The EXPERIMENTAL_WebAuthNDecodeGetAssertionRequest function can be optionally used to decode the CBOR encoded request to a EXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_REQUEST structure.
            auto webauthnDecodeGetAssertionRequest = GetProcAddressByFunctionDeclaration(webauthnDll.get(), EXPERIMENTAL_WebAuthNDecodeGetAssertionRequest);
            webauthnDecodeGetAssertionRequest(pPluginGetAssertionRequest->cbEncodedRequest, pPluginGetAssertionRequest->pbEncodedRequest, wil::out_param(pDecodedAssertionRequest));
            wil::shared_cotaskmem_string rpName = wil::make_cotaskmem_string(pDecodedAssertionRequest->pwszRpId);
            //load the user handle
            auto& credManager = PluginCredentialManager::getInstance();
            const WEBAUTHN_CREDENTIAL_DETAILS* selectedCredential{};
            // create a list of credentials
            std::vector<const WEBAUTHN_CREDENTIAL_DETAILS *> selectedCredentials;

            while (true)
            {
                Sleep(100);
                if (credManager.IsLocalCredentialMetadataLoaded())
                {
                    credManager.GetLocalCredsByRpIdAndAllowList(pDecodedAssertionRequest->pwszRpId,
                        pDecodedAssertionRequest->CredentialList.ppCredentials,
                        pDecodedAssertionRequest->CredentialList.cCredentials,
                        selectedCredentials);
                    break;
                }
            }

            if (selectedCredentials.empty())
            {
                {
                    std::lock_guard<std::mutex> lock(curApp->m_pluginOperationOptionsMutex);
                    curApp->m_pluginOperationStatus.performOperationStatus = NTE_NOT_FOUND;
                }
                SetEvent(App::s_hPluginOpCompletedEvent.get());
                return NTE_NOT_FOUND;
            }
            else if (selectedCredentials.size() == 1 && credManager.GetSilentOperation())
            {
                selectedCredential = selectedCredentials[0];
            }
            else
            {
                curApp->SetMatchingCredentials(pDecodedAssertionRequest->pwszRpId, selectedCredentials, pPluginGetAssertionRequest->hWnd);
                hIndex = 0;
                RETURN_IF_FAILED(CoWaitForMultipleHandles(COWAIT_DISPATCH_WINDOW_MESSAGES | COWAIT_DISPATCH_CALLS, INFINITE, 1, curApp->m_hPluginCredentialSelected.addressof(), &hIndex));

                {
                    std::lock_guard<std::mutex> lock(curApp->m_pluginOperationOptionsMutex);
                    selectedCredential = curApp->m_pluginOperationOptions.selectedCredential;
                }

                // Failed to select a credential
                if (selectedCredential->cbCredentialID == 0 ||
                    selectedCredential->pbCredentialID == nullptr ||
                    selectedCredential->pUserInformation == nullptr ||
                    selectedCredential->pUserInformation->pwszName == nullptr)
                {
                    {
                        std::lock_guard<std::mutex> lock(curApp->m_pluginOperationOptionsMutex);
                        curApp->m_pluginOperationStatus.performOperationStatus = NTE_NOT_FOUND;
                    }
                    SetEvent(App::s_hPluginOpCompletedEvent.get());
                    return NTE_NOT_FOUND;
                }
            }

            wil::shared_cotaskmem_string userName = wil::make_cotaskmem_string(selectedCredential->pUserInformation->pwszName);

            std::vector<BYTE> requestBuffer(
                pPluginGetAssertionRequest->pbEncodedRequest,
                pPluginGetAssertionRequest->pbEncodedRequest + pPluginGetAssertionRequest->cbEncodedRequest);

            auto ppbPubKeyData = GetRequestSigningPubKey();
            HRESULT requestSignResult = E_FAIL;
            if (!ppbPubKeyData.empty())
            {
                requestSignResult = VerifySignatureHelper(
                    requestBuffer,
                    ppbPubKeyData.data(),
                    static_cast<DWORD>(ppbPubKeyData.size()),
                    pPluginGetAssertionRequest->pbRequestSignature,
                    pPluginGetAssertionRequest->cbRequestSignature);
            }

            {
                std::lock_guard<std::mutex> lock(curApp->m_pluginOperationOptionsMutex);
                curApp->m_pluginOperationStatus.requestSignatureVerificationStatus = requestSignResult;
            }

            THROW_IF_FAILED(PerformUv(curApp,
                pPluginGetAssertionRequest->hWnd,
                webauthnDll,
                pPluginGetAssertionRequest->transactionId,
                PLUGIN_OPERATION_TYPE_GET_ASSERTION,
                requestBuffer,
                rpName,
                userName));

            // convert user handle to a string
            std::wstring keyNameStr = contosoplugin_key_domain;
            std::wstringstream keyNameStream;
            for (DWORD idx = 0; idx < selectedCredential->pUserInformation->cbId; idx++)
            {
                keyNameStream << std::hex << std::setw(2) << std::setfill(L'0') <<
                    static_cast<int>(selectedCredential->pUserInformation->pbId[idx]);
            }
            keyNameStr += keyNameStream.str();

            //open the key using ncrypt and sign the data
            wil::unique_ncrypt_prov hProvider;
            wil::shared_ncrypt_key hKey;

            // get the provider
            THROW_IF_FAILED(NCryptOpenStorageProvider(&hProvider, nullptr, 0));

            // open the key
            THROW_IF_FAILED(NCryptOpenKey(hProvider.get(), &hKey, keyNameStr.c_str(), 0, 0));

            // set hwnd property
            wil::unique_hwnd hWnd;
            if (curApp->m_silentMode)
            {
                hWnd.reset(curApp->m_pluginOperationOptions.hWnd);
            }
            else
            {
                hWnd.reset(curApp->GetNativeWindowHandle());
            }
            THROW_IF_FAILED(NCryptSetProperty(
                hKey.get(),
                NCRYPT_WINDOW_HANDLE_PROPERTY,
                (BYTE*)(hWnd.addressof()),
                sizeof(HWND),
                0));

            // create authenticator data
            DWORD cbPackedAuthenticatorData = 0;
            wil::unique_hlocal_ptr<BYTE[]> packedAuthenticatorData;
            std::vector<uint8_t> vCredentialIdBuffer;
            THROW_IF_FAILED(CreateAuthenticatorData(hKey,
                pDecodedAssertionRequest->cbRpId,
                pDecodedAssertionRequest->pbRpId,
                cbPackedAuthenticatorData,
                packedAuthenticatorData,
                vCredentialIdBuffer));

            wil::unique_hlocal_ptr<BYTE[]> pbSignature = nullptr;
            DWORD cbSignature = 0;

            {
                wil::unique_bcrypt_hash hashHandle;


                THROW_IF_NTSTATUS_FAILED(BCryptCreateHash(
                    BCRYPT_SHA256_ALG_HANDLE,
                    &hashHandle,
                    nullptr,
                    0,
                    nullptr,
                    0,
                    0));

                THROW_IF_NTSTATUS_FAILED(BCryptHashData(hashHandle.get(), const_cast<PUCHAR>(packedAuthenticatorData.get()), cbPackedAuthenticatorData, 0));
                THROW_IF_NTSTATUS_FAILED(BCryptHashData(hashHandle.get(), const_cast<PUCHAR>(pDecodedAssertionRequest->pbClientDataHash), pDecodedAssertionRequest->cbClientDataHash, 0));

                DWORD bytesRead = 0;
                DWORD cbSignatureBuffer = 0;
                THROW_IF_NTSTATUS_FAILED(BCryptGetProperty(
                    hashHandle.get(),
                    BCRYPT_HASH_LENGTH,
                    reinterpret_cast<PBYTE>(&cbSignatureBuffer),
                    sizeof(cbSignatureBuffer),
                    &bytesRead,
                    0));

                wil::unique_hlocal_ptr<BYTE[]> signatureBuffer = wil::make_unique_hlocal<BYTE[]>(cbSignatureBuffer);
                THROW_HR_IF(E_UNEXPECTED, signatureBuffer == nullptr);
                THROW_IF_NTSTATUS_FAILED(BCryptFinishHash(hashHandle.get(), signatureBuffer.get(), cbSignatureBuffer, 0));

                // sign the data
                THROW_IF_FAILED(NCryptSignHash(hKey.get(), nullptr, signatureBuffer.get(), cbSignatureBuffer, nullptr, 0, &cbSignature, 0));

                pbSignature = wil::make_unique_hlocal<BYTE[]>(cbSignature);
                THROW_HR_IF(E_UNEXPECTED, pbSignature == nullptr);

                THROW_IF_FAILED(NCryptSignHash(hKey.get(), nullptr, signatureBuffer.get(), cbSignatureBuffer, pbSignature.get(), cbSignature, &cbSignature, 0));
                signatureBuffer.reset();

                auto encodeSignature = [](PBYTE signature, size_t signatureSize)
                    {
                        std::vector<BYTE> encodedSignature{};
                        encodedSignature.push_back(0x02);   // ASN integer tag 
                        encodedSignature.push_back(static_cast<BYTE>(signatureSize)); // length of the signature
                        if (WI_IsFlagSet(signature[0], 0x80))
                        {
                            encodedSignature[encodedSignature.size() - 1]++;
                            encodedSignature.push_back(0x00); // add a padding byte if the first byte has the high bit set
                        }

                        encodedSignature.insert(encodedSignature.end(), signature, signature + signatureSize);
                        return encodedSignature;
                    };

                auto signatureR = encodeSignature(pbSignature.get(), cbSignature / 2);
                auto signatureS = encodeSignature(pbSignature.get() + cbSignature / 2, cbSignature / 2);

                std::vector<BYTE> encodedSignature{};
                encodedSignature.push_back(0x30); // ASN sequence tag
                encodedSignature.push_back(static_cast<BYTE>(signatureR.size() + signatureS.size())); // length of the sequence
                encodedSignature.insert(encodedSignature.end(), signatureR.begin(), signatureR.end());
                encodedSignature.insert(encodedSignature.end(), signatureS.begin(), signatureS.end());

                cbSignature = static_cast<DWORD>(encodedSignature.size());
                pbSignature.reset();
                pbSignature = wil::make_unique_hlocal<BYTE[]>(cbSignature);
                THROW_HR_IF(E_UNEXPECTED, pbSignature == nullptr);
                memcpy_s(pbSignature.get(), cbSignature, encodedSignature.data(), static_cast<DWORD>(cbSignature));
            }

            // create the response
            auto operationResponse = wil::make_unique_cotaskmem<EXPERIMENTAL_WEBAUTHN_PLUGIN_OPERATION_RESPONSE>();

            auto assertionResponse = wil::make_unique_cotaskmem<WEBAUTHN_ASSERTION>();
            assertionResponse->dwVersion = WEBAUTHN_ASSERTION_CURRENT_VERSION;

            // [1] Credential (optional)
            assertionResponse->Credential.dwVersion = WEBAUTHN_CREDENTIAL_CURRENT_VERSION;
            assertionResponse->Credential.cbId = static_cast<DWORD>(vCredentialIdBuffer.size());
            assertionResponse->Credential.pbId = vCredentialIdBuffer.data();
            assertionResponse->Credential.pwszCredentialType = WEBAUTHN_CREDENTIAL_TYPE_PUBLIC_KEY;

            // [2] AuthenticatorData
            assertionResponse->cbAuthenticatorData = cbPackedAuthenticatorData;
            assertionResponse->pbAuthenticatorData = packedAuthenticatorData.get();

            // [3] Signature
            assertionResponse->cbSignature = cbSignature;
            assertionResponse->pbSignature = pbSignature.get();

            // [4] User (optional)
            assertionResponse->cbUserId = selectedCredential->pUserInformation->cbId;
            auto userIdBuffer = wil::make_unique_cotaskmem<BYTE[]>(selectedCredential->pUserInformation->cbId);
            memcpy_s(userIdBuffer.get(),
                selectedCredential->pUserInformation->cbId,
                selectedCredential->pUserInformation->pbId,
                selectedCredential->pUserInformation->cbId);
            assertionResponse->pbUserId = userIdBuffer.get();
            WEBAUTHN_USER_ENTITY_INFORMATION userEntityInformation{};
            userEntityInformation.dwVersion = WEBAUTHN_USER_ENTITY_INFORMATION_CURRENT_VERSION;
            userEntityInformation.cbId = assertionResponse->cbUserId;
            userEntityInformation.pbId = assertionResponse->pbUserId;

            auto ctapGetAssertionResponse = wil::make_unique_cotaskmem<EXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_RESPONSE>();
            ctapGetAssertionResponse->WebAuthNAssertion = *(assertionResponse.get()); // [1] Credential, [2] AuthenticatorData, [3] Signature
            ctapGetAssertionResponse->pUserInformation = &userEntityInformation; // [4] User
            ctapGetAssertionResponse->dwNumberOfCredentials = 1; // [5] NumberOfCredentials

            DWORD cbAssertionBuffer = 0;
            PBYTE pbAssertionBuffer;

            // The EXPERIMENTAL_WebAuthNEncodeGetAssertionResponse function can be optionally used to encode the 
            // EXPERIMENTAL_WEBAUTHN_CTAPCBOR_GET_ASSERTION_RESPONSE structure to a CBOR encoded response.
            auto webAuthNEncodeGetAssertionResponse = GetProcAddressByFunctionDeclaration(webauthnDll.get(), EXPERIMENTAL_WebAuthNEncodeGetAssertionResponse);
            THROW_IF_FAILED(webAuthNEncodeGetAssertionResponse(
                (EXPERIMENTAL_PCWEBAUTHN_CTAPCBOR_GET_ASSERTION_RESPONSE)(ctapGetAssertionResponse.get()),
                &cbAssertionBuffer,
                &pbAssertionBuffer));

            assertionResponse.reset();
            ctapGetAssertionResponse.reset();
            userIdBuffer.reset();
            packedAuthenticatorData.reset();
            pbSignature.reset();
            pDecodedAssertionRequest.reset();

            operationResponse->cbEncodedResponse = cbAssertionBuffer;
            // pbEncodedResponse must contain a CBOR encoded response as specified the FIDO CTAP.
            // Refer: https://fidoalliance.org/specs/fido-v2.0-ps-20190130/fido-client-to-authenticator-protocol-v2.0-ps-20190130.html#message-encoding.
            operationResponse->pbEncodedResponse = wil::make_unique_cotaskmem<BYTE[]>(cbAssertionBuffer).release();
            memcpy_s(
                operationResponse->pbEncodedResponse,
                operationResponse->cbEncodedResponse,
                pbAssertionBuffer,
                cbAssertionBuffer);

            *response = operationResponse.release();
            SetEvent(App::s_hPluginOpCompletedEvent.get());
            return S_OK;
        }
        catch (...)
        {
            HRESULT localHr = wil::ResultFromCaughtException();
            {
                winrt::com_ptr<App> curApp = winrt::Microsoft::UI::Xaml::Application::Current().as<App>();
                std::lock_guard<std::mutex> lock(curApp->m_pluginOperationOptionsMutex);
                curApp->m_pluginOperationStatus.performOperationStatus = localHr;
            }
            SetEvent(App::s_hPluginOpCompletedEvent.get());
            return localHr;
        }
    }

    /*
    * This function is invoked by the platform to request the plugin to cancel an ongoing operation.
    */
    HRESULT STDMETHODCALLTYPE ContosoPlugin::EXPERIMENTAL_PluginCancelOperation(
        /* [out] */ __RPC__in EXPERIMENTAL_PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST)
    {
        SetEvent(App::s_pluginOpRequestRecievedEvent.get());
        com_ptr<App> curApp = winrt::Microsoft::UI::Xaml::Application::Current().as<App>();
        curApp->GetDispatcherQueue().TryEnqueue([curApp]()
            {
                curApp->PluginCancelAction();
            });
        return S_OK;
    }

    /*
    * This is a sample implementation of a factory method that creates an instance of the Class that implements the EXPERIMENTAL_IPluginAuthenticator interface.
    * Refer: pluginauthenticator.h/pluginauthenticator.idl for the interface definition.
    */
    HRESULT __stdcall ContosoPluginFactory::CreateInstance(
        ::IUnknown* outer,
        GUID const& iid,
        void** result) noexcept
    {
        *result = nullptr;

        if (outer)
        {
            return CLASS_E_NOAGGREGATION;
        }

        try
        {
            return make<ContosoPlugin>()->QueryInterface(iid, result);
        }
        catch (...)
        {
            return winrt::to_hresult();
        }
    }

    HRESULT __stdcall ContosoPluginFactory::LockServer(BOOL) noexcept
    {
        return S_OK;
    }

}
