import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('secureOS', {
  fs: {
    readFile: (appId: string, filePath: string) => ipcRenderer.invoke('fs:readFile', appId, filePath),
    writeFile: (appId: string, filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', appId, filePath, content),
    mkdir: (appId: string, dirPath: string) => ipcRenderer.invoke('fs:mkdir', appId, dirPath),
    ls: (appId: string, dirPath: string) => ipcRenderer.invoke('fs:ls', appId, dirPath),
    rm: (appId: string, filePath: string) => ipcRenderer.invoke('fs:rm', appId, filePath)
  },
  system: {
    registerApp: (appId: string, capabilities: string[]) => ipcRenderer.invoke('system:registerApp', appId, capabilities)
  },
  terminal: {
    spawn: (id: string) => ipcRenderer.invoke('pty:spawn', id),
    write: (id: string, data: string) => ipcRenderer.invoke('pty:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('pty:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('pty:kill', id),
    onData: (id: string, callback: (data: string) => void) => {
      const channel = `pty:data:${id}`;
      // Strip event, just pass data to callback
      const listener = (event: any, data: string) => callback(data);
      ipcRenderer.on(channel, listener);
      return () => {
        ipcRenderer.removeListener(channel, listener);
      };
    }
  }
});
