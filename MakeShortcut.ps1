$Shell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$StartMenuPath = [System.Environment]::GetFolderPath('StartMenu') + '\Programs'
$ExePath = [System.Environment]::GetFolderPath('LocalApplicationData') + '\Programs\DistroPulse ERP\DistroPulse ERP.exe'

# Remove old shortcut if exists
if (Test-Path "$DesktopPath\DistroPulse ERP.lnk") {
    Remove-Item "$DesktopPath\DistroPulse ERP.lnk" -Force
}

$DesktopShortcut = $Shell.CreateShortcut("$DesktopPath\DistroPulse ERP.lnk")
$DesktopShortcut.TargetPath = $ExePath
$DesktopShortcut.IconLocation = "$ExePath,0"
$DesktopShortcut.Save()

$StartShortcut = $Shell.CreateShortcut("$StartMenuPath\DistroPulse ERP.lnk")
$StartShortcut.TargetPath = $ExePath
$StartShortcut.IconLocation = "$ExePath,0"
$StartShortcut.Save()

Write-Host "SHORTCUT_RECREATED_SUCCESSFULLY"
