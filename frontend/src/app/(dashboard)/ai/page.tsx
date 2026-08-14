'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your GoldLoan AI assistant. You can ask me questions about loans, customers, collections, overdue status, outstanding amounts, and more. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = useMutation({
    mutationFn: async (query: string) => {
      const { data } = await api.post<{ data: { response: string } }>('/ai/query', { query });
      return data.data.response;
    },
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    const query = input.trim();
    if (!query || sendMessage.isPending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: query,
        timestamp: new Date(),
      },
    ]);
    setInput('');
    sendMessage.mutate(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const suggestions = [
    'Show all overdue loans',
    'How much is total outstanding?',
    'Which customers have unpaid interest?',
    'How much was collected this month?',
    'Show loans due this week',
  ];

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <PageHeader title="AI Assistant" subtitle="Ask questions about your gold loan business in natural language" />

      {/* Messages */}
      <Card className="flex-1 flex flex-col overflow-hidden mb-4">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                msg.role === 'assistant' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`rounded-lg px-4 py-2 text-sm ${
                  msg.role === 'assistant'
                    ? 'bg-slate-100 text-slate-800'
                    : 'bg-yellow-600 text-white'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <span className="text-xs text-slate-400 mt-1">{formatDateTime(msg.timestamp)}</span>
              </div>
            </div>
          ))}
          {sendMessage.isPending && (
            <div className="flex gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-yellow-100 text-yellow-700">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-slate-100 rounded-lg px-4 py-2">
                <LoadingSpinner size="sm" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </Card>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Ask about loans, customers, collections... (Enter to send)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="resize-none"
        />
        <Button onClick={handleSend} disabled={!input.trim() || sendMessage.isPending} className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
