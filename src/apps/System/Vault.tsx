import React, { useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';
import { ls, encryptedRead, encryptedWrite, mkdir } from '../../fs/operations';
import { FSNode } from '../../fs/types';
import { Lock, FileText, Plus, Save, Key, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const APP_ID = 'vault';

const VaultApp = () => {
  const [password, setPassword] = useState('');
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);
  
  const [notes, setNotes] = useState<FSNode[]>([]);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize vault dir
  useEffect(() => {
    if (!sessionPassword) return;
    const initVault = async () => {
      try {
        await ls(APP_ID, '/vault');
      } catch (e: any) {
        if (e.code === 'NOT_FOUND') {
          await mkdir(APP_ID, '/vault');
        }
      }
      await refreshNotes();
    };
    initVault();
  }, [sessionPassword]);

  const refreshNotes = async () => {
    try {
      const children = await ls(APP_ID, '/vault');
      setNotes(children.filter(c => c.type === 'file'));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length > 0) {
      setSessionPassword(password);
      setError(null);
    }
  };

  const openNote = async (name: string) => {
    try {
      if (!sessionPassword) return;
      const res = await encryptedRead(APP_ID, `/vault/${name}`, sessionPassword);
      setActiveNote(name);
      setActiveContent(res.content);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const createNote = async () => {
    const name = prompt('Note name (e.g. secret.txt):');
    if (!name) return;
    if (!sessionPassword) return;
    
    try {
      await encryptedWrite(APP_ID, `/vault/${name}`, '', sessionPassword);
      setActiveNote(name);
      setActiveContent('');
      await refreshNotes();
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const saveNote = async () => {
    if (!activeNote || !sessionPassword) return;
    try {
      await encryptedWrite(APP_ID, `/vault/${activeNote}`, activeContent, sessionPassword);
      setError(null);
      alert('Saved securely.');
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!sessionPassword) {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center p-4">
        <Key className="w-12 h-12 text-yellow-500 mb-4" />
        <h2 className="text-yellow-500 font-mono text-xl mb-6 tracking-widest uppercase">Secure Vault</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full max-w-xs">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Vault Master Password"
            className="bg-yellow-950/20 border border-yellow-700/50 text-yellow-500 px-4 py-2 rounded focus:outline-none focus:border-yellow-500 font-mono text-sm placeholder:text-yellow-700/50"
            autoFocus
          />
          <button type="submit" className="bg-yellow-900/40 hover:bg-yellow-900/80 text-yellow-500 border border-yellow-700/50 px-4 py-2 rounded font-mono text-sm transition-colors uppercase tracking-wider">
            Unlock
          </button>
        </form>
        {error && <div className="mt-4 text-red-500 font-mono text-sm">{error}</div>}
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black flex text-yellow-500 font-mono text-sm">
      {/* Sidebar */}
      <div className="w-48 border-r border-yellow-900/50 flex flex-col">
        <div className="p-3 border-b border-yellow-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-widest">
            <Lock className="w-4 h-4" />
            VAULT
          </div>
          <button onClick={createNote} className="hover:text-yellow-300 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 flex flex-col gap-1">
          {notes.map(note => (
            <button
              key={note.id}
              onClick={() => openNote(note.name)}
              className={clsx(
                "flex items-center gap-2 p-2 rounded text-left transition-colors",
                activeNote === note.name ? "bg-yellow-900/40 text-yellow-300" : "hover:bg-yellow-950/40 text-yellow-700"
              )}
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span className="truncate">{note.name}</span>
            </button>
          ))}
          {notes.length === 0 && <div className="text-yellow-900/50 p-2 text-xs text-center">No notes</div>}
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="bg-red-900/20 border-b border-red-500/30 p-2 text-red-500 flex items-center gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        
        {activeNote ? (
          <>
            <div className="p-3 border-b border-yellow-900/50 flex items-center justify-between bg-yellow-950/10">
              <span className="font-bold">{activeNote}</span>
              <button 
                onClick={saveNote}
                className="flex items-center gap-2 text-yellow-600 hover:text-yellow-400 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Encrypt & Save</span>
              </button>
            </div>
            <textarea
              value={activeContent}
              onChange={e => setActiveContent(e.target.value)}
              className="flex-1 w-full bg-transparent p-4 resize-none outline-none text-yellow-100 placeholder:text-yellow-900/50"
              placeholder="Write your secure note here..."
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-yellow-900/50">
            Select or create a note
          </div>
        )}
      </div>
    </div>
  );
};

const roots = new Map<string, Root>();

export const Vault: AppDefinition = {
  manifest: {
    appId: APP_ID,
    name: 'Vault',
    icon: 'Shield',
    capabilities: ['fs:read', 'fs:write'],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<VaultApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
