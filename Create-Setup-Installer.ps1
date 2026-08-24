$SourceApp = "C:\Users\Administrator\.gemini\antigravity\scratch\distributor_billing_stock_app\dist-exe-setup\win-unpacked"
$TargetInstaller = "C:\Users\Administrator\.gemini\antigravity\scratch\distributor_billing_stock_app\DistroPulse-ERP-Setup-Package"

# 1. Ensure target directory exists
New-Item -ItemType Directory -Force -Path "$TargetInstaller\files" | Out-Null

# 2. Copy compiled app files
Copy-Item -Path "$SourceApp\*" -Destination "$TargetInstaller\files" -Recurse -Force

# 3. Create Windows Setup Wizard Batch
$SetupCmd = @"
@echo off
title DistroPulse ERP - Windows App Setup Installer
color 0A
cls
echo ===================================================================
echo             DistroPulse ERP - Windows Setup Installer
echo ===================================================================
echo.
echo Installing DistroPulse ERP into Windows PC...
echo Target Directory: %LOCALAPPDATA%\Programs\DistroPulse ERP
echo.

if not exist "%LOCALAPPDATA%\Programs\DistroPulse ERP" mkdir "%LOCALAPPDATA%\Programs\DistroPulse ERP"

echo [1/3] Copying application files...
xcopy "%~dp0files\*" "%LOCALAPPDATA%\Programs\DistroPulse ERP\" /E /Y /I /Q >nul

echo [2/3] Registering Windows Start Menu & Desktop Shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command "`$w = New-Object -ComObject WScript.Shell; `$s = `$w.CreateShortcut([System.Environment]::GetFolderPath('Desktop') + '\DistroPulse ERP.lnk'); `$s.TargetPath = [System.Environment]::GetFolderPath('LocalApplicationData') + '\Programs\DistroPulse ERP\distributor-billing-stock-app.exe'; `$s.IconLocation = [System.Environment]::GetFolderPath('LocalApplicationData') + '\Programs\DistroPulse ERP\distributor-billing-stock-app.exe,0'; `$s.Save()"
powershell -NoProfile -ExecutionPolicy Bypass -Command "`$w = New-Object -ComObject WScript.Shell; `$s = `$w.CreateShortcut([System.Environment]::GetFolderPath('StartMenu') + '\Programs\DistroPulse ERP.lnk'); `$s.TargetPath = [System.Environment]::GetFolderPath('LocalApplicationData') + '\Programs\DistroPulse ERP\distributor-billing-stock-app.exe'; `$s.IconLocation = [System.Environment]::GetFolderPath('LocalApplicationData') + '\Programs\DistroPulse ERP\distributor-billing-stock-app.exe,0'; `$s.Save()"

echo [3/3] Registering App in Windows Control Panel (Add/Remove Programs)...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DistroPulseERP" /v "DisplayName" /d "DistroPulse ERP - Distributor Billing & Stock Manager" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DistroPulseERP" /v "DisplayIcon" /d "%LOCALAPPDATA%\Programs\DistroPulse ERP\distributor-billing-stock-app.exe" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DistroPulseERP" /v "InstallLocation" /d "%LOCALAPPDATA%\Programs\DistroPulse ERP" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DistroPulseERP" /v "Publisher" /d "DistroPulse Team" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DistroPulseERP" /v "UninstallString" /d "cmd /c rmdir /s /q \"%LOCALAPPDATA%\Programs\DistroPulse ERP\" & reg delete HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DistroPulseERP /f" /f >nul

echo.
echo ===================================================================
echo     🎉 Installation Successful! DistroPulse ERP is installed!
echo ===================================================================
echo.
echo Launching DistroPulse ERP...
timeout /t 2 >nul
start "" "%LOCALAPPDATA%\Programs\DistroPulse ERP\distributor-billing-stock-app.exe"
exit
"@

Set-Content -Path "$TargetInstaller\Setup-DistroPulse-ERP.bat" -Value $SetupCmd -Encoding ASCII

Write-Host "SETUP_PACKAGE_CREATED_SUCCESSFULLY at $TargetInstaller"
