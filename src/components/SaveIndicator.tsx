import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
}

export const SaveIndicator = ({ status }: SaveIndicatorProps) => {
  if (status === 'idle') return null;

  return (
    <div className={cn(
      'flex items-center gap-1.5 text-xs transition-opacity',
      status === 'error' ? 'text-destructive' : 'text-muted-foreground'
    )}>
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-success" />
          <span>Saved</span>
        </>
      )}
      {status === 'error' && (
        <span>Failed to save</span>
      )}
    </div>
  );
};
