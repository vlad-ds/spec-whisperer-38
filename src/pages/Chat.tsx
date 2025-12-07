import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat, Message } from '@/hooks/useChat';
import { SourcesList } from '@/components/SourcesList';
import { AppHeader } from '@/components/AppHeader';
import { Plus, Send, MessageSquare, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const ChatMessage = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn('flex gap-3 mb-4', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%]', isUser ? '' : 'w-full max-w-[80%]')}>
        {!isUser && message.rewrittenQuery && (
          <p className="text-xs text-muted-foreground italic mb-1.5">
            Interpreted as: "{message.rewrittenQuery}"
          </p>
        )}
        <div
          className={cn(
            'rounded-lg px-4 py-2 text-sm',
            isUser 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-foreground'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {!isUser && message.sources && (
          <SourcesList sources={message.sources} />
        )}
      </div>
    </div>
  );
};

const ConversationItem = ({ 
  conversation, 
  isActive, 
  onClick, 
  onDelete 
}: { 
  conversation: { id: string; title: string }; 
  isActive: boolean; 
  onClick: () => void;
  onDelete: () => void;
}) => (
  <div
    className={cn(
      'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
      isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
    )}
    onClick={onClick}
  >
    <MessageSquare className="h-4 w-4 shrink-0" />
    <span className="flex-1 truncate text-sm">{conversation.title}</span>
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  </div>
);

const exampleQuestions = [
  "What is DORA?",
  "What are the ICT risk management requirements under DORA?",
  "What is a microenterprise under DORA?",
  "What are the incident reporting requirements for financial entities?",
  "What liquidity requirements apply to stablecoin issuers under MiCA?",
  "How does DORA relate to NIS2?",
];

const Chat = () => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    conversations,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    sendMessage,
    isLoading,
  } = useChat();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation?.messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Warning Banner */}
      <Alert variant="default" className="rounded-none border-x-0 border-t-0 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
          Conversations are not saved. Refreshing the page will clear all chats.
        </AlertDescription>
      </Alert>

      {/* Header */}
      <AppHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-border flex flex-col bg-muted/30">
          <div className="p-4 border-b border-border">
            <Button onClick={createConversation} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-2">
            {conversations.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                No conversations yet
              </p>
            ) : (
              conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => setActiveConversationId(conv.id)}
                  onDelete={() => deleteConversation(conv.id)}
                />
              ))
            )}
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="border-b border-border p-4">
            <h1 className="text-lg font-semibold">
              {activeConversation?.title || 'RegWatch Assistant'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Ask questions about DORA, MiCA, and regulatory compliance
            </p>
          </div>

          <ScrollArea className="flex-1 p-4">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-2">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <h2 className="text-xl font-medium">How can I help you?</h2>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Ask me anything about DORA, MiCA, or other regulatory frameworks.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {activeConversation.messages.map((msg, i) => (
                  <ChatMessage key={i} message={msg} />
                ))}
                {isLoading && (
                  <div className="flex gap-3 mb-4">
                    <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </>
            )}
          </ScrollArea>

          <div className="p-4 border-t border-border space-y-3">
            {(!activeConversation || activeConversation.messages.length === 0) && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {exampleQuestions.map((question) => (
                    <button
                      key={question}
                      onClick={() => setInput(question)}
                      className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about regulations..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
