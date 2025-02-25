

function SignExe {
        param (
        [Parameter(Mandatory=$true)]
        [ValidateScript({![string]::IsNullOrEmpty($_)})]
        [string]$vaultUrl,

        [Parameter(Mandatory=$false)]
        [ValidateScript({![string]::IsNullOrEmpty($_)})]
        [string]$clientId,

        [Parameter(Mandatory=$false)]
        [ValidateScript({![string]::IsNullOrEmpty($_)})]
        [string]$tenantId,

        [Parameter(Mandatory=$false)]
        [ValidateScript({![string]::IsNullOrEmpty($_)})]
        [string]$clientSecret,

        [Parameter(Mandatory=$false)]
        [ValidateScript({![string]::IsNullOrEmpty($_)})]
        [string]$certName,

        [Parameter(Mandatory=$false)]
        [ValidateScript({Test-Path $_})]
        [string] $exePath
    )

    echo "Signing $exePath ..."
    azuresigntool sign -v $vaultUrl -kvi $clientId -kvt $tenantId -kvs $clientSecret -kvc $certName -tr http://timestamp.digicert.com $exePath
}


SignExe -vaultUrl $env:SIGNING_VAULT_URL -clientId $env:SIGNING_CLIENT_ID -tenantId $env:SIGNING_TENANT_ID -clientSecret $env:SIGNING_CLIENT_SECRET -certName $env:SIGNING_CERT_NAME -exePath $env:EXE_PATH
