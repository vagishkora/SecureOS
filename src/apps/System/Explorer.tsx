import React, { useEffect, useState, useMemo } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';
import { ls, verifyIntegrity, mv, rm, cp, chmod, mkdir, stat } from '../../fs/operations';
import { FSNode, FSPermissions } from '../../fs/types';
import { 
  Folder, FileText, AlertTriangle, Edit2, Copy, Scissors, ClipboardPaste, Trash2, 
  HardDrive, ChevronRight, ArrowUp, LayoutGrid, List, AlignJustify, Plus,
  ShieldAlert, Settings, File, FolderLock, ShieldCheck, CheckSquare, Square
} from 'lucide-react';
import { ContextMenu } from '../../desktop/ContextMenu';
import clsx from 'clsx';

interface NodeWithIntegrity extends FSNode {
  isValid?: boolean;
}

type ViewMode = 'list' | 'grid' | 'details';
type SortBy = 'name' | 'date' | 'size' | 'type';
type SortDirection = 'asc' | 'desc';

// --- Properties Dialog Component ---
const PropertiesDialog: React.FC<{
  node: FSNode;
  path: string;
  onClose: () => void;
  onPermissionsChange: (perms: FSPermissions) => void;
}> = ({ node, path, onClose, onPermissionsChange }) => {
  const [tab, setTab] = useState<'general' | 'security'>('general');
  const [perms, setPerms] = useState<FSPermissions>(node.permissions);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const PermissionRow = ({ scope, label }: { scope: 'owner' | 'group' | 'other', label: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-green-900/30">
      <div className="text-green-500 font-bold w-20">{label}</div>
      <div className="flex gap-4">
        {(['read', 'write', 'execute'] as const).map(p => (
          <label key={p} className="flex items-center gap-1 cursor-pointer">
            <input 
              type="checkbox" 
              checked={perms[scope][p]} 
              onChange={(e) => setPerms({
                ...perms,
                [scope]: { ...perms[scope], [p]: e.target.checked }
              })}
              className="hidden"
            />
            {perms[scope][p] ? <CheckSquare className="w-4 h-4 text-green-400" /> : <Square className="w-4 h-4 text-green-900" />}
            <span className="text-xs text-green-600 uppercase">{p[0]}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4">
      <div className="w-[400px] bg-black border border-green-500/50 rounded shadow-2xl flex flex-col font-mono">
        <div className="p-2 bg-green-900/20 border-b border-green-500/30 flex justify-between items-center cursor-default">
          <div className="text-xs font-bold text-green-400 flex items-center gap-2">
            {node.type === 'directory' ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            {node.name} Properties
          </div>
          <button onClick={onClose} className="text-green-600 hover:text-red-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="flex border-b border-green-900/50 bg-black">
          <button 
            className={clsx("px-4 py-2 text-xs", tab === 'general' ? "border-b-2 border-green-500 text-green-400" : "text-green-700")}
            onClick={() => setTab('general')}
          >General</button>
          <button 
            className={clsx("px-4 py-2 text-xs", tab === 'security' ? "border-b-2 border-green-500 text-green-400" : "text-green-700")}
            onClick={() => setTab('security')}
          >Security</button>
        </div>

        <div className="p-4 flex-1 text-sm bg-black">
          {tab === 'general' && (
            <div className="flex flex-col gap-3 text-green-600">
              <div className="flex items-center gap-4 pb-4 border-b border-green-900/30">
                {node.type === 'directory' ? <Folder className="w-12 h-12 text-green-500" /> : <FileText className="w-12 h-12 text-green-500" />}
                <input 
                  type="text" 
                  value={node.name} 
                  readOnly 
                  className="bg-green-900/20 border border-green-900 rounded px-2 py-1 text-green-400 w-full outline-none"
                />
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                <span className="opacity-70">Type:</span>
                <span className="text-green-400">{node.type === 'directory' ? 'File Folder' : 'File'}</span>
                
                <span className="opacity-70">Location:</span>
                <span className="text-green-400 truncate">{path}</span>
                
                <span className="opacity-70">Size:</span>
                <span className="text-green-400">{formatBytes(node.content.length)}</span>
                
                <div className="col-span-2 border-t border-green-900/30 my-1" />
                
                <span className="opacity-70">Created:</span>
                <span className="text-green-400">{new Date(node.createdAt).toLocaleString()}</span>
                
                <span className="opacity-70">Modified:</span>
                <span className="text-green-400">{new Date(node.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-green-600 mb-2">Object Name: <span className="text-green-400">{path}</span></div>
              <div className="border border-green-900/50 p-2 rounded bg-green-900/10">
                <PermissionRow scope="owner" label="Owner" />
                <PermissionRow scope="group" label="Group" />
                <PermissionRow scope="other" label="Other" />
              </div>
              <div className="text-[10px] text-green-700 mt-2">
                <ShieldAlert className="w-3 h-3 inline mr-1" />
                Changes to permissions may affect system stability and app access.
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-black flex justify-end gap-2 border-t border-green-900/50">
          {tab === 'security' && (
            <button 
              onClick={() => { onPermissionsChange(perms); onClose(); }}
              className="px-4 py-1 text-xs bg-green-900/50 hover:bg-green-800 text-green-400 border border-green-500/50 rounded transition-colors"
            >
              Apply
            </button>
          )}
          <button 
            onClick={onClose}
            className="px-4 py-1 text-xs hover:bg-green-900/30 text-green-600 border border-transparent rounded transition-colors"
          >
            {tab === 'security' ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Explorer Component ---
const ExplorerApp = () => {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [nodes, setNodes] = useState<NodeWithIntegrity[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Views and Sorting
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  
  // Interactions
  const [clipboard, setClipboard] = useState<{ path: string; action: 'copy' | 'cut' } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; node: FSNode | null }>({ isOpen: false, x: 0, y: 0, node: null });
  const [propertiesNode, setPropertiesNode] = useState<FSNode | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        setStorage({ usage: estimate.usage || 0, quota: estimate.quota || 0 });
      });
    }
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadDir = async () => {
    try {
      const children = await ls('explorer', currentPath);
      
      const withIntegrity = await Promise.all(
        children.map(async (node) => {
          if (node.type === 'directory') return node;
          try {
            const isValid = await verifyIntegrity('explorer', currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`);
            return { ...node, isValid };
          } catch {
            return { ...node, isValid: false };
          }
        })
      );
      
      setNodes(withIntegrity);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadDir();
  }, [currentPath]);

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      // Folders always first
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      
      let res = 0;
      switch (sortBy) {
        case 'name': res = a.name.localeCompare(b.name); break;
        case 'date': res = a.updatedAt - b.updatedAt; break;
        case 'size': res = (a.content?.length || 0) - (b.content?.length || 0); break;
        case 'type': res = a.type.localeCompare(b.type); break;
      }
      return sortDir === 'asc' ? res : -res;
    });
  }, [nodes, sortBy, sortDir]);

  const handleNavigateUp = () => {
    if (currentPath !== '/') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      setCurrentPath('/' + parts.join('/'));
    }
  };

  const handleBreadcrumbNavigate = (index: number) => {
    if (index === -1) {
      setCurrentPath('/');
    } else {
      const parts = currentPath.split('/').filter(Boolean);
      const newPath = '/' + parts.slice(0, index + 1).join('/');
      setCurrentPath(newPath);
    }
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, node: FSNode) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      path: currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`,
      type: node.type
    }));
  };

  const handleDrop = async (e: React.DragEvent, targetNode: FSNode) => {
    e.preventDefault();
    if (targetNode.type !== 'directory') return;
    
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    
    try {
      const { path: sourcePath } = JSON.parse(data);
      const targetPath = currentPath === '/' ? `/${targetNode.name}` : `${currentPath}/${targetNode.name}`;
      const sourceName = sourcePath.split('/').pop();
      
      if (sourcePath && targetPath && sourcePath !== targetPath) {
        await mv('explorer', sourcePath, `${targetPath}/${sourceName}`);
        loadDir();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // Formatting
  const formatPerms = (node: FSNode) => {
    const p = node.permissions;
    const formatBlock = (block: any) => 
      `${block.read ? 'r' : '-'}${block.write ? 'w' : '-'}${block.execute ? 'x' : '-'}`;
    return `${node.type === 'directory' ? 'd' : '-'}${formatBlock(p.owner)}${formatBlock(p.group)}${formatBlock(p.other)}`;
  };

  // Actions
  const handlePaste = async () => {
    if (!clipboard) return;
    try {
      const sourceName = clipboard.path.split('/').pop();
      const destPath = currentPath === '/' ? `/${sourceName}` : `${currentPath}/${sourceName}`;
      
      if (clipboard.path === destPath) return;
      
      if (clipboard.action === 'copy') await cp('explorer', clipboard.path, destPath);
      else {
        await mv('explorer', clipboard.path, destPath);
        setClipboard(null);
      }
      loadDir();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (node: FSNode) => {
    try {
      const path = currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`;
      try {
        await ls('explorer', '/RecycleBin');
        await mv('explorer', path, `/RecycleBin/${node.name}`, path);
      } catch {
        await rm('explorer', path);
      }
      loadDir();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRename = async (node: FSNode, newName: string) => {
    setEditingNodeId(null);
    if (newName === node.name || !newName) return;
    try {
      const path = currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`;
      const newPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
      await mv('explorer', path, newPath);
      loadDir();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleNewFolder = async () => {
    try {
      let baseName = 'New Folder';
      let name = baseName;
      let counter = 1;
      const existingNames = new Set(nodes.map(n => n.name));
      while (existingNames.has(name)) {
        name = `${baseName} (${counter++})`;
      }
      const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      await mkdir('explorer', path);
      loadDir();
      
      // Auto-focus rename
      const newNode = (await ls('explorer', currentPath)).find(n => n.name === name);
      if (newNode) {
        setEditingNodeId(newNode.id);
        setEditName(name);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChmod = async (node: FSNode, perms: FSPermissions) => {
    try {
      const path = currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`;
      await chmod('explorer', path, perms);
      loadDir();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Renderers
  const renderNodeList = () => (
    <div className="flex flex-col text-sm">
      <div className="grid grid-cols-[3fr_1fr_1fr_1fr] px-2 py-1 text-xs text-green-700 border-b border-green-900/50 sticky top-0 bg-black z-10">
        <div className="cursor-pointer hover:text-green-500" onClick={() => { setSortBy('name'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>Name</div>
        <div className="cursor-pointer hover:text-green-500" onClick={() => { setSortBy('date'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>Modified</div>
        <div className="cursor-pointer hover:text-green-500" onClick={() => { setSortBy('size'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>Size</div>
        <div className="cursor-pointer hover:text-green-500" onClick={() => { setSortBy('type'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }}>Permissions</div>
      </div>
      {sortedNodes.map(node => (
        <div 
          key={node.id} 
          onClick={() => { if (node.type === 'directory' && !editingNodeId) setCurrentPath(currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, node }); }}
          className={clsx(
            "grid grid-cols-[3fr_1fr_1fr_1fr] items-center px-2 py-1.5 transition-colors group",
            node.type === 'directory' ? "cursor-pointer hover:bg-green-900/40" : "hover:bg-green-900/20",
            editingNodeId === node.id && "bg-green-900/40"
          )}
          draggable={!editingNodeId}
          onDragStart={(e) => handleDragStart(e, node)}
          onDrop={node.type === 'directory' ? (e) => handleDrop(e, node) : undefined}
          onDragOver={node.type === 'directory' ? handleDragOver : undefined}
        >
          <div className="flex items-center gap-2 truncate pr-4">
            {node.type === 'directory' ? <Folder className="w-4 h-4 text-green-600 shrink-0" /> : <FileText className="w-4 h-4 text-green-700 shrink-0" />}
            
            {editingNodeId === node.id ? (
              <input
                autoFocus
                className="flex-1 bg-black text-green-400 border border-green-500 rounded px-1 outline-none"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleRename(node, editName)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(node, editName); if (e.key === 'Escape') setEditingNodeId(null); }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={clsx("truncate", node.type === 'directory' ? 'text-green-300 font-bold' : 'text-green-500', node.isValid === false && 'text-red-500 line-through', clipboard?.path === (currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`) && clipboard.action === 'cut' && 'opacity-50')}>
                {node.name}
              </span>
            )}
            
            {node.isValid === false && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" title="Integrity Fault" />}
          </div>
          <div className="text-xs text-green-700">{new Date(node.updatedAt).toLocaleDateString()}</div>
          <div className="text-xs text-green-700">{node.type === 'file' ? formatBytes(node.content.length) : '--'}</div>
          <div className="text-xs text-green-700 opacity-50 group-hover:opacity-100 tracking-widest">{formatPerms(node)}</div>
        </div>
      ))}
    </div>
  );

  const renderGrid = () => (
    <div className="flex flex-wrap gap-4 p-2 content-start">
      {sortedNodes.map(node => (
        <div
          key={node.id}
          onClick={() => { if (node.type === 'directory' && !editingNodeId) setCurrentPath(currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, node }); }}
          className={clsx(
            "flex flex-col items-center justify-center w-24 h-24 gap-2 rounded transition-colors group",
            node.type === 'directory' ? "cursor-pointer hover:bg-green-900/40" : "hover:bg-green-900/20",
            editingNodeId === node.id && "bg-green-900/40"
          )}
          draggable={!editingNodeId}
          onDragStart={(e) => handleDragStart(e, node)}
          onDrop={node.type === 'directory' ? (e) => handleDrop(e, node) : undefined}
          onDragOver={node.type === 'directory' ? handleDragOver : undefined}
        >
          {node.type === 'directory' ? <Folder className="w-10 h-10 text-green-600" /> : <FileText className="w-10 h-10 text-green-700" />}
          {editingNodeId === node.id ? (
            <input
              autoFocus
              className="w-full bg-black text-green-400 border border-green-500 rounded px-1 text-center outline-none text-xs"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(node, editName)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(node, editName); if (e.key === 'Escape') setEditingNodeId(null); }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={clsx("text-xs text-center truncate w-full px-1", node.type === 'directory' ? 'text-green-300 font-bold' : 'text-green-500', node.isValid === false && 'text-red-500 line-through', clipboard?.path === (currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`) && clipboard.action === 'cut' && 'opacity-50')}>
              {node.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div 
      className="h-full w-full bg-black text-green-400 font-mono text-sm flex outline-none selection:bg-green-500/30"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'v' && (e.ctrlKey || e.metaKey)) handlePaste(); }}
      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, node: null }); }}
    >
      {/* Sidebar */}
      <div className="w-48 shrink-0 flex flex-col gap-4 border-r border-green-900/50 p-2 bg-black/90">
        <div className="flex flex-col gap-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-green-700 px-2 mt-2 mb-1">Quick Access</div>
          <button onClick={() => setCurrentPath('/')} className={clsx("flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left text-xs", currentPath === '/' ? "bg-green-900/40 text-green-400" : "hover:bg-green-900/20 text-green-600")}>
            <Folder className="w-4 h-4 text-green-500" /> This PC
          </button>
          <button onClick={() => setCurrentPath('/vault')} className={clsx("flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left text-xs", currentPath.startsWith('/vault') ? "bg-green-900/40 text-green-400" : "hover:bg-green-900/20 text-green-600")}>
            <FolderLock className="w-4 h-4 text-purple-500" /> Vault
          </button>
        </div>

        <div className="mt-auto pb-2 px-2">
          {storage && (
            <div className="bg-green-900/10 p-3 rounded border border-green-900/30">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-green-500">
                <HardDrive className="w-3 h-3" />
                DISK USAGE
              </div>
              <div className="h-1.5 w-full bg-green-900/30 rounded overflow-hidden mb-2">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%` }} />
              </div>
              <div className="text-[10px] text-green-700 flex justify-between">
                <span>{formatBytes(storage.usage)} used</span>
                <span>{formatBytes(storage.quota)} total</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-black">
        
        {/* Header / Topbar */}
        <div className="h-12 border-b border-green-900/50 flex items-center px-4 justify-between bg-black/90">
          <div className="flex items-center gap-2 overflow-hidden">
            <button 
              onClick={handleNavigateUp}
              disabled={currentPath === '/'}
              className="p-1 text-green-600 hover:text-green-400 disabled:opacity-30 transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 overflow-hidden ml-2 text-xs">
              <button 
                onClick={() => handleBreadcrumbNavigate(-1)}
                className="hover:text-green-300 transition-colors truncate max-w-[100px]"
              >
                Local Disk
              </button>
              {currentPath.split('/').filter(Boolean).map((segment, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3 text-green-800" />
                  <button 
                    onClick={() => handleBreadcrumbNavigate(idx)}
                    className="hover:text-green-300 transition-colors truncate max-w-[100px]"
                  >
                    {segment}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 border-l border-green-900/50 pl-2">
            <button onClick={() => setViewMode('list')} className={clsx("p-1.5 rounded transition-colors", viewMode === 'list' ? "bg-green-900/40 text-green-400" : "text-green-700 hover:text-green-500")} title="List View"><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('details')} className={clsx("p-1.5 rounded transition-colors", viewMode === 'details' ? "bg-green-900/40 text-green-400" : "text-green-700 hover:text-green-500")} title="Details View"><AlignJustify className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('grid')} className={clsx("p-1.5 rounded transition-colors", viewMode === 'grid' ? "bg-green-900/40 text-green-400" : "text-green-700 hover:text-green-500")} title="Grid View"><LayoutGrid className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto relative">
          {error && <div className="absolute top-2 left-2 right-2 bg-red-900/80 text-red-100 p-2 text-xs rounded border border-red-500 flex justify-between items-center z-20">
            <span>{error}</span>
            <button onClick={() => setError(null)}><Scissors className="w-4 h-4 rotate-45" /></button>
          </div>}

          {viewMode === 'grid' ? renderGrid() : renderNodeList()}
          {nodes.length === 0 && <div className="p-8 text-center text-green-900/50 text-xs italic">This folder is empty.</div>}
        </div>
      </div>

      <ContextMenu 
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
        options={contextMenu.node ? [
          { label: 'Cut', icon: <Scissors className="w-4 h-4" />, onClick: () => setClipboard({ path: currentPath === '/' ? `/${contextMenu.node!.name}` : `${currentPath}/${contextMenu.node!.name}`, action: 'cut' }) },
          { label: 'Copy', icon: <Copy className="w-4 h-4" />, onClick: () => setClipboard({ path: currentPath === '/' ? `/${contextMenu.node!.name}` : `${currentPath}/${contextMenu.node!.name}`, action: 'copy' }) },
          { separator: true, label: '', onClick: () => {} },
          { label: 'Rename', icon: <Edit2 className="w-4 h-4" />, onClick: () => { setEditingNodeId(contextMenu.node!.id); setEditName(contextMenu.node!.name); } },
          { label: 'Delete', icon: <Trash2 className="w-4 h-4 text-red-400" />, onClick: () => handleDelete(contextMenu.node!) },
          { separator: true, label: '', onClick: () => {} },
          { label: 'Properties', icon: <Settings className="w-4 h-4" />, onClick: () => setPropertiesNode(contextMenu.node!) },
        ] : [
          { label: 'Paste', icon: <ClipboardPaste className="w-4 h-4" />, onClick: handlePaste },
          { label: 'New Folder', icon: <Plus className="w-4 h-4" />, onClick: handleNewFolder },
        ]}
      />

      {propertiesNode && (
        <PropertiesDialog 
          node={propertiesNode} 
          path={currentPath === '/' ? `/${propertiesNode.name}` : `${currentPath}/${propertiesNode.name}`}
          onClose={() => setPropertiesNode(null)}
          onPermissionsChange={(perms) => handleChmod(propertiesNode, perms)}
        />
      )}
    </div>
  );
};

const roots = new Map<string, Root>();

export const Explorer: AppDefinition = {
  manifest: {
    appId: 'explorer',
    name: 'File Explorer',
    icon: 'Folder',
    capabilities: ['fs:read', 'fs:write'],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<ExplorerApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
