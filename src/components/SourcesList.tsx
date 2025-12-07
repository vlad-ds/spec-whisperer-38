import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Source } from '@/hooks/useChat';

interface SourcesListProps {
  sources: Source[];
}

const topicColors: Record<string, string> = {
  DORA: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  MiCA: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  GDPR: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  default: 'bg-muted text-muted-foreground',
};

export const SourcesList = ({ sources }: SourcesListProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

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
        <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-border divide-y divide-border">
          {sources.map((source, index) => (
            <div key={index} className="px-3 py-2 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    'text-xs',
                    topicColors[source.topic] || topicColors.default
                  )}
                >
                  {source.topic}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {Math.round(source.score * 100)}% match
                </span>
              </div>
              <p className="font-medium text-foreground mb-1">{source.doc_id}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {source.text.length > 200 ? source.text.slice(0, 200) + '...' : source.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
