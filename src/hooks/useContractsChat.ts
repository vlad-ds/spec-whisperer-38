import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export interface ContractSource {
  contract_id: string;
  filename: string;
  text: string;
  score: number;
}

export interface ContractChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: ContractSource[];
  timestamp: Date;
}

export interface ContractConversation {
  id: string;
  title: string;
  messages: ContractChatMessage[];
  createdAt: Date;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contracts-chat`;

export const useContractsChat = () => {
  const [conversations, setConversations] = useState<ContractConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const conversationsRef = useRef<ContractConversation[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const createConversation = useCallback(() => {
    const newConversation: ContractConversation = {
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

    const userMessage: ContractChatMessage = { 
      role: 'user', 
      content: input,
      timestamp: new Date(),
    };
    
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
      const currentConversation = conversationsRef.current.find(c => c.id === conversationId);
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
      
      const assistantMessage: ContractChatMessage = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
      };

      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, messages: [...conv.messages, assistantMessage] };
        }
        return conv;
      }));
    } catch (error) {
      console.error('Contracts Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response';
      const isServiceError = errorMessage.includes('temporarily unavailable') || errorMessage.includes('service');
      
      toast({
        title: isServiceError ? 'Service Temporarily Unavailable' : 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { 
            ...conv, 
            messages: [...conv.messages, { 
              role: 'assistant' as const, 
              content: isServiceError 
                ? 'The contracts service is temporarily unavailable. This can happen when the server is under heavy load. Please try your question again in a moment.'
                : 'Sorry, I encountered an error. Please try again.',
              timestamp: new Date(),
            }] 
          };
        }
        return conv;
      }));
    } finally {
      setIsLoading(false);
    }
  }, [activeConversationId, createConversation]);

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
