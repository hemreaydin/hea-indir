const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const { extensionId } = require('./extension-config.json');
const hostName = 'com.hea.indir';
async function installNativeHost({ resources, userData }) {
  const executable = path.join(resources, 'native', 'hea-native.exe');
  await fs.access(executable);
  await fs.mkdir(userData, { recursive: true });
  const manifest = path.join(userData, 'native-host.json');
  await fs.writeFile(manifest, JSON.stringify({ name: hostName, description: 'hea-indir arka plan bağlantısı', path: executable, type: 'stdio', allowed_origins: [`chrome-extension://${extensionId}/`] }, null, 2));
  const reg = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
  await execFile(reg, ['add', `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`, '/ve', '/t', 'REG_SZ', '/d', manifest, '/f'], { windowsHide: true });
  return 'Bağlantı kuruldu. Chrome eklentisindeki AÇIK / KAPALI anahtarını kullanabilirsin.';
}
module.exports = { installNativeHost };
