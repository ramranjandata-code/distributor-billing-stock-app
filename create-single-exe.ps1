$PackageDir = "C:\Users\Administrator\.gemini\antigravity\scratch\distributor_billing_stock_app\DistroPulse-ERP-Setup-Package"
$OutExe = "C:\Users\Administrator\.gemini\antigravity\scratch\distributor_billing_stock_app\DistroPulse-ERP-Setup.exe"
$SedFile = "C:\Users\Administrator\.gemini\antigravity\scratch\distributor_billing_stock_app\iexpress_config.sed"

# Collect all files recursively
$allFiles = Get-ChildItem -Path $PackageDir -Recurse -File

# Group by directory
$groups = $allFiles | Group-Object DirectoryName

$sedHeader = @"
[Version]
Class=IExpress
SEDVersion=3.0
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=1
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=$OutExe
FriendlyName=DistroPulse ERP Setup Installer
AppLaunched=cmd /c Setup-DistroPulse-ERP.bat
PostInstallCmd=<None>
AdminQuietInstCmd=<None>
UserQuietInstCmd=<None>
SourceFiles=SourceFiles
[Strings]
InstallPrompt=Do you want to install DistroPulse ERP on this computer?
DisplayLicense=
FinishMessage=DistroPulse ERP setup completed successfully!
[SourceFiles]
"@

$sourceFilesSec = ""
$fileSections = ""

$i = 0
foreach ($group in $groups) {
    $dirName = $group.Name
    $secName = "SourceFiles$i"
    $sedHeader += "$secName=$dirName\`r`n"
    
    $fileSections += "[$secName]`r`n"
    foreach ($f in $group.Group) {
        $fileName = $f.Name
        $fileSections += "%FILE$i`_$fileName%=$fileName`r`n"
    }
    $i++
}

$finalSed = $sedHeader + "`r`n" + $fileSections

Set-Content -Path $SedFile -Value $finalSed -Encoding ASCII

Write-Host "SED file generated. Compiling with IExpress..."
