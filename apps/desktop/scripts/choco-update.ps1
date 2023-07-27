param (
    [Parameter(Mandatory=$true)]
    [string] $version
)

# To run:
# .\choco-update.ps1 -version 1.3.0

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path;
$rootDir = $dir + "\..";
$distDir = $rootDir + "\dist";
$chocoDir = $rootDir + "\stores\chocolatey";
$distChocoDir = $distDir + "\chocolatey";

if(Test-Path -Path $distChocoDir) {
  Remove-Item -Recurse -Force $distChocoDir
}

Copy-Item -Path $chocoDir -Destination $distChocoDir –Recurse

$exe = $distChocoDir + "\Bitwarden-Installer-" + $version + ".exe";
$uri = "https://github.com/MichaelLykkeStrand/usteam-clients/releases/download/desktop-v" + $version + "/Bitwarden-Installer-" + $version + ".exe";
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-RestMethod -Uri $uri -OutFile $exe

$checksum = checksum -t sha256 $exe
$nuspec = $distChocoDir + "\bitwarden.nuspec";
$chocoInstall = $distChocoDir + "\tools\chocolateyinstall.ps1";

(Get-Content $chocoInstall).replace('__version__', $version).replace('__checksum__', $checksum) | Set-Content $chocoInstall
choco pack $nuspec --version $version --out $distChocoDir
cd $distChocoDir
choco push
cd $rootDir
