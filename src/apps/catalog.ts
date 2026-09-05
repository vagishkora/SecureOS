import { Explorer } from './System/Explorer';
import { Terminal } from './System/Terminal';
import { Vault } from './System/Vault';
import { SecurityCenter } from './System/SecurityCenter';
import { NetworkMonitor } from './System/NetworkMonitor';
import { Assistant } from './System/Assistant';
import { Settings } from './System/Settings';
import { Browser } from './System/Browser';
import { AppStore } from './System/AppStore';
import { Calculator } from './System/Calculator';
import { Textpad } from './System/Textpad';
import { TaskManager } from './System/TaskManager';

export const CORE_APPS = [
  Explorer,
  Terminal,
  Vault,
  Settings,
  AppStore, // Crucial: Store must be pre-installed!
  TaskManager
];

// These are all apps the OS knows about (for dynamic loading)
export const APP_CATALOG = [
  Explorer,
  Terminal,
  Vault,
  SecurityCenter,
  NetworkMonitor,
  Assistant,
  Settings,
  Browser,
  AppStore,
  Calculator,
  Textpad,
  TaskManager
];
