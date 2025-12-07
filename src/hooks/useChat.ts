import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export interface Source {
  doc_id: string;
  title: string;
  text: string;
  topic: string;
  score: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export const useChat = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const createConversation = useCallback(() => {
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    return newConversation.id;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  }, [activeConversationId]);

  const sendMessage = useCallback(async (input: string) => {
    let conversationId = activeConversationId;
    
    if (!conversationId) {
      conversationId = createConversation();
    }

    const userMessage: Message = { role: 'user', content: input };
    
    // Add user message and update title
    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId) {
        const updatedMessages = [...conv.messages, userMessage];
        const title = conv.messages.length === 0 ? input.slice(0, 30) + (input.length > 30 ? '...' : '') : conv.title;
        return { ...conv, messages: updatedMessages, title };
      }
      return conv;
    }));

    setIsLoading(true);

    try {
      // Build history from current conversation (excluding the new user message)
      const currentConversation = conversations.find(c => c.id === conversationId);
      const history = (currentConversation?.messages || []).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          query: input,
          history,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await resp.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      };

      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, messages: [...conv.messages, assistantMessage] };
        }
        return conv;
      }));
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get response',
        variant: 'destructive',
      });
      
      // Add error message to conversation
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { 
            ...conv, 
            messages: [...conv.messages, { 
              role: 'assistant' as const, 
              content: `Sorry, I encountered an error. Please try again.` 
            }] 
          };
        }
        return conv;
      }));
    } finally {
      setIsLoading(false);
    }
  }, [activeConversationId, conversations, createConversation]);

  return {
    conversations,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    sendMessage,
    isLoading,
  };
};
