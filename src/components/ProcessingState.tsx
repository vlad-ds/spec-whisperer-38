import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProcessingStateProps {
  onCancel: () => void;
}

export const ProcessingState = ({ onCancel }: ProcessingStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative rounded-full bg-primary/10 p-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Analyzing your contract...
      </h3>
      <p className="text-sm text-muted-foreground mb-1">
        Our AI is reading and extracting key metadata
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        This typically takes 1-3 minutes. Please don't close this page.
      </p>
      
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
};
