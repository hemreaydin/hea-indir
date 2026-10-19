const { contextBridge, ipcRenderer } = require('electron');
const channels = new Set(['state', 'clipboard', 'add', 'defaults', 'theme', 'options', 'start', 'cancel', 'remove', 'clear', 'choose-folder', 'folder', 'show-file', 'source', 'health', 'update', 'browser-enabled', 'browser-pair', 'browser-code-copy', 'browser-folder']);
contextBridge.exposeInMainWorld('hea', {
  call: async (name, ...args) => {
    if (!channels.has(name)) throw new Error('Geçersiz işlem.');
    const result = await ipcRenderer.invoke('hea:' + name, ...args);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  },
  onState: callback => { const listener = (_event, data) => callback(data); ipcRenderer.on('hea:state', listener); return () => ipcRenderer.removeListener('hea:state', listener); },
  onNotice: callback => { const listener = (_event, text) => callback(text); ipcRenderer.on('hea:notice', listener); return () => ipcRenderer.removeListener('hea:notice', listener); }
});
