using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

namespace DistroPulseInstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string tempDir = Path.Combine(Path.GetTempPath(), "DistroPulse_Setup_" + Guid.NewGuid().ToString("N"));

            try
            {
                Directory.CreateDirectory(tempDir);

                // Extract embedded zip payload
                string zipPath = Path.Combine(tempDir, "payload.zip");
                Assembly assembly = Assembly.GetExecutingAssembly();
                using (Stream stream = assembly.GetManifestResourceStream("payload.zip"))
                {
                    if (stream == null)
                    {
                        MessageBox.Show("Installer payload missing in setup executable!", "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        return;
                    }
                    using (FileStream fs = new FileStream(zipPath, FileMode.Create))
                    {
                        stream.CopyTo(fs);
                    }
                }

                // Extract zip content
                ZipFile.ExtractToDirectory(zipPath, tempDir);

                // Target install directory
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string installDir = Path.Combine(appData, "Programs", "DistroPulse ERP");

                if (Directory.Exists(installDir))
                {
                    try { Directory.Delete(installDir, true); } catch { }
                }
                Directory.CreateDirectory(installDir);

                // Copy extracted files to install directory
                CopyDirectory(tempDir, installDir);

                // Find main executable in install directory
                string mainExe = Path.Combine(installDir, "DistroPulse-ERP.exe");
                if (!File.Exists(mainExe))
                {
                    string altExe = Path.Combine(installDir, "distributor-billing-stock-app.exe");
                    if (File.Exists(altExe))
                    {
                        File.Move(altExe, mainExe);
                    }
                    else
                    {
                        string electronExe = Path.Combine(installDir, "electron.exe");
                        if (File.Exists(electronExe))
                        {
                            File.Move(electronExe, mainExe);
                        }
                    }
                }

                if (!File.Exists(mainExe))
                {
                    // Fallback search any .exe in installDir root
                    string[] exes = Directory.GetFiles(installDir, "*.exe");
                    if (exes.Length > 0)
                    {
                        mainExe = exes[0];
                    }
                }

                if (!File.Exists(mainExe))
                {
                    MessageBox.Show("Could not locate application executable after copy.", "Installation Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // Create Desktop Shortcut
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string desktopShortcut = Path.Combine(desktop, "DistroPulse ERP.lnk");
                CreateShortcut(desktopShortcut, mainExe);

                // Create Start Menu Shortcut
                string startMenu = Environment.GetFolderPath(Environment.SpecialFolder.StartMenu);
                string startShortcut = Path.Combine(startMenu, "Programs", "DistroPulse ERP.lnk");
                CreateShortcut(startShortcut, mainExe);

                // Register in Windows Control Panel (Add/Remove Programs)
                try
                {
                    using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\DistroPulseERP"))
                    {
                        if (key != null)
                        {
                            key.SetValue("DisplayName", "DistroPulse ERP - Distributor Billing & Stock Manager");
                            key.SetValue("DisplayIcon", mainExe);
                            key.SetValue("InstallLocation", installDir);
                            key.SetValue("Publisher", "DistroPulse Team");
                            key.SetValue("UninstallString", "cmd /c rmdir /s /q \"" + installDir + "\" & reg delete HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\DistroPulseERP /f");
                        }
                    }
                }
                catch { }

                // Launch App
                Process.Start(mainExe);

                MessageBox.Show("DistroPulse ERP has been successfully installed on your computer!\n\nA shortcut has been created on your Desktop.", "Installation Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);

                // Cleanup temp
                try { Directory.Delete(tempDir, true); } catch { }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Installation failed: " + ex.Message, "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                try { Directory.Delete(tempDir, true); } catch { }
            }
        }

        static void CopyDirectory(string sourceDir, string targetDir)
        {
            Directory.CreateDirectory(targetDir);
            foreach (string file in Directory.GetFiles(sourceDir))
            {
                string filename = Path.GetFileName(file);
                if (filename.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) continue;
                File.Copy(file, Path.Combine(targetDir, filename), true);
            }
            foreach (string subDir in Directory.GetDirectories(sourceDir))
            {
                CopyDirectory(subDir, Path.Combine(targetDir, Path.GetFileName(subDir)));
            }
        }

        static void CreateShortcut(string shortcutPath, string targetPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic shortcut = shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = Path.GetDirectoryName(targetPath);
                shortcut.IconLocation = targetPath + ",0";
                shortcut.Save();
            }
            catch { }
        }
    }
}
