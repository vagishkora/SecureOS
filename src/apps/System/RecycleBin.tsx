import React, { useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';
import { ls, mv, rm } from '../../fs/operations';
import { FSNode } from '../../fs/types';
import { Trash2, FileText, Folder, RefreshCw, AlertTriangle } from 'lucide-react';
import { ContextMenu } from '../../desktop/ContextMenu';
import clsx from 'clsx';

const RecycleBinApp = () => {
  const [nodes, setNodes] = useState<FSNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; node: FSNode | null }>({ isOpen: false, x: 0, y: 0, node: null });

  const loadBin = async () => {
    try {
      const children = await ls('recycle_bin', '/RecycleBin');
      setNodes(children);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadBin();
  }, []);

  const handleRestore = async (node: FSNode) => {
    try {
      if (!node.originalPath) {
        throw new Error("No original path recorded for restoration.");
      }
      
      const destName = node.originalPath.split('/').pop();
      const parentPath = node.originalPath.substring(0, node.originalPath.lastIndexOf('/')) || '/';
      
      await mv('recycle_bin', `/RecycleBin/${node.name}`, `${parentPath}/${destName}`);
      loadBin();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmpty = async () => {
    try {
      for (const node of nodes) {
        await rm('recycle_bin', `/RecycleBin/${node.name}`);
      }
      loadBin();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div 
      className="h-full w-full dark:bg-black bg-white dark:text-red-400 text-red-700 p-4 font-mono text-sm overflow-auto"
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, node: null });
      }}
      onClick={() => setContextMenu({ ...contextMenu, isOpen: false })}
    >
      <div className="flex justify-between items-center mb-4 border-b dark:border-red-900/50 border-red-200 pb-2">
        <div className="text-red-500 font-bold flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Recycle Bin
        </div>
        <button 
          onClick={handleEmpty}
          disabled={nodes.length === 0}
          className="text-xs px-2 py-1 rounded bg-red-900/20 text-red-500 hover:bg-red-900/40 transition-colors disabled:opacity-50"
        >
          Empty Bin
        </button>
      </div>
      
      {error && <div className="text-red-500 mb-4 bg-red-900/20 p-2 rounded border border-red-500/30">{error}</div>}

      {nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 opacity-50">
          <Trash2 className="w-12 h-12 mb-2" />
          <span>Bin is empty</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {nodes.map(node => (
            <div 
              key={node.id} 
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, node });
              }}
              className="flex items-center gap-4 p-2 rounded transition-colors dark:hover:bg-red-900/20 hover:bg-red-50"
            >
              {node.type === 'directory' ? (
                <Folder className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-red-700 shrink-0" />
              )}
              
              <div className="flex-1 flex flex-col">
                <span className="font-bold truncate">{node.name}</span>
                <span className="text-[10px] opacity-60 truncate">Original: {node.originalPath || 'Unknown'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ContextMenu 
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
        options={contextMenu.node ? [
          { label: 'Restore', icon: <RefreshCw className="w-4 h-4" />, onClick: () => handleRestore(contextMenu.node!) },
          { label: 'Delete Permanently', icon: <AlertTriangle className="w-4 h-4 text-red-500" />, onClick: () => rm('recycle_bin', `/RecycleBin/${contextMenu.node!.name}`).then(loadBin) },
        ] : [
          { label: 'Empty Recycle Bin', icon: <Trash2 className="w-4 h-4 text-red-500" />, onClick: handleEmpty },
        ]}
      />
    </div>
  );
};

const roots = new Map<string, Root>();

export const RecycleBin: AppDefinition = {
  manifest: {
    appId: 'recycle_bin',
    name: 'Recycle Bin',
    icon: 'Trash2',
    capabilities: ['fs:read', 'fs:write'],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<RecycleBinApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
