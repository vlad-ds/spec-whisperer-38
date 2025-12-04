import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight, Sparkles, PenLine, Quote } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Citation } from '@/lib/api';

interface FieldWithCitationProps {
  label: string;
  children: ReactNode;
  citation?: Citation;
  currentValue: string;
  className?: string;
}

export const FieldWithCitation = ({
  label,
  children,
  citation,
  currentValue,
  className,
}: FieldWithCitationProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const hasCitation = citation && (citation.quote || citation.reasoning);
  // Only show "Edited" if we have an AI value to compare against
  const isEdited = hasCitation && citation?.ai_value && citation.ai_value !== currentValue;

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </label>
        {isEdited && (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
            <PenLine className="h-3 w-3" />
            Edited
          </Badge>
        )}
      </div>
      
      {children}
      
      {hasCitation && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Sparkles className="h-4 w-4" />
            View AI extraction details
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3 space-y-3">
            {citation.quote && (
              <div className="rounded-lg bg-muted/50 p-4 border-l-2 border-primary/30">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  <Quote className="h-3 w-3" />
                  Quote from PDF
                </div>
                <p className="text-sm text-foreground/80 italic">
                  "{citation.quote}"
                </p>
              </div>
            )}
            
            {citation.reasoning && (
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  AI Reasoning
                </div>
                <p className="text-sm text-foreground/80">
                  {citation.reasoning}
                </p>
              </div>
            )}
            
            {citation.ai_value && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  AI Value:
                </div>
                <code className="text-sm font-mono text-primary">
                  {citation.ai_value}
                </code>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
};
