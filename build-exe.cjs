const packager = require('electron-packager');
const path = require('path');

async function build() {
  try {
    const appPaths = await packager({
      dir: __dirname,
      name: 'DistroPulse-ERP',
      platform: 'win32',
      arch: 'x64',
      out: path.join(__dirname, 'dist-desktop-app'),
      overwrite: true,
      asar: true
    });
    console.log('BUILD_SUCCESSFUL:', appPaths);
  } catch (err) {
    console.error('BUILD_FAILED:', err);
  }
}

build();
