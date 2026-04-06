import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  MessageSquare, 
  Settings, 
  BookOpen, 
  Terminal, 
  BarChart3, 
  Plus, 
  Trash2, 
  Send, 
  ChevronDown, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  History,
  Copy,
  GripVertical,
  Monitor,
  Eye,
  ArrowUp,
  FileText,
  Menu,
  MoreVertical,
  X
} from 'lucide-react';
import { useStore, state, notify } from './store.js';
import { newChat, deleteChat, getCurrentChat, persist, setActivePrompt, getActiveSystemPrompt } from './state.js';
import { getAllProviders, getProviderOrder } from './providers.js';
import { routeMessage } from './router.js';
import { renderMarkdown } from './markdown.js';
import { syncKeysToBackend } from './backend-api.js';

const App = () => {
  const store = useStore();
  
  // Layout State
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  // App Actions
  const handleNewChat = () => {
    newChat();
    state.currentView = 'chat';
    notify();
  };

  const handleSetView = (view) => {
    state.currentView = view;
    notify();
  };

  // Resizing Logic
  const startResizingLeft = useCallback((e) => {
    isResizingLeft.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  }, []);

  const startResizingRight = useCallback((e) => {
    isResizingRight.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  }, []);

  const stopResizing = useCallback(() => {
    isResizingLeft.current = false;
    isResizingRight.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isResizingLeft.current) {
      const newWidth = e.clientX;
      if (newWidth > 180 && newWidth < 450) setSidebarWidth(newWidth);
    }
    if (isResizingRight.current) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 200 && newWidth < 500) setRightPanelWidth(newWidth);
    }
  }, []);

  const renderContent = () => {
    switch (store.currentView) {
      case 'chat': return <ChatView />;
      case 'settings': return <SettingsView />;
      case 'prompts': return <PromptsView />;
      case 'logs': return <LogsView />;
      case 'usage': return <UsageView />;
      default: return <ChatView />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0a0c] text-zinc-300 font-sans overflow-hidden select-none p-2 md:p-3 gap-2 md:gap-3">
      
      {/* LEFT SIDEBAR */}
      <aside 
        style={{ width: sidebarWidth }} 
        className="flex flex-col border border-zinc-800/50 bg-[#0f0f12] rounded-2xl shrink-0 overflow-hidden shadow-2xl relative"
      >
        <div className="p-5 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700 shadow-lg">
              <Zap className="text-white w-6 h-6" fill="white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Switchboard</h1>
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Local-first AI router</p>
            </div>
          </div>

          <button 
            onClick={handleNewChat}
            className="w-full py-3 px-4 bg-gradient-to-br from-[#f59e0b] to-[#d97706] hover:opacity-90 text-white rounded-xl font-black flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.15)] mb-8"
          >
            <Plus size={18} strokeWidth={3} />
            <span className="uppercase tracking-widest text-[11px]">New Chat</span>
          </button>

          <nav className="space-y-1">
            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] mb-3 ml-2">Workspace</p>
            <NavItem icon={<MessageSquare size={18}/>} label="Chat" sub="Route prompts" active={store.currentView === 'chat'} onClick={() => handleSetView('chat')} />
            <NavItem icon={<Settings size={18}/>} label="Provider Settings" sub="Keys and routing" active={store.currentView === 'settings'} onClick={() => handleSetView('settings')} />
            <NavItem icon={<BookOpen size={18}/>} label="System Prompts" sub="Context presets" active={store.currentView === 'prompts'} onClick={() => handleSetView('prompts')} />
            <NavItem icon={<Terminal size={18}/>} label="Logs" sub="Telemetry" active={store.currentView === 'logs'} onClick={() => handleSetView('logs')} />
            <NavItem icon={<BarChart3 size={18}/>} label="Usage" sub="Analytics" active={store.currentView === 'usage'} onClick={() => handleSetView('usage')} />
          </nav>

          <div className="mt-8 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 px-2">
              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Recent Chats</p>
              <span className="bg-zinc-800 text-zinc-500 text-[10px] px-1.5 py-0.5 rounded font-bold">{store.chats.length}</span>
            </div>
            
            {store.chats.length === 0 ? (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 text-center mx-2">
                <p className="text-xs text-zinc-400 font-bold mb-1">No chats yet</p>
                <p className="text-[10px] text-zinc-600 leading-relaxed font-medium">Start a new conversation.</p>
              </div>
            ) : (
              <div className="space-y-1 px-1">
                {store.chats.map(chat => (
                  <div 
                    key={chat.id} 
                    onClick={() => {
                      state.currentChatId = chat.id;
                      state.currentView = 'chat';
                      notify();
                    }}
                    className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${store.currentChatId === chat.id ? 'bg-zinc-800/80 text-white shadow-lg border border-zinc-700/50' : 'hover:bg-zinc-800/40 text-zinc-500 border border-transparent'}`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-[11px] font-bold truncate leading-tight">
                        {chat.messages.find(m => m.role === 'user')?.content || 'New Chat'}
                      </p>
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter mt-0.5">
                        {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete chat?')) deleteChat(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-zinc-700 rounded-md transition-all text-zinc-600 hover:text-rose-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${store.backendAvailable ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'}`} />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{store.backendAvailable ? 'Backend connected' : 'Offline mode'}</span>
          </div>
        </div>

        {/* Resizer handle */}
        <div 
          onMouseDown={startResizingLeft}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-500/30 transition-colors z-50" 
        />
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative bg-[#0f0f12] border border-zinc-800/50 rounded-2xl overflow-hidden shadow-xl">
        {renderContent()}
      </main>

      {/* RIGHT SIDEBAR (ROUTING STACK) */}
      {store.currentView === 'chat' && (
        <aside 
          style={{ width: rightPanelWidth }}
          className="bg-[#0f0f12] border border-zinc-800/50 rounded-2xl p-6 flex flex-col gap-6 overflow-y-auto shrink-0 shadow-2xl relative"
        >
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Activity className="text-amber-500 w-4 h-4" />
              <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Active Routing Stack</h2>
            </div>

            <div className="space-y-4">
              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Provider Priority</p>
              <div className="relative pl-4 space-y-4 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-800">
                {getStackSteps().map((step, i) => (
                  <ProviderStep key={step.id} label={step.name} model={step.model} type={i === 0 ? 'Primary' : `Fallback ${i}`} active={i === 0} />
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-800/50 space-y-4">
            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">Session Telemetry</p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Prompt Tokens" value={store.totalTokens} />
              <StatCard label="Completion" value="0" />
              <StatCard label="Est. Latency" value="---" />
              <StatCard label="Cost Est." value="$0.00" />
            </div>
          </div>

          <div className="mt-auto flex justify-end gap-2 text-zinc-700">
             <div className="p-2 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"><GripVertical size={16}/></div>
             <div className="p-2 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"><Monitor size={16}/></div>
          </div>

          <div 
            onMouseDown={startResizingRight}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-500/30 transition-colors z-50" 
          />
        </aside>
      )}
    </div>
  );
};

// --- Sub-Components ---

const NavItem = ({ icon, label, sub, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group border ${active ? 'bg-zinc-800/80 text-white border-zinc-700/50 shadow-lg' : 'hover:bg-zinc-800/40 text-zinc-500 border-transparent'}`}
  >
    <div className={`${active ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'}`}>{icon}</div>
    <div className="text-left">
      <p className="text-sm font-bold leading-none mb-1">{label}</p>
      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider group-hover:text-zinc-500">{sub}</p>
    </div>
  </button>
);

const ProviderStep = ({ label, model, type, active }) => (
  <div className={`relative flex items-center justify-between p-3 rounded-xl border transition-all ${active ? 'bg-amber-500/5 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]' : 'bg-zinc-950 border-zinc-800/50'}`}>
    <div className={`absolute -left-[13px] w-2 h-2 rounded-full border-2 border-[#0f0f12] z-10 ${active ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-zinc-800'}`} />
    <div>
      <h3 className={`text-[10px] font-black uppercase tracking-wider ${active ? 'text-amber-500' : 'text-zinc-500'}`}>{label}</h3>
      <p className="text-[10px] text-zinc-600 font-mono mt-0.5 truncate max-w-[120px]">{model}</p>
    </div>
    <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-1 rounded-md border ${active ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-zinc-950 border-zinc-800 text-zinc-700'}`}>
      {type}
    </span>
  </div>
);

const StatCard = ({ label, value }) => (
  <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
    <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest mb-1.5">{label}</p>
    <p className="text-sm font-bold text-zinc-300 font-mono">{value}</p>
  </div>
);

const ChatView = () => {
  const store = useStore();
  const chat = useMemo(() => getCurrentChat(), [store.currentChatId, store.chats]);
  const activePrompt = useMemo(() => getActiveSystemPrompt(), [store.activePromptId, store.systemPrompts]);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Attach code copy handlers after render
    if (chatContainerRef.current) {
      import('./markdown.js').then(m => m.attachCopyHandlers(chatContainerRef.current));
    }
  }, [chat?.messages?.length, store.sending]);

  const handleSend = async () => {
    if (!inputValue.trim() || store.sending) return;
    
    const text = inputValue.trim();
    setInputValue('');

    let currentChat = chat;
    if (!currentChat) {
      const id = newChat();
      currentChat = state.chats.find(c => c.id === id);
    }

    currentChat.messages.push({ role: 'user', content: text });
    state.sending = true;
    notify();

    try {
      let fullText = '';
      const activeProvider = getActiveProvider();

      const result = await routeMessage(currentChat.messages, chunk => {
        fullText += chunk;
        const msgIdx = currentChat.messages.length - 1;
        
        // If we haven't added the assistant message yet, or it's a replacement
        if (currentChat.messages[msgIdx]?.role !== 'assistant') {
          currentChat.messages.push({
            role: 'assistant',
            content: fullText,
            providerId: activeProvider.id,
            tokens: Math.ceil(fullText.length / 4),
            latency: 'Streaming'
          });
        } else {
          currentChat.messages[msgIdx].content = fullText;
          currentChat.messages[msgIdx].tokens = Math.ceil(fullText.length / 4);
        }
        notify();
      });

      // Update final message
      const lastMsg = currentChat.messages[currentChat.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content = result.text || fullText;
        lastMsg.providerId = result.providerId;
        lastMsg.tokens = result.tokens;
        lastMsg.latency = result.latency;
      }
    } catch (e) {
      currentChat.messages.push({ 
        role: 'assistant', 
        content: `Error: ${e.message}`, 
        isError: true 
      });
    } finally {
      state.sending = false;
      persist();
      notify();
    }
  };

  const activeProvider = getActiveProvider();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0c]/20">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-6 bg-[#0f0f12]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-xs font-bold text-white">
            {activeProvider.name.slice(0, 2)}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              {activeProvider.name}
              <ChevronDown size={14} className="text-zinc-600" />
            </h2>
            <p className="text-[9px] text-zinc-600 font-mono">{activeProvider.model}</p>
          </div>
          <div className="ml-4 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${store.poolMode ? 'bg-indigo-500' : 'bg-zinc-500'}`} />
            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
              {store.poolMode ? 'Pool mode enabled' : 'Sequential fallback'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-black text-zinc-500 tracking-widest uppercase">
            Tokens <span className="text-zinc-300 ml-1">{chat?.messages.reduce((a, b) => a + (b.tokens || 0), 0) || 0}</span>
          </div>
          <button className="flex items-center gap-2 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[9px] font-black text-zinc-400 uppercase tracking-widest transition-colors">
            Provider <ChevronDown size={14} />
          </button>
        </div>
      </header>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {!chat || chat.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="max-w-2xl w-full text-center space-y-6">
              <span className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border border-zinc-700">Switchboard</span>
              <h1 className="text-5xl font-black text-white tracking-tighter leading-[0.9]">
                Route your first<br/><span className="text-zinc-800">prompt</span>
              </h1>
              <p className="text-zinc-500 max-w-sm mx-auto text-sm leading-relaxed font-medium">
                Send one message and Switchboard will apply your local prompt, provider order, and telemetry automatically.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-10">
                <div className="bg-zinc-900/30 border border-zinc-800/50 p-6 rounded-2xl text-left hover:border-zinc-700 transition-colors">
                  <p className="text-[8px] text-zinc-700 font-black uppercase tracking-widest mb-3">Routing Order</p>
                  <p className="text-white font-bold text-lg tracking-tight">
                    {getProviderOrder().slice(0, 3).map(id => getAllProviders()[id]?.name || id).join(' / ')}
                  </p>
                </div>
                <div className="bg-zinc-900/30 border border-zinc-800/50 p-6 rounded-2xl text-left hover:border-zinc-700 transition-colors">
                  <p className="text-[8px] text-zinc-700 font-black uppercase tracking-widest mb-3">Active Prompt</p>
                  <p className="text-white font-bold text-lg tracking-tight">{activePrompt?.name || 'Default Assistant'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div ref={chatContainerRef} className="max-w-3xl mx-auto space-y-8 pb-32">
            {chat.messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-5 ${msg.role === 'user' ? 'bg-zinc-800 text-white' : 'bg-zinc-900/50 border border-zinc-800/50 text-zinc-300'}`}>
                   <div className="flex items-center gap-2 mb-2">
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                        {msg.role === 'user' ? 'You' : (msg.providerId || 'Assistant')}
                      </span>
                      {msg.tokens && (
                        <span className="text-[8px] text-zinc-700 uppercase font-black">
                          {msg.tokens} tokens {msg.latency ? `/ ${msg.latency}ms` : ''}
                        </span>
                      )}
                   </div>
                   <div 
                      className="text-sm leading-relaxed prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                   />
                </div>
              </div>
            ))}
            {store.sending && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl p-5 bg-zinc-900/50 border border-zinc-800/50 text-zinc-300">
                   <div className="flex items-center gap-2 mb-2">
                      <span className="text-[8px] font-black uppercase tracking-widest text-amber-500">Routing request</span>
                   </div>
                   <div className="flex gap-1.5 py-2">
                      <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-gradient-to-t from-[#0a0a0c] to-transparent">
        <div className="max-w-3xl mx-auto relative group">
          <textarea 
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${activeProvider.name}...`}
            className="w-full bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl px-6 py-6 pr-24 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/30 transition-all min-h-[140px] resize-none shadow-inner"
          />
          <div className="absolute bottom-4 left-6 flex items-center gap-4 pointer-events-none">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
               <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Prompt:</span>
               <span className="text-[9px] text-white font-black uppercase tracking-widest">{activePrompt?.name || 'Default Assistant'}</span>
             </div>
             <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-wider hidden md:inline">Shift + Enter for new line</span>
          </div>
          <button 
            onClick={handleSend}
            disabled={store.sending}
            className="absolute bottom-4 right-4 p-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl shadow-lg transition-all flex items-center gap-2 font-black text-sm px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {store.sending ? '...' : (
              <>Send <ArrowUp size={18} /></>
            )}
          </button>
        </div>
        <div className="text-center mt-3">
          <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">
            Session tokens: {chat?.messages.reduce((a, b) => a + (b.tokens || 0), 0) || 0}
          </p>
        </div>
      </div>
    </div>
  );
};

const SettingsView = () => {
  const store = useStore();
  const providers = useMemo(() => getAllProviders(), [store]);
  const order = useMemo(() => getProviderOrder(), [store]);

  return (
    <div className="p-10 overflow-y-auto h-full max-w-5xl mx-auto w-full space-y-10">
      <div>
        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.3em] mb-2">Configuration</p>
        <h1 className="text-4xl font-black text-white tracking-tighter">Provider Settings</h1>
        <p className="text-zinc-500 mt-2 text-sm leading-relaxed">Configure API keys for routing. Keys are synced to your backend session.</p>
      </div>

      {!store.backendAvailable && (
        <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
             <AlertCircle size={18} className="text-amber-500" />
             <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest">Backend offline</h3>
          </div>
          <p className="text-amber-500/60 text-xs font-medium leading-relaxed">
            Key sync, provider tests, and telemetry are unavailable until the backend server is running.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-lg font-bold text-white tracking-tight">Providers</h3>
             <span className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">Active configuration</span>
          </div>
          <div className="space-y-4">
             {order.map(id => (
               <SettingsProviderCard key={id} provider={providers[id]} providerId={id} />
             ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-white tracking-tight">Routing Modes</h3>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-2 space-y-1">
            <div 
              onClick={() => { state.poolMode = !state.poolMode; persist(); notify(); }}
              className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 cursor-pointer hover:border-zinc-700 transition-all"
            >
               <div>
                 <p className="text-xs font-bold text-zinc-300">Pool Mode</p>
                 <p className="text-[9px] text-zinc-600 mt-1 uppercase tracking-wider font-black">Race all providers</p>
               </div>
               <div className={`w-10 h-5 rounded-full relative p-1 transition-all border ${store.poolMode ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-zinc-800 border-zinc-700'}`}>
                  <div className={`w-3 h-3 rounded-full transition-all ${store.poolMode ? 'bg-indigo-400 translate-x-5' : 'bg-zinc-600 translate-x-0'}`} />
               </div>
            </div>
            <div 
              onClick={() => { state.streaming = !state.streaming; persist(); notify(); }}
              className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 cursor-pointer hover:border-zinc-700 transition-all"
            >
               <div>
                 <p className="text-xs font-bold text-zinc-300">Streaming</p>
                 <p className="text-[9px] text-zinc-600 mt-1 uppercase tracking-wider font-black">Partial chunks</p>
               </div>
               <div className={`w-10 h-5 rounded-full relative p-1 transition-all border ${store.streaming ? 'bg-amber-500/20 border-amber-500/30' : 'bg-zinc-800 border-zinc-700'}`}>
                  <div className={`w-3 h-3 rounded-full transition-all ${store.streaming ? 'bg-amber-500 translate-x-5' : 'bg-zinc-600 translate-x-0'}`} />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsProviderCard = ({ provider, providerId }) => {
  const store = useStore();
  const rawKeys = store.apiKeys[providerId];
  const keys = Array.isArray(rawKeys) ? rawKeys : (rawKeys ? [rawKeys] : ['']);
  const [visibleKeys, setVisibleKeys] = useState({});
  const syncTimer = useRef(null);

  const syncAndPersist = (newKeys) => {
    state.apiKeys[providerId] = newKeys;
    persist();
    notify();
    
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncKeysToBackend().catch(() => {});
    }, 600);
  };

  const handleKeyChange = (index, value) => {
    const updated = [...keys];
    updated[index] = value;
    syncAndPersist(updated);
  };

  const handleAddKey = () => {
    syncAndPersist([...keys, '']);
  };

  const handleRemoveKey = (index) => {
    const updated = keys.filter((_, i) => i !== index);
    syncAndPersist(updated.length ? updated : ['']);
  };

  const toggleVisibility = (index) => {
    setVisibleKeys(prev => ({ ...prev, [index]: !prev[index] }));
  };

  if (!provider) return null;

  const hasAnyKey = keys.some(k => k && k.trim());

  return (
    <div className="bg-zinc-950 border border-zinc-800/50 p-6 rounded-2xl flex items-start gap-6 group hover:border-zinc-700 transition-colors">
       <div className="pt-1 text-zinc-800 group-hover:text-zinc-600 cursor-grab"><GripVertical size={20}/></div>
       <div className="flex-1 space-y-6">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-xs font-bold text-zinc-200 border border-zinc-700" style={{ color: provider.avatarColor }}>
               {provider.initials}
             </div>
             <div>
                <h4 className="text-white font-bold text-sm tracking-tight flex items-center gap-2">{provider.name} <div className={`w-1.5 h-1.5 rounded-full ${hasAnyKey ? 'bg-green-500' : 'bg-zinc-700'}`} /></h4>
                <p className="text-[10px] text-zinc-600 font-mono">{provider.model}</p>
             </div>
          </div>
          <div className="space-y-3">
             <div className="flex items-center justify-between">
               <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">API Keys</div>
               <span className="text-[9px] text-zinc-700 font-bold">{keys.filter(k => k?.trim()).length} configured</span>
             </div>
             {keys.map((key, index) => (
               <div key={index} className="flex gap-2 items-center">
                  <span className="text-[9px] text-zinc-700 font-bold w-6 shrink-0 text-center">{index + 1}</span>
                  <input 
                    type={visibleKeys[index] ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => handleKeyChange(index, e.target.value)}
                    placeholder={`Key ${index + 1}`}
                    className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-amber-500/30 font-mono" 
                  />
                  <button
                    onClick={() => toggleVisibility(index)}
                    className="p-3 bg-[#0a0a0c] border border-zinc-800 rounded-xl text-zinc-700 hover:text-zinc-300 transition-colors"
                    title={visibleKeys[index] ? 'Hide key' : 'Show key'}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleRemoveKey(index)}
                    className="p-3 bg-[#0a0a0c] border border-zinc-800 rounded-xl text-zinc-700 hover:text-rose-500 transition-colors"
                    title="Remove key"
                  >
                    <Trash2 size={16}/>
                  </button>
               </div>
             ))}
             <button
               onClick={handleAddKey}
               className="w-full py-2.5 bg-zinc-900/50 hover:bg-zinc-800/50 border border-dashed border-zinc-800 rounded-xl text-[10px] font-black text-zinc-500 hover:text-zinc-300 uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
             >
               <Plus size={14} /> Add another key
             </button>
          </div>
       </div>
    </div>
  );
};

const PromptsView = () => {
  const store = useStore();
  
  const handleSelectPrompt = (id) => {
    setActivePrompt(id);
  };

  const handleSavePrompt = (id, content) => {
    const prompt = state.systemPrompts.find(p => p.id === id);
    if (prompt) {
      prompt.content = content;
      persist();
      notify();
    }
  };

  const activePrompt = useMemo(() => getActiveSystemPrompt(), [store.activePromptId, store.systemPrompts]);
  const [editingContent, setEditingContent] = useState('');

  useEffect(() => {
    if (activePrompt) setEditingContent(activePrompt.content);
  }, [activePrompt?.id]);

  return (
    <div className="flex h-full bg-[#0a0a0c]/20">
      <div className="w-[300px] border-r border-zinc-800/50 p-6 flex flex-col h-full bg-[#0f0f12]">
         <div className="mb-8">
            <h2 className="text-xl font-bold text-white tracking-tight">System Prompts</h2>
            <p className="text-[10px] text-zinc-600 mt-1 font-bold uppercase tracking-wider">Context presets</p>
         </div>
         <div className="space-y-2 flex-1 overflow-y-auto">
            {store.systemPrompts.map(p => (
              <PromptItem 
                key={p.id} 
                label={p.name} 
                tokens={Math.ceil(p.content.length / 4)} 
                active={store.activePromptId === p.id} 
                onClick={() => handleSelectPrompt(p.id)}
              />
            ))}
         </div>
         <button className="mt-6 w-full py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-[10px] font-black text-white uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
            <Plus size={16} /> New Prompt
         </button>
      </div>
      <div className="flex-1 p-10 flex flex-col">
         {activePrompt ? (
           <>
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                   <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{activePrompt.name}</h2>
                   <div className="px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-500">Active Context</div>
                </div>
                <div className="flex gap-3">
                   <button 
                    onClick={() => handleSavePrompt(activePrompt.id, editingContent)}
                    className="px-6 py-2 bg-zinc-100 text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
                   >
                    Save
                   </button>
                </div>
             </div>
             <textarea 
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="flex-1 w-full bg-[#0a0a0c] border border-zinc-800 rounded-3xl p-8 text-zinc-400 font-mono text-xs focus:outline-none focus:border-amber-500/20 resize-none leading-relaxed shadow-inner"
             />
             <div className="mt-4 text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em]">Approx. {Math.ceil(editingContent.length / 4)} tokens</div>
           </>
         ) : (
           <div className="flex-1 flex items-center justify-center text-zinc-700 uppercase font-black tracking-widest">
             Select a prompt to edit
           </div>
         )}
      </div>
    </div>
  );
};

const PromptItem = ({ label, tokens, active, onClick }) => (
  <div 
    onClick={onClick}
    className={`p-4 rounded-xl border transition-all cursor-pointer group ${active ? 'bg-zinc-900 border-zinc-800 shadow-md relative' : 'border-transparent hover:bg-zinc-900/30'}`}
  >
     {active && <div className="absolute left-0 top-4 bottom-4 w-1 bg-amber-500 rounded-r shadow-[0_0_8px_rgba(245,158,11,0.4)]" />}
     <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className={`w-2 h-2 rounded-full ${active ? 'bg-amber-500' : 'bg-zinc-800'}`} />
           <p className={`text-sm font-bold ${active ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'}`}>{label}</p>
        </div>
     </div>
     <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest mt-1.5 ml-5">{tokens} tokens</p>
  </div>
);

const LogsView = () => {
  const store = useStore();

  return (
    <div className="p-10 overflow-y-auto h-full w-full space-y-10 focus:outline-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter">Logs</h1>
          <p className="text-zinc-500 mt-1 text-sm font-medium">Real-time request telemetry.</p>
        </div>
      </div>

      <div className="border border-zinc-800/50 rounded-3xl overflow-hidden bg-[#0a0a0c]">
         <div className="grid grid-cols-6 p-4 border-b border-zinc-800/50 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700 bg-zinc-900/40">
            <div>Time</div>
            <div>Provider</div>
            <div>Model</div>
            <div>Status</div>
            <div>Latency</div>
            <div>Tokens</div>
         </div>
         {store.logs.length === 0 ? (
           <div className="p-32 text-center flex flex-col items-center justify-center">
              <div className="p-8 border border-dashed border-zinc-800 rounded-3xl max-w-sm bg-zinc-900/10">
                 <p className="text-xs font-bold text-zinc-400 mb-1">No logs yet</p>
                 <p className="text-[10px] text-zinc-600 leading-relaxed font-bold uppercase tracking-tight">Records will appear here.</p>
              </div>
           </div>
         ) : (
           <div className="divide-y divide-zinc-800/30">
             {store.logs.map(log => (
               <div key={log.id} className="grid grid-cols-6 p-4 text-[10px] font-bold text-zinc-400 hover:bg-zinc-900/40 transition-colors">
                 <div className="truncate">{new Date(log.time).toLocaleTimeString()}</div>
                 <div className="text-zinc-200">{log.providerId}</div>
                 <div className="truncate font-mono opacity-60">{log.model}</div>
                 <div>
                   <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black ${log.status === 'ok' ? 'bg-green-500/10 text-green-500' : 'bg-rose-500/10 text-rose-500'}`}>
                     {log.status}
                   </span>
                 </div>
                 <div>{log.latency}ms</div>
                 <div>{log.tokens}</div>
               </div>
             ))}
           </div>
         )}
      </div>
    </div>
  );
};

const UsageView = () => {
  const store = useStore();
  const summary = store.usageAnalytics?.summary || { totalRequests: 0, totalTokens: 0, avgLatency: 0, successRate: 0, fastestProvider: 'N/A', mostUsed: 'N/A' };

  return (
    <div className="p-10 overflow-y-auto h-full w-full space-y-10">
      <div>
        <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.3em] mb-2">Analytics</p>
        <h1 className="text-4xl font-black text-white tracking-tighter">Usage</h1>
        <p className="text-zinc-500 mt-2 text-sm leading-relaxed">System performance based on telemetry.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         <UsageStatCard label="Total Requests" value={summary.totalRequests || 0} sub="Routed attempts" />
         <UsageStatCard label="Total Tokens" value={summary.totalTokens || 0} sub="Assistant responses" />
         <UsageStatCard label="Average Latency" value={`${Math.round(summary.avgLatency || 0)}ms`} sub="Logged average" />
         <UsageStatCard label="Success Rate" value={`${summary.successRate || 0}%`} sub="Successful requests" />
         <UsageStatCard label="Fastest Provider" value={summary.fastestProvider || 'N/A'} sub="Lowest latency" />
         <UsageStatCard label="Most Used" value={summary.mostUsed || 'N/A'} sub="Highest volume" />
      </div>
    </div>
  );
};

const UsageStatCard = ({ label, value, sub }) => (
  <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl hover:border-zinc-700 transition-colors">
     <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest mb-4">{label}</p>
     <p className="text-3xl font-black text-white tracking-tighter mb-2">{value}</p>
     <p className="text-[9px] text-zinc-500 font-black uppercase tracking-tight">{sub}</p>
  </div>
);

// --- Helpers ---

function getActiveProvider() {
  const providers = getAllProviders();
  const order = getProviderOrder();
  const id = state.providerOverride || order[0] || 'groq';
  return { id, ...(providers[id] || providers.groq) };
}

function getStackSteps() {
  const providers = getAllProviders();
  const order = getProviderOrder();
  return order.map(id => ({ id, ...providers[id] })).filter(p => p.name);
}

export default App;
