import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
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
// Simple sources list - shows only cited contracts
const ContractSourcesList = ({ sources }: { sources: ContractSource[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  // Parse filename to extract name and parties
  const parseFilename = (filename: string) => {
    const match = filename.match(/^(.+?)\s*\((.+)\)$/);
    if (match) {
      return { name: match[1].trim(), parties: match[2].trim() };
    }
    return { name: filename, parties: null };
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <FileText className="h-3.5 w-3.5" />
          <span>Sources ({sources.length})</span>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="space-y-3">
          {sources.map((source, idx) => {
            const { name, parties } = parseFilename(source.filename);
            return (
              <div key={idx} className="rounded-lg border bg-card p-3 space-y-2">
                <Link 
                  to={`/contracts/${source.contract_id}`}
                  className="font-medium text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {name}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </Link>
                {parties && (
                  <p className="text-xs text-muted-foreground">{parties}</p>
                )}
                <blockquote className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                  "{source.text}"
                </blockquote>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Message component with proper markdown rendering
const ChatMessage = ({ message }: { message: ContractChatMessage }) => {
  const isUser = message.role === 'user';

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
          <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                p: ({ children }) => <p className="my-2">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 my-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                code: ({ children }) => (
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-muted rounded p-2 my-2 overflow-x-auto text-xs">{children}</pre>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
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
