import React, { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { AppDefinition } from '../registry';
import { ls, readFile, mkdir, chmod, verifyIntegrity, writeFile, rm, mv, cp } from '../../fs/operations';
import { FSError } from '../../fs/errors';
import { kernelStore } from '../../kernel';

const APP_ID = 'terminal';

const TerminalApp = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cwd, setCwd] = useState('/');

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#000000',
        foreground: '#22c55e',
        cursor: '#22c55e'
      },
      fontFamily: 'monospace',
      fontSize: 14,
      cursorBlink: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    
    // Slight delay to ensure container has dimensions before fitting
    setTimeout(() => fitAddon.fit(), 100);

    // Resize observer to keep terminal fitted
    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);

    term.writeln('SecureOS v0.1.0 Shell');
    
    if (window.secureOS) {
      // Connect to node-pty backend
      const terminalId = `term-${crypto.randomUUID()}`;
      window.secureOS.terminal.spawn(terminalId);

      const cleanupDataListener = window.secureOS.terminal.onData(terminalId, (data: string) => {
        term.write(data);
      });

      term.onData((data) => {
        window.secureOS.terminal.write(terminalId, data);
      });

      term.onResize((size) => {
        window.secureOS.terminal.resize(terminalId, size.cols, size.rows);
      });

      return () => {
        cleanupDataListener();
        window.secureOS.terminal.kill(terminalId);
        resizeObserver.disconnect();
        term.dispose();
      };
    } else {
      // Fallback: Simulated mock shell
      term.writeln('Type "help" for a list of commands.');
      term.write(`\r\n${cwd} $ `);

      let inputBuf = '';
      let currentCwd = cwd;

      const resolvePath = (p: string) => {
        if (p.startsWith('/')) return p;
        if (currentCwd === '/') return '/' + p;
        return currentCwd + '/' + p;
      };

      const handleCommand = async (cmdString: string) => {
        const args = cmdString.trim().split(/\s+/);
        const cmd = args[0];
        if (!cmd) return;

        try {
          switch (cmd) {
            case 'help':
              term.writeln('Available commands:');
              term.writeln('  ls [path]       - List directory contents');
              term.writeln('  cd <path>       - Change directory');
              term.writeln('  pwd             - Print working directory');
              term.writeln('  cat <file>      - Read file contents');
              term.writeln('  mkdir <dir>     - Create directory');
              term.writeln('  touch <file>    - Create empty file');
              term.writeln('  rm <path>       - Remove file or directory');
              term.writeln('  mv <src> <dest> - Move/rename file or directory');
              term.writeln('  cp <src> <dest> - Copy file or directory');
              term.writeln('  chmod <path>    - Change permissions (syntax: rwxrwxrwx)');
              term.writeln('  echo <text>     - Print text');
              term.writeln('  date            - Print current date and time');
              term.writeln('  whoami          - Print current user / app ID');
              term.writeln('  hash <file>     - Verify integrity hash');
              term.writeln('  scan <dir>      - Recursively find world-writable files');
              term.writeln('  clear           - Clear terminal');
              break;

            case 'clear':
              term.clear();
              break;

            case 'whoami':
              term.writeln(APP_ID);
              break;
              
            case 'pwd':
              term.writeln(currentCwd);
              break;
              
            case 'date':
              term.writeln(new Date().toString());
              break;
              
            case 'echo':
              term.writeln(args.slice(1).join(' '));
              break;

            case 'ls': {
              const path = args[1] ? resolvePath(args[1]) : currentCwd;
              const nodes = await ls(APP_ID, path);
              if (nodes.length === 0) break;
              
              // Format: type perms name
              nodes.forEach(node => {
                const p = node.permissions;
                const formatBlock = (b: any) => `${b.read?'r':'-'}${b.write?'w':'-'}${b.execute?'x':'-'}`;
                const pStr = `${node.type==='directory'?'d':'-'}${formatBlock(p.owner)}${formatBlock(p.group)}${formatBlock(p.other)}`;
                term.writeln(`${pStr}  ${node.name}`);
              });
              break;
            }

            case 'cd': {
              const path = resolvePath(args[1] || '/');
              // Verify it's a directory by listing it
              await ls(APP_ID, path);
              currentCwd = path;
              setCwd(path);
              break;
            }

            case 'cat': {
              if (!args[1]) throw new Error('Usage: cat <file>');
              const result = await readFile(APP_ID, resolvePath(args[1]));
              term.writeln(result.content);
              break;
            }

            case 'mkdir': {
              if (!args[1]) throw new Error('Usage: mkdir <dir>');
              await mkdir(APP_ID, resolvePath(args[1]));
              break;
            }
            
            case 'touch': {
              if (!args[1]) throw new Error('Usage: touch <file>');
              await writeFile(APP_ID, resolvePath(args[1]), '');
              break;
            }
            
            case 'rm': {
              if (!args[1]) throw new Error('Usage: rm <path>');
              await rm(APP_ID, resolvePath(args[1]));
              break;
            }
            
            case 'mv': {
              if (args.length < 3) throw new Error('Usage: mv <src> <dest>');
              await mv(APP_ID, resolvePath(args[1]), resolvePath(args[2]));
              break;
            }
            
            case 'cp': {
              if (args.length < 3) throw new Error('Usage: cp <src> <dest>');
              await cp(APP_ID, resolvePath(args[1]), resolvePath(args[2]));
              break;
            }

            case 'hash': {
              if (!args[1]) throw new Error('Usage: hash <file>');
              const valid = await verifyIntegrity(APP_ID, resolvePath(args[1]));
              term.writeln(valid ? '\x1b[32mOK (Hash Match)\x1b[0m' : '\x1b[31mTAMPERED (Hash Mismatch)\x1b[0m');
              break;
            }

            case 'chmod': {
              if (args.length < 3) throw new Error('Usage: chmod <path> <rwxrwxrwx>');
              const path = resolvePath(args[1]);
              const p = args[2];
              if (p.length !== 9) throw new Error('Format must be exactly 9 chars, e.g. rwxr-xr-x');
              
              const parseBlock = (str: string) => ({
                read: str[0] === 'r',
                write: str[1] === 'w',
                execute: str[2] === 'x'
              });

              await chmod(APP_ID, path, {
                owner: parseBlock(p.slice(0,3)),
                group: parseBlock(p.slice(3,6)),
                other: parseBlock(p.slice(6,9))
              });
              break;
            }

            case 'scan': {
              const startPath = args[1] ? resolvePath(args[1]) : currentCwd;
              term.writeln(`Scanning ${startPath} for world-writable files...`);
              
              const walk = async (dirPath: string) => {
                const children = await ls(APP_ID, dirPath);
                for (const child of children) {
                  const childPath = dirPath === '/' ? `/${child.name}` : `${dirPath}/${child.name}`;
                  if (child.permissions.other.write) {
                    term.writeln(`\x1b[31m[WARNING] World-writable: ${childPath}\x1b[0m`);
                  }
                  if (child.type === 'directory') {
                    await walk(childPath);
                  }
                }
              };
              await walk(startPath);
              term.writeln('Scan complete.');
              break;
            }

            default:
              term.writeln(`Command not found: ${cmd}`);
          }
        } catch (err: any) {
          term.writeln(`\x1b[31m${err.message || String(err)}\x1b[0m`);
        }
      };

      term.onData(async (e) => {
        if (e === '\r' || e === '\n' || e === '\r\n') {
          term.write('\r\n');
          await handleCommand(inputBuf);
          inputBuf = '';
          term.write(`\r\n${currentCwd} $ `);
        } else if (e === '\u007F' || e === '\b') {
          if (inputBuf.length > 0) {
            inputBuf = inputBuf.slice(0, -1);
            term.write('\b \b');
          }
        } else if (e.startsWith('\x1b')) {
          // Ignore escape sequences (e.g. arrow keys) for this simple mock shell
          return;
        } else {
          inputBuf += e;
          term.write(e);
        }
      });

      return () => {
        resizeObserver.disconnect();
        term.dispose();
      };
    }
  }, []);

  return (
    <div className="h-full w-full dark:bg-black bg-slate-50 p-2" ref={containerRef} />
  );
};

const roots = new Map<string, Root>();

export const Terminal: AppDefinition = {
  manifest: {
    appId: APP_ID,
    name: 'Terminal',
    icon: 'Terminal',
    capabilities: ['fs:read', 'fs:write', 'fs:execute', 'system:process'],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<TerminalApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
