import React, { useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';

const CalculatorApp = () => {
  const [display, setDisplay] = useState('0');
  
  const handleNum = (n: string) => {
    setDisplay(prev => prev === '0' ? n : prev + n);
  };
  const handleClear = () => setDisplay('0');
  
  const handleEval = () => {
    try {
      // eslint-disable-next-line
      setDisplay(String(eval(display)));
    } catch (e) {
      setDisplay('Error');
    }
  };

  return (
    <div className="h-full w-full dark:bg-slate-900 bg-slate-50 flex flex-col p-4 font-sans">
      <div className="bg-white dark:bg-black p-4 rounded-lg text-right text-3xl font-mono mb-4 border dark:border-slate-800 dark:text-white text-black overflow-hidden shadow-inner">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-2 flex-1">
        {['7','8','9','/','4','5','6','*','1','2','3','-','C','0','=','+'].map(btn => (
          <button 
            key={btn}
            onClick={() => {
              if (btn === 'C') handleClear();
              else if (btn === '=') handleEval();
              else handleNum(btn);
            }}
            className="dark:bg-slate-800 bg-slate-200 hover:opacity-80 rounded-lg text-xl font-medium dark:text-white text-black transition-opacity"
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
};

const roots = new Map<string, Root>();

export const Calculator: AppDefinition = {
  manifest: {
    appId: 'calculator',
    name: 'Calculator',
    icon: 'Hash', // lucide-react Hash
    capabilities: [],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<CalculatorApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
