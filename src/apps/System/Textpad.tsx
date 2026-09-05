import React, { useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';

const TextpadApp = () => {
  const [text, setText] = useState('');

  return (
    <div className="h-full w-full dark:bg-black bg-white flex flex-col font-sans">
      <div className="border-b dark:border-slate-800 border-slate-200 p-2 flex gap-2 dark:bg-slate-900 bg-slate-100">
        <button className="text-xs px-2 py-1 rounded dark:hover:bg-slate-800 hover:bg-slate-300 dark:text-slate-300 text-slate-700">File</button>
        <button className="text-xs px-2 py-1 rounded dark:hover:bg-slate-800 hover:bg-slate-300 dark:text-slate-300 text-slate-700">Edit</button>
        <button className="text-xs px-2 py-1 rounded dark:hover:bg-slate-800 hover:bg-slate-300 dark:text-slate-300 text-slate-700">Format</button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 w-full p-4 resize-none focus:outline-none dark:bg-black bg-white dark:text-slate-200 text-slate-800 font-mono text-sm"
        placeholder="Type here..."
      />
    </div>
  );
};

const roots = new Map<string, Root>();

export const Textpad: AppDefinition = {
  manifest: {
    appId: 'textpad',
    name: 'Textpad',
    icon: 'FileText',
    capabilities: [],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<TextpadApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
