const path = require('path');

// signAndEditExecutable is off in package.json, which also skips electron-builder's own rcedit step, so the app exe
// would keep Electron's default icon (shortcuts, Task Manager, taskbar). Embed ours with the standalone rcedit package.
// rcedit is ESM-only, hence the dynamic import.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { rcedit } = await import('rcedit');
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  await rcedit(exe, { icon: path.join(context.packager.projectDir, 'build', 'icon.ico') });
};
