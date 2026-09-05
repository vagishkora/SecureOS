export {};

declare global {
  interface Window {
    secureOS: {
      fs: {
        readFile: (appId: string, filePath: string) => Promise<string>;
        writeFile: (appId: string, filePath: string, content: string) => Promise<boolean>;
        mkdir: (appId: string, dirPath: string) => Promise<boolean>;
        ls: (appId: string, dirPath: string) => Promise<{name: string, type: 'file' | 'directory', path: string}[]>;
        rm: (appId: string, filePath: string) => Promise<boolean>;
      };
      system: {
        registerApp: (appId: string, capabilities: string[]) => Promise<void>;
      };
      terminal: {
        spawn: (id: string) => Promise<void>;
        write: (id: string, data: string) => Promise<void>;
        resize: (id: string, cols: number, rows: number) => Promise<void>;
        kill: (id: string) => Promise<void>;
        onData: (id: string, callback: (data: string) => void) => () => void;
      };
    };
  }
}
