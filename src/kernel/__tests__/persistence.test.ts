import { describe, it, expect, beforeEach } from 'vitest';
import { kernelStore, createKernelStore } from '../store';
import { clearAuditLogDB, saveKernelState, loadKernelState, clearKernelStateDB, idbSettingsStorage } from '../idb';
import { appendLog, getLog, initAuditLog } from '../audit';
import { WindowState } from '../types';

describe('OS Persistence across reloads', () => {
  beforeEach(async () => {
    await clearAuditLogDB();
    await clearKernelStateDB();
    await idbSettingsStorage.removeItem('secureos-settings');
    kernelStore.getState()._reset();
  });

  it('saves and restores window positions and processes via IDB', async () => {
    const store = kernelStore.getState();
    store.registerApp({ appId: 'test-app', name: 'Test', capabilities: [] });
    
    // Launch process
    const process = store.launchProcess('test-app', 'win-123');
    expect(process).toBeDefined();
    
    // Simulate window drag stop
    const mockState: WindowState = {
      x: 500,
      y: 600,
      width: 800,
      height: 600,
      isMinimized: false,
      snapState: 'left'
    };
    store.updateWindowState('win-123', mockState);

    // Give IDB time to write (async)
    await new Promise(r => setTimeout(r, 50));

    // Simulate "Page Refresh" - Clear in-memory state
    store._reset();
    expect(kernelStore.getState().processes.size).toBe(0);

    // Call boot sequence
    await kernelStore.getState().initKernelState();

    // Verify recovery
    const recoveredStore = kernelStore.getState();
    expect(recoveredStore.processes.size).toBe(1);
    
    const recoveredProcess = Array.from(recoveredStore.processes.values())[0];
    expect(recoveredProcess.windowId).toBe('win-123');
    expect(recoveredProcess.windowState).toEqual(mockState);
  });

  it('saves and restores audit ledger via IDB', async () => {
    await appendLog({
      timestamp: 1000,
      actor: 'user',
      action: 'process:launch',
      resource: 'vault',
      outcome: 'success'
    });

    // Give IDB time to write
    await new Promise(r => setTimeout(r, 50));

    // Simulate Page Refresh
    // To clear log in memory we would normally call clearLog(), which handles the write queue.
    // However, since we want to simulate a pure page reload, we'll just initialize it from IDB.
    
    // The previous state is already written. Let's load it.
    await initAuditLog();

    const log = getLog();
    expect(log.length).toBe(1);
    expect(log[0].resource).toBe('vault');
    expect(log[0].action).toBe('process:launch');
    expect(log[0].hash).toBeDefined();
  });
});
