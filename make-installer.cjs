const electronInstaller = require('electron-installer-windows');
const path = require('path');

async function main() {
  console.log('Generating DistroPulse-ERP-Setup.exe installer...');
  try {
    await electronInstaller({
      src: path.join(__dirname, 'dist', 'win-unpacked'),
      dest: path.join(__dirname, 'DistroPulse-Setup-Output'),
      name: 'DistroPulseERP',
      productName: 'DistroPulse ERP',
      productDescription: 'Distributor Billing & Stock ERP Desktop Application'
    });
    console.log('WINDOWS_INSTALLER_CREATED_SUCCESSFULLY!');
  } catch (err) {
    console.error('BUILD_ERROR:', err);
  }
}

main();
