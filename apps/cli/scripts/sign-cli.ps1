

function SignExe {
        param (
        [Parameter(Mandatory=$true)]
        [ValidateScript({![string]::IsNullOrEmpty($_)})]
        [string]$vaultUrl,

        [Parameter(Mandatory=$false)]
        [ValidateScript({![string]::IsNullOrEmpty($_)})]
        [string]$accessToken,

        [Parameter(Mandatory=$false)]
        [ValidateScript({![string]::IsNullOrEmpty($_)})]
        [string]$certName,

        [Parameter(Mandatory=$false)]
        [ValidateScript({Test-Path $_})]
        [string] $exePath,

        # [Parameter(Mandatory=$false)]
        # [string] $hashAlgorithm, # -fd option

        # [Parameter(Mandatory=$false)]
        # [string] $site, # -du option

        [Parameter(Mandatory=$false)]
        [string] $timestampService = "http://timestamp.digicert.com"
    )

    echo "Signing $exePath ..."
    azuresigntool sign -kvu $vaultUrl -kva $accessToken -kvc $certName -tr $timestampService $exePath
}


SignExe -vaultUrl $env:SIGNING_VAULT_URL -accessToken $env:SIGNING_ACCESS_TOKEN -certName $env:SIGNING_CERT_NAME -exePath $env:EXE_PATH
