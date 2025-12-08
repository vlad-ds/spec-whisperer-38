import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useContractsChat, ContractChatMessage, ContractSource } from '@/hooks/useContractsChat';
import { AppHeader } from '@/components/AppHeader';
import { 
  Plus, 
  Send, 
  MessageSquare, 
  Trash2, 
  Loader2, 
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Sources display component
const ContractSourcesList = ({ sources }: { sources: ContractSource[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <FileText className="h-3.5 w-3.5" />
          <span>Sources ({sources.length})</span>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {sources.map((source, idx) => (
          <div 
            key={`${source.contract_id}-${idx}`} 
            className="bg-background border rounded-md p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <Link 
                to={`/contracts/${source.contract_id}`}
                className="font-medium text-primary hover:underline flex items-center gap-1"
              >
                {source.filename}
                <ExternalLink className="h-3 w-3" />
              </Link>
              <span className="text-xs text-muted-foreground">
                {Math.round(source.score * 100)}% match
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3">
              "{source.text}"
            </p>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

// Message component with markdown-like rendering
const ChatMessage = ({ message }: { message: ContractChatMessage }) => {
  const isUser = message.role === 'user';
  
  // Simple markdown rendering for basic formatting
  const renderContent = (content: string) => {
    // Split by code blocks first
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\w+\n/, '');
        return (
          <pre key={i} className="bg-muted rounded p-2 my-2 overflow-x-auto text-xs">
            <code>{code}</code>
          </pre>
        );
      }
      
      // Process inline formatting
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part.split('\n').map((line, lineIdx) => {
            // Headers
            if (line.startsWith('### ')) {
              return <h3 key={lineIdx} className="font-semibold mt-2 mb-1">{line.slice(4)}</h3>;
            }
            if (line.startsWith('## ')) {
              return <h2 key={lineIdx} className="font-bold text-lg mt-3 mb-1">{line.slice(3)}</h2>;
            }
            // Lists
            if (line.match(/^[\-\*]\s/)) {
              return <li key={lineIdx} className="ml-4">{line.slice(2)}</li>;
            }
            if (line.match(/^\d+\.\s/)) {
              return <li key={lineIdx} className="ml-4 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
            }
            // Bold/italic
            let processed = line
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.+?)\*/g, '<em>$1</em>');
            
            if (processed !== line) {
              return <span key={lineIdx} dangerouslySetInnerHTML={{ __html: processed }} />;
            }
            
            return lineIdx > 0 ? <><br key={`br-${lineIdx}`} />{line}</> : line;
          })}
        </span>
      );
    });
  };

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%]', isUser ? '' : 'w-full max-w-[85%]')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm',
            isUser 
              ? 'bg-primary text-primary-foreground rounded-br-md' 
              : 'bg-card border border-border rounded-bl-md'
          )}
        >
          <div className="text-sm leading-relaxed">
            {renderContent(message.content)}
          </div>
        </div>
        {!isUser && message.sources && (
          <ContractSourcesList sources={message.sources} />
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
  "How many contracts do we have?",
  "Which contracts expire this year?",
  "What are the termination clauses in our contracts?",
  "List all contracts with auto-renewal",
  "What notice period is required for renewal?",
  "Which contracts have the longest term?",
];

const CompyChat = () => {
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
  } = useContractsChat();

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

  const handleExampleClick = (question: string) => {
    setInput(question);
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
          <div className="border-b border-border p-4 bg-card">
            <h1 className="text-xl font-semibold">CompyChat</h1>
            <p className="text-sm text-muted-foreground">
              Ask questions about your contracts - data, clauses, obligations, and more
            </p>
          </div>

          <ScrollArea className="flex-1 p-6">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center min-h-[300px]">
                <div className="text-center space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold">How can I help you?</h2>
                  <p className="text-muted-foreground max-w-md">
                    Ask me about your contracts - counts, dates, parties, clauses, and obligations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {activeConversation.messages.map((msg, i) => (
                  <ChatMessage key={i} message={msg} />
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
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
                      onClick={() => handleExampleClick(question)}
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
                  placeholder="Ask a question about your contracts..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
            <p className="text-xs text-muted-foreground text-center">
              AI-generated responses. Verify important information in the source contracts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompyChat;
