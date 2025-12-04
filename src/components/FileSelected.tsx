import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileSelectedProps {
  file: File;
  onClear: () => void;
  onUpload: () => void;
  isUploading: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileSelected = ({ file, onClear, onUpload, isUploading }: FileSelectedProps) => {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-primary/10 p-3">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{file.name}</p>
          <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
        </div>
        {!isUploading && (
          <button
            onClick={onClear}
            className="rounded-full p-1 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
      </div>
      
      <Button 
        onClick={onUpload} 
        className="w-full mt-4"
        disabled={isUploading}
      >
        Upload & Extract
      </Button>
    </div>
  );
};
