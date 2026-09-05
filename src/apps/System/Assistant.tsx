import React, { useState, useRef, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AppDefinition } from '../registry';
import { kernelStore } from '../../kernel';
import { readFile, writeFile } from '../../fs/operations';
import { Bot, Key, Send, ShieldAlert, Check, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Capability } from '../../kernel/types';

const APP_ID = 'ai';

interface Message {
  role: 'user' | 'assistant';
  content: string | any[];
}

interface PendingPermission {
  capability: Capability;
  toolCall: any;
  resolve: (granted: boolean) => void;
}

const tools = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the virtual filesystem.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the virtual filesystem.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content']
    }
  },
  {
    name: 'open_app',
    description: 'Launch an application by its appId.',
    input_schema: {
      type: 'object',
      properties: { appId: { type: 'string' } },
      required: ['appId']
    }
  }
];

const AssistantApp = () => {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPerm, setPendingPerm] = useState<PendingPermission | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);
  const pendingPermRef = useRef<PendingPermission | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (pendingPermRef.current) {
        pendingPermRef.current.resolve(false);
      }
    };
  }, []);

  useEffect(() => {
    pendingPermRef.current = pendingPerm;
  }, [pendingPerm]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingPerm]);

  const handleSetKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      setHasKey(true);
      setMessages([{ role: 'assistant', content: 'SecureOS Assistant initialized. How can I help?' }]);
    }
  };

  const checkAndRequestCapability = async (cap: Capability, toolCall: any): Promise<boolean> => {
    // Already have it?
    if (kernelStore.getState().requestCapability(APP_ID, cap)) return true;
    
    // Otherwise, pause and ask user
    return new Promise((resolve) => {
      setPendingPerm({ capability: cap, toolCall, resolve });
    });
  };

  const executeTool = async (toolCall: any) => {
    const { name, input } = toolCall;
    try {
      if (name === 'read_file') {
        const granted = await checkAndRequestCapability('fs:read', toolCall);
        if (!granted) return { type: 'tool_result', tool_use_id: toolCall.id, content: 'User denied fs:read capability.', is_error: true };
        const res = await readFile(APP_ID, input.path);
        return { type: 'tool_result', tool_use_id: toolCall.id, content: res.content };
      }
      if (name === 'write_file') {
        const granted = await checkAndRequestCapability('fs:write', toolCall);
        if (!granted) return { type: 'tool_result', tool_use_id: toolCall.id, content: 'User denied fs:write capability.', is_error: true };
        await writeFile(APP_ID, input.path, input.content);
        return { type: 'tool_result', tool_use_id: toolCall.id, content: `Successfully wrote to ${input.path}` };
      }
      if (name === 'open_app') {
        const granted = await checkAndRequestCapability('system:process', toolCall);
        if (!granted) return { type: 'tool_result', tool_use_id: toolCall.id, content: 'User denied system:process capability.', is_error: true };
        const winId = `win-${crypto.randomUUID().slice(0,8)}`;
        const proc = kernelStore.getState().launchProcess(input.appId, winId);
        if (proc) return { type: 'tool_result', tool_use_id: toolCall.id, content: `Launched ${input.appId}` };
        return { type: 'tool_result', tool_use_id: toolCall.id, content: `Failed to launch ${input.appId}. Is it registered?`, is_error: true };
      }
      return { type: 'tool_result', tool_use_id: toolCall.id, content: `Unknown tool: ${name}`, is_error: true };
    } catch (e: any) {
      return { type: 'tool_result', tool_use_id: toolCall.id, content: `Error: ${e.message}`, is_error: true };
    }
  };

  const callAnthropic = async (msgs: Message[]) => {
    setIsLoading(true);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: msgs,
          tools
        })
      });
      
      const data = await res.json();
      if (!isMounted.current) return;

      if (data.error) throw new Error(data.error.message);
      
      const nextMsgs = [...msgs, { role: 'assistant', content: data.content } as Message];
      setMessages(nextMsgs);
      
      if (data.stop_reason === 'tool_use') {
        const toolUses = data.content.filter((c: any) => c.type === 'tool_use');
        const toolResults = [];
        
        for (const call of toolUses) {
          if (!isMounted.current) break;
          const res = await executeTool(call);
          toolResults.push(res);
        }
        
        if (!isMounted.current) return;
        
        // Feed results back
        const finalMsgs = [...nextMsgs, { role: 'user', content: toolResults } as Message];
        setMessages(finalMsgs);
        await callAnthropic(finalMsgs);
      }
    } catch (e: any) {
      if (isMounted.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error communicating with Claude: ${e.message}` }]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || pendingPerm) return;
    
    const nextMsgs = [...messages, { role: 'user', content: input.trim() } as Message];
    setMessages(nextMsgs);
    setInput('');
    await callAnthropic(nextMsgs);
  };

  const handlePermResponse = (granted: boolean) => {
    if (pendingPerm) {
      if (granted) {
        kernelStore.getState().grantCapability(APP_ID, pendingPerm.capability);
      }
      pendingPerm.resolve(granted);
      setPendingPerm(null);
    }
  };

  if (!hasKey) {
    return (
      <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center p-4">
        <Bot className="w-12 h-12 text-purple-500 mb-4" />
        <h2 className="text-purple-400 font-mono text-xl mb-6 tracking-widest uppercase text-center">
          SecureOS AI Assistant
        </h2>
        <form onSubmit={handleSetKey} className="flex flex-col gap-4 w-full max-w-sm">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Anthropic API Key (sk-ant-...)"
            className="bg-purple-950/20 border border-purple-700/50 text-purple-300 px-4 py-2 rounded focus:outline-none focus:border-purple-500 font-mono text-sm placeholder:text-purple-700/50"
            autoFocus
          />
          <button type="submit" className="bg-purple-900/40 hover:bg-purple-900/80 text-purple-300 border border-purple-700/50 px-4 py-2 rounded font-mono text-sm transition-colors uppercase tracking-wider">
            Initialize Assistant
          </button>
        </form>
        <p className="mt-4 text-purple-900/50 text-xs font-mono text-center max-w-sm">
          Key is stored in-memory only. The assistant runs in a sandbox and will request permission before taking privileged actions.
        </p>
      </div>
    );
  }

  const renderContent = (content: any) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((c, i) => {
        if (c.type === 'text') return <div key={i}>{c.text}</div>;
        if (c.type === 'tool_use') return (
          <div key={i} className="my-2 p-2 bg-purple-950/30 border border-purple-900/50 rounded text-xs font-mono">
            <span className="text-purple-400 font-bold">TOOL CALL:</span> {c.name}({JSON.stringify(c.input)})
          </div>
        );
        if (c.type === 'tool_result') return (
          <div key={i} className={clsx("my-2 p-2 border rounded text-xs font-mono", c.is_error ? "bg-red-950/30 border-red-900/50 text-red-400" : "bg-green-950/30 border-green-900/50 text-green-400")}>
            <span className="font-bold">TOOL RESULT:</span> {c.content}
          </div>
        );
        return null;
      });
    }
    return null;
  };

  return (
    <div className="h-full w-full bg-slate-950 flex flex-col font-sans text-sm relative">
      {/* Chat Area */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={clsx(
              "max-w-[80%] rounded-lg p-3",
              msg.role === 'user' 
                ? "bg-purple-900/40 text-purple-100 border border-purple-700/50" 
                : "bg-slate-900 text-slate-300 border border-slate-700/50"
            )}>
              {renderContent(msg.content)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-purple-500/50 text-xs font-mono">
            <Loader2 className="w-4 h-4 animate-spin" />
            AI IS WORKING...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 border-t border-purple-900/30 bg-slate-950 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask the assistant to do something..."
          disabled={isLoading || !!pendingPerm}
          className="flex-1 bg-purple-950/10 border border-purple-900/30 text-purple-200 px-3 py-2 rounded focus:outline-none focus:border-purple-500 disabled:opacity-50"
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isLoading || !!pendingPerm}
          className="bg-purple-900/40 hover:bg-purple-900/80 disabled:opacity-50 text-purple-400 border border-purple-700/50 px-4 py-2 rounded transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Permissions Modal Overlay */}
      {pendingPerm && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-950 border border-red-500/50 rounded-lg p-6 max-w-sm w-full shadow-2xl shadow-red-500/10">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <ShieldAlert className="w-8 h-8" />
              <h3 className="font-bold text-lg">Permission Escalation</h3>
            </div>
            
            <p className="text-slate-300 text-sm mb-4">
              The AI Assistant is attempting to use the tool <span className="font-mono text-purple-400 bg-purple-950/50 px-1 rounded">{pendingPerm.toolCall.name}</span>, which requires a capability outside its current sandbox:
            </p>
            
            <div className="bg-red-950/30 border border-red-900/50 rounded p-3 mb-6 font-mono text-xs text-red-400 flex flex-col gap-2">
              <div>CAPABILITY: <span className="font-bold">{pendingPerm.capability}</span></div>
              <div>PAYLOAD: {JSON.stringify(pendingPerm.toolCall.input)}</div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => handlePermResponse(false)}
                className="flex-1 flex items-center justify-center gap-2 py-2 border border-slate-700 hover:bg-slate-800 rounded text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" /> Deny
              </button>
              <button 
                onClick={() => handlePermResponse(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 border border-red-500/50 bg-red-950/40 hover:bg-red-900/60 rounded text-red-400 transition-colors"
              >
                <Check className="w-4 h-4" /> Grant Once
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const roots = new Map<string, Root>();

export const Assistant: AppDefinition = {
  manifest: {
    appId: APP_ID,
    name: 'AI Assistant',
    icon: 'Bot',
    capabilities: ['fs:read', 'assistant:query', 'assistant:control'],
  },
  mount: (container, windowId) => {
    const root = createRoot(container);
    roots.set(windowId, root);
    root.render(<AssistantApp />);
  },
  unmount: (container, windowId) => {
    const root = roots.get(windowId);
    if (root) {
      root.unmount();
      roots.delete(windowId);
    }
  }
};
