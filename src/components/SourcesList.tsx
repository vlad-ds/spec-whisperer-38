import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Source } from '@/hooks/useChat';

const getEurLexUrl = (docId: string) => 
  `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${docId}`;

interface SourcesListProps {
  sources: Source[];
}

interface GroupedDocument {
  doc_id: string;
  title: string;
  topic: string;
  chunks: Source[];
  totalScore: number;
  maxScore: number;
}

const topicColors: Record<string, string> = {
  DORA: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  MiCA: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  GDPR: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  default: 'bg-muted text-muted-foreground',
};

const DocumentItem = ({ doc }: { doc: GroupedDocument }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge 
              variant="secondary" 
              className={cn(
                'text-xs',
                topicColors[doc.topic] || topicColors.default
              )}
            >
              {doc.topic}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {Math.round(doc.maxScore * 100)}% match
            </span>
            <span className="text-xs text-muted-foreground">
              • {doc.chunks.length} chunk{doc.chunks.length !== 1 ? 's' : ''}
            </span>
          </div>
          {doc.title && (
            <p className="font-medium text-foreground line-clamp-2">{doc.title}</p>
          )}
          <p className="text-xs text-muted-foreground truncate">{doc.doc_id}</p>
        </div>
        <a
          href={getEurLexUrl(doc.doc_id)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View
        </a>
      </button>

      {isExpanded && (
        <div className="pl-8 pr-3 pb-2 space-y-2">
          {doc.chunks.map((chunk, index) => (
            <div 
              key={index} 
              className="bg-muted/30 rounded-md p-2 text-xs"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-muted-foreground">
                  Chunk {index + 1}
                </span>
                <span className="text-muted-foreground">
                  • {Math.round(chunk.score * 100)}% match
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {chunk.text.length > 300 ? chunk.text.slice(0, 300) + '...' : chunk.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SourcesList = ({ sources }: SourcesListProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const groupedDocs = useMemo(() => {
    if (!sources || sources.length === 0) return [];
    console.log('Sources received:', sources.slice(0, 2).map(s => ({ doc_id: s.doc_id, title: s.title })));

    // Group sources by doc_id
    const docMap = new Map<string, GroupedDocument>();
    
    for (const source of sources) {
      const existing = docMap.get(source.doc_id);
      if (existing) {
        existing.chunks.push(source);
        existing.totalScore += source.score;
        existing.maxScore = Math.max(existing.maxScore, source.score);
      } else {
        docMap.set(source.doc_id, {
          doc_id: source.doc_id,
          title: source.title || '',
          topic: source.topic,
          chunks: [source],
          totalScore: source.score,
          maxScore: source.score,
        });
      }
    }

    // Sort by relevance: first by max score, then by total score (more chunks = more relevant)
    return Array.from(docMap.values()).sort((a, b) => {
      if (b.maxScore !== a.maxScore) return b.maxScore - a.maxScore;
      return b.totalScore - a.totalScore;
    });
  }, [sources]);

  if (groupedDocs.length === 0) return null;

  return (
    <div className="mt-2 border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <FileText className="h-4 w-4" />
        <span>{groupedDocs.length} document{groupedDocs.length !== 1 ? 's' : ''}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {groupedDocs.map((doc) => (
            <DocumentItem key={doc.doc_id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
};
