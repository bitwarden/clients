#include "pch.h"
#include "MainPage.xaml.h"
#include "PluginRegistrationManager.h"
#include <CorError.h>

namespace winrt::PasskeyManager::implementation {
    PluginRegistrationManager::PluginRegistrationManager() :
        m_pluginRegistered(false),
        m_initialized(false),
        m_pluginState(EXPERIMENTAL_PLUGIN_AUTHENTICATOR_STATE::PluginAuthenticatorState_Unknown)
    {
        Initialize();
        m_webAuthnDll.reset(LoadLibraryExW(L"webauthn.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32));
    }

    PluginRegistrationManager::~PluginRegistrationManager()
    {
    }

    HRESULT PluginRegistrationManager::Initialize()
    {
        HRESULT hr = RefreshPluginState();
        RETURN_HR_IF_EXPECTED(S_OK, RefreshPluginState() == NTE_NOT_FOUND);
        RETURN_HR(hr);
    }

    HRESULT PluginRegistrationManager::RegisterPlugin()
    {
        // Get the function pointer of WebAuthNPluginAddAuthenticator
        auto webAuthNPluginAddAuthenticator = GetProcAddressByFunctionDeclaration(
            m_webAuthnDll.get(),
            EXPERIMENTAL_WebAuthNPluginAddAuthenticator);
        RETURN_HR_IF_NULL(E_FAIL, webAuthNPluginAddAuthenticator);

        /*
        * This section creates a sample authenticatorInfo blob to include in the registration
        * request. This blob must CBOR encoded using the format defined
        * in https://fidoalliance.org/specs/fido-v2.0-ps-20190130/fido-client-to-authenticator-protocol-v2.0-ps-20190130.html#authenticatorGetInfo
        *
        * 'AAGUID' maybe used to fetch information about the authenticator from the FIDO Metadata Service and other sources.
        * Refer: https://fidoalliance.org/metadata/
        *
        * 'extensions' field is used to perform feature detection on the authenticator
        * and maybe used to determine if the authenticator is filtered out.
        */
        std::string tempAaguidStr{ c_pluginAaguid };
        tempAaguidStr.erase(std::remove(tempAaguidStr.begin(), tempAaguidStr.end(), L'-'), tempAaguidStr.end());
        std::transform(tempAaguidStr.begin(), tempAaguidStr.end(), tempAaguidStr.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
        // The following hex strings represent the encoding of
        // {1: ["FIDO_2_0", "FIDO_2_1"], 2: ["prf", "hmac-secret"], 3: h'/* AAGUID */', 4: {"rk": true, "up": true, "uv": true}, 
        // 9: ["internal"], 10: [{"alg": -7, "type": "public-key"}]}
        std::string authenticatorInfoStrPart1 = "A60182684649444F5F325F30684649444F5F325F310282637072666B686D61632D7365637265740350";
        std::string authenticatorInfoStrPart2 = "04A362726BF5627570F5627576F5098168696E7465726E616C0A81A263616C672664747970656A7075626C69632D6B6579";
        std::string fullAuthenticatorInfoStr = authenticatorInfoStrPart1 + tempAaguidStr + authenticatorInfoStrPart2;
        std::vector<BYTE> authenticatorInfo = hexStringToBytes(fullAuthenticatorInfoStr);

        // Validate that c_pluginClsid is a valid CLSID
        CLSID CLSID_ContosoPluginAuthenticator;
        RETURN_IF_FAILED(CLSIDFromString(c_pluginClsid, &CLSID_ContosoPluginAuthenticator));

        EXPERIMENTAL_WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS addOptions{};
        addOptions.pwszAuthenticatorName = c_pluginName;
        addOptions.pwszPluginRpId = c_pluginRpId;
        addOptions.pwszPluginClsId = c_pluginClsid;
        addOptions.pbAuthenticatorInfo = authenticatorInfo.data();
        addOptions.cbAuthenticatorInfo = static_cast<DWORD>(authenticatorInfo.size());

        EXPERIMENTAL_PWEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_RESPONSE addResponse;
        RETURN_IF_FAILED(webAuthNPluginAddAuthenticator(&addOptions, &addResponse));

        // The response from plugin contains the public key used to sign plugin operation requests. Stash it for later use.
        wil::unique_hkey hKey;
        RETURN_IF_WIN32_ERROR(RegCreateKeyEx(
            HKEY_CURRENT_USER,
            c_pluginRegistryPath,
            0,
            nullptr,
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            nullptr,
            &hKey,
            nullptr));

        RETURN_IF_WIN32_ERROR(RegSetValueEx(
            hKey.get(),
            c_windowsPluginRequestSigningKeyRegKeyName,
            0,
            REG_BINARY,
            addResponse->pbOpSignPubKey,
            addResponse->cbOpSignPubKey));
        return S_OK;
    }

    HRESULT PluginRegistrationManager::UnregisterPlugin()
    {
        // Get the function pointer of WebAuthNPluginRemoveAuthenticator
        auto webAuthNPluginRemoveAuthenticator = GetProcAddressByFunctionDeclaration(
            m_webAuthnDll.get(),
            EXPERIMENTAL_WebAuthNPluginRemoveAuthenticator);
        RETURN_HR_IF_NULL(E_FAIL, webAuthNPluginRemoveAuthenticator);

        RETURN_HR(webAuthNPluginRemoveAuthenticator(c_pluginClsid));
    }

    HRESULT PluginRegistrationManager::RefreshPluginState()
    {
        // Reset the plugin state and registration status
        m_pluginRegistered = false;
        m_pluginState = EXPERIMENTAL_PLUGIN_AUTHENTICATOR_STATE::PluginAuthenticatorState_Unknown;

        // Get handle to EXPERIMENTAL_WebAuthNPluginGetAuthenticatorState which takes in a GUID and returns EXPERIMENTAL_PLUGIN_AUTHENTICATOR_STATE
        auto webAuthNPluginGetAuthenticatorState = GetProcAddressByFunctionDeclaration(
            m_webAuthnDll.get(),
            EXPERIMENTAL_WebAuthNPluginGetAuthenticatorState);
        RETURN_HR_IF_NULL(E_FAIL, webAuthNPluginGetAuthenticatorState);

        // Get the plugin state
        EXPERIMENTAL_PLUGIN_AUTHENTICATOR_STATE localPluginState;
        RETURN_IF_FAILED(webAuthNPluginGetAuthenticatorState(c_pluginClsid, &localPluginState));

        // If the EXPERIMENTAL_WebAuthNPluginGetAuthenticatorState function succeeded, that indicates the plugin is registered and localPluginState is the valid plugin state
        m_pluginRegistered = true;
        m_pluginState = localPluginState;
        return S_OK;
    }
}