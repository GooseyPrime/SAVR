/**
 * SAVR Chat Interface - SAVR Design System
 * AI-powered culinary assistant with mode-aware expertise
 * Uses real AI via Edge Functions for recipe help, techniques, and meal planning
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  User,
  ChefHat,
  Dog,
  Cat,
  Loader2,
  AlertCircle } from
'lucide-react';
import { Button } from '@/components/ui/Button';
import { useChat } from '@/hooks/use-savr-api';
import { useAppStore, type RecipeMode } from '@/store/app-store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  className?: string;
  initialMessage?: string;
}

const modeIcons = {
  human: ChefHat,
  dog: Dog,
  cat: Cat
};

export function ChatInterface({ className = '', initialMessage }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const { sendMessage, isLoading, error } = useChat();
  const { preferences, inventory } = useAppStore();
  const mode = preferences.recipeMode;

  const ModeIcon = modeIcons[mode];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    const inventoryNames = inventory.map((i) => i.name);
    const response = await sendMessage({
      message: text,
      mode,
      context: {
        inventory: inventoryNames
      }
    });

    if (response) {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  }, [input, isLoading, sendMessage, mode, inventory]);

  // Handle initial message - using a ref to track if we've sent it
  const initialMessageSent = useRef(false);
  useEffect(() => {
    if (initialMessage && messages.length === 0 && !initialMessageSent.current) {
      initialMessageSent.current = true;
      handleSend(initialMessage);
    }
  }, [initialMessage, messages.length, handleSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div data-ev-id="ev_62abdeaf84" className={`flex flex-col h-full ${className}`}>
      {/* Messages */}
      <div data-ev-id="ev_88cb66d327" className="flex-1 overflow-y-auto px-5 py-6">
        {messages.length === 0 ?
        <div data-ev-id="ev_82d80a0826" className="flex flex-col items-center justify-center h-full text-center">
            <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 border border-primary/40 flex items-center justify-center mb-6">

              <ModeIcon className="w-12 h-12 text-primary" strokeWidth={1} />
            </motion.div>
            <h3 data-ev-id="ev_e3a87f0085" className="font-display text-2xl font-light text-foreground mb-3">
              {mode === 'human' ? 'Culinary Assistant' :
            mode === 'dog' ? 'Canine Nutrition' :
            'Feline Cuisine'}
            </h3>
            <p data-ev-id="ev_d7beecf198" className="text-foreground-secondary text-base max-w-xs">
              Ask about recipes, techniques, ingredients, or meal planning.
            </p>
            
            {/* Suggestions */}
            <div data-ev-id="ev_138431d11d" className="flex flex-col gap-3 mt-8 w-full max-w-sm">
              {[
            "What can I prepare with my pantry?",
            "Suggest a quick weeknight dinner",
            "How should I store fresh herbs?"].
            map((suggestion) =>
            <button data-ev-id="ev_ea104a01d7"
            key={suggestion}
            onClick={() => setInput(suggestion)}
            className="
                    px-5 py-4 bg-surface border border-border text-left
                    text-base text-foreground-secondary
                    hover:border-primary/40 hover:text-foreground
                    transition-all duration-200
                  ">






                  "{suggestion}"
                </button>
            )}
            </div>
          </div> :

        <div data-ev-id="ev_2b8e54d725" className="flex flex-col gap-6">
            <AnimatePresence mode="popLayout">
              {messages.map((message) =>
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              layout
              className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>

                  {/* Avatar */}
                  <div data-ev-id="ev_9d713a942b" className={`
                    w-11 h-11 border flex items-center justify-center shrink-0
                    ${message.role === 'user' ? 'border-border-strong' : 'border-primary/40'}
                  `}>
                    {message.role === 'user' ?
                <User className="w-5 h-5 text-foreground-secondary" strokeWidth={1.5} /> :

                <ModeIcon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                }
                  </div>

                  {/* Message */}
                  <div data-ev-id="ev_14124171c0" className={`
                    max-w-[75%] p-5 border
                    ${message.role === 'user' ?
              'bg-primary/12 border-primary/25 text-foreground' :
              'bg-surface border-border text-foreground-secondary'}
                  `}>
                    <p data-ev-id="ev_dbe5edfc8f" className="text-base whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    <p data-ev-id="ev_96b22a8810" className="text-xs text-foreground-muted font-mono mt-3 tracking-wider">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
            )}
            </AnimatePresence>

            {/* Loading */}
            {isLoading &&
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-4">

                <div data-ev-id="ev_7025854f1d" className="w-11 h-11 border border-primary/40 flex items-center justify-center">
                  <ModeIcon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <div data-ev-id="ev_f938aba81d" className="bg-surface border border-border p-5">
                  <div data-ev-id="ev_6ee9a3f4c7" className="flex gap-2 items-center">
                    <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-2 h-2 bg-primary rounded-full" />

                    <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                  className="w-2 h-2 bg-primary rounded-full" />

                    <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                  className="w-2 h-2 bg-primary rounded-full" />

                  </div>
                </div>
              </motion.div>
          }

            <div data-ev-id="ev_48f1e66927" ref={messagesEndRef} />
          </div>
        }
      </div>

      {/* Error */}
      {error &&
      <div data-ev-id="ev_1dbff6bb99" className="mx-5 mb-3 p-4 bg-error/10 border border-error/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-error shrink-0" strokeWidth={1.5} />
          <p data-ev-id="ev_de0aff36a7" className="text-error text-base">{error}</p>
        </div>
      }

      {/* Input */}
      <div data-ev-id="ev_7b141c4569" className="pb-safe border-t border-border">
        <div data-ev-id="ev_8a5226d3d9" className="p-5">
          <div data-ev-id="ev_98beeeefc5" className="flex items-end gap-3 bg-surface border border-border p-4 focus-within:border-primary/40 focus-within:shadow-[0_0_30px_rgba(255,184,0,0.08)] transition-all duration-200">
            <textarea data-ev-id="ev_82b31ecc1d"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about cooking..."
            rows={1}
            className="
                flex-1 bg-transparent border-0 resize-none
                text-foreground text-base placeholder:text-foreground-muted
                focus:outline-none focus:ring-0
                py-2
              " />






            <Button
              size="sm"
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="shrink-0">

              {isLoading ?
              <Loader2 className="w-4 h-4 animate-spin" /> :

              <Send className="w-4 h-4" />
              }
            </Button>
          </div>
        </div>
      </div>
    </div>);

}