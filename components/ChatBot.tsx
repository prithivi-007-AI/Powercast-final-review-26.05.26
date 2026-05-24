import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ChatMessage, AppState } from '../types';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface Props {
  appState: Pick<AppState, 'results' | 'decisions' | 'weatherData' | 'units' | 'plantType'>;
}

const SUGGESTED_PROMPTS = [
  "Why is a unit recommended OFF?",
  "Show renewable contribution",
  "Explain the forecast graph",
  "How can I improve efficiency?",
  "What causes the load peak?",
  "Explain maintenance windows",
];

const SYSTEM_CONTEXT = `You are Powercast AI Energy Assistant — an expert in renewable energy systems, load forecasting, generator dispatch optimization, and grid management.
Personality: Helpful, concise, technical but easy to understand. Renewable-energy focused.
Knowledge: Load forecasting, renewable optimization, generator dispatch, maintenance scheduling, weather impact, grid efficiency, energy economics.
Rules: Be direct and actionable. Use specific numbers from context when available. Keep responses under 150 words unless detail is requested.`;

function buildContext(appState: Props['appState']): string {
  const parts: string[] = [];
  if (appState.plantType) parts.push(`Plant Type: ${appState.plantType}`);
  if (appState.units.length > 0) {
    parts.push(`Fleet: ${appState.units.map(u => `${u.name}(${u.type},${u.capacity}MW)`).join(', ')}`);
  }
  if (appState.weatherData) {
    const w = appState.weatherData;
    parts.push(`Weather: ${w.temperature}C, Wind=${w.windSpeed}m/s, Clouds=${w.cloudCover}%, ${w.description}`);
  }
  if (appState.results) {
    const r = appState.results;
    const peak = Math.max(...(r.predictions?.map(p => p.predicted ?? 0) || [0]));
    parts.push(`Forecast: Peak=${Math.round(peak)}MW, Efficiency=${r.systemEfficiency}%, Cost=Rs${Math.round(r.projectedCostPerHour).toLocaleString()}/hr`);
  }
  if (appState.decisions) {
    const d = appState.decisions;
    parts.push(`Status: ${d.overallStatus}, Renewables=${d.renewablePercent}%, Savings=Rs${d.totalEstimatedSavings.toLocaleString()}/hr`);
    parts.push(`Dispatch: ${d.recommendations.filter(r => r.action === 'ON').length} ON, ${d.recommendations.filter(r => r.action === 'STANDBY').length} STANDBY, ${d.recommendations.filter(r => r.action === 'OFF').length} OFF`);
  }
  return parts.length > 0 ? `\nDashboard Context:\n${parts.join('\n')}` : '';
}

const ChatBot: React.FC<Props> = ({ appState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm Powercast AI. I can help you understand your load forecast, dispatch recommendations, maintenance windows, and renewable insights. What would you like to know?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const trimmed = text.trim();

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantId = `a-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    try {
      const ctx = buildContext(appState);
      const history = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const prompt = `${SYSTEM_CONTEXT}${ctx}\n\n${history ? `Recent conversation:\n${history}\n\n` : ''}User: ${trimmed}\nAssistant:`;

      const stream = genai.models.generateContentStream({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      let fullText = '';
      for await (const chunk of await stream) {
        const chunkText = chunk.text ?? '';
        fullText += chunkText;
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: fullText, isStreaming: true }
            : m
        ));
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: fullText, isStreaming: false }
          : m
      ));
    } catch (err: any) {
      const errMsg = err?.message?.includes('API_KEY') || err?.message?.includes('key')
        ? 'API key not configured. Please set GEMINI_API_KEY in your .env.local file.'
        : 'Sorry, I encountered an error. Please try again.';

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: errMsg, isStreaming: false }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, appState]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        id="chatbot-toggle"
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, var(--accent), #6366f1)',
          boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
        }}
        title="Open AI Assistant"
        aria-label="Toggle Powercast AI Chat"
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        {/* Pulsing dot indicator */}
        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* Chat Panel */}
      <div
        id="chatbot-panel"
        className={`fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl overflow-hidden transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          background: 'var(--bg-color)',
          boxShadow: '20px 20px 40px var(--neu-shadow-dark), -10px -10px 30px var(--neu-shadow-light)',
          border: '1px solid rgba(255,255,255,0.3)',
          maxHeight: '520px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--accent), #6366f1)' }}
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-black tracking-tight">Powercast AI Assistant</p>
            <p className="text-white/70 text-[9px] font-medium">Energy Intelligence</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/70 text-[9px] font-bold">Live</span>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
          style={{ minHeight: 0 }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              )}

              <div
                className={`max-w-[78%] px-3 py-2.5 rounded-2xl text-[11px] font-medium leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white rounded-tr-sm'
                    : 'text-[var(--text-main)] rounded-tl-sm'
                }`}
                style={msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, var(--accent), #6366f1)' }
                  : { background: 'var(--bg-color)', boxShadow: 'inset 2px 2px 5px var(--neu-shadow-dark), inset -2px -2px 5px var(--neu-shadow-light)' }
                }
              >
                {msg.content || (msg.isStreaming && (
                  <span className="inline-flex gap-0.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ))}
                {msg.isStreaming && msg.content && (
                  <span className="inline-block w-0.5 h-3 bg-[var(--accent)] ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested prompts (show only when 1 message i.e. welcome) */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 flex-shrink-0">
            <p className="text-[8px] font-black text-[var(--text-light)] uppercase tracking-widest mb-2">Suggested</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_PROMPTS.slice(0, 4).map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold text-[var(--accent)] transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: 'var(--bg-color)',
                    boxShadow: '3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div
          className="px-3 py-3 flex-shrink-0 flex items-center gap-2"
          style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
        >
          <input
            ref={inputRef}
            id="chatbot-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your forecast..."
            disabled={isLoading}
            className="flex-1 text-[11px] font-medium px-3 py-2.5 rounded-xl outline-none text-[var(--text-main)] placeholder:text-[var(--text-light)] disabled:opacity-50"
            style={{
              background: 'var(--bg-color)',
              boxShadow: 'inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light)',
              border: 'none',
            }}
          />
          <button
            id="chatbot-send"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #6366f1)',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
            }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatBot;
