import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FileDropzone } from '@/components/FileDropzone';
import { FileSelected } from '@/components/FileSelected';
import { ProcessingState } from '@/components/ProcessingState';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { uploadContract } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

type UploadState = 'idle' | 'selected' | 'uploading' | 'error';

const Upload = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setState('selected');
    setError(null);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setState('idle');
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setState('uploading');
    setError(null);
    abortController.current = new AbortController();

    try {
      const result = await uploadContract(selectedFile);
      // Invalidate contracts list cache so it refreshes when user navigates there
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: 'Contract uploaded',
        description: 'Metadata has been extracted successfully.',
      });
      navigate(`/contracts/${result.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setState('error');
      toast({
        title: 'Upload failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    abortController.current?.abort();
    setState('selected');
  };

  const handleRetry = () => {
    handleUpload();
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="flex flex-col items-center justify-center p-6" style={{ minHeight: 'calc(100vh - 65px)' }}>
        <div className="w-full max-w-[600px]">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Upload Contract
            </h2>
            <p className="text-muted-foreground mt-2">
              Upload contracts for AI-powered metadata extraction
            </p>
          </div>

        <Card className="p-6">
          {state === 'uploading' ? (
            <ProcessingState onCancel={handleCancel} />
          ) : state === 'selected' && selectedFile ? (
            <FileSelected
              file={selectedFile}
              onClear={handleClearFile}
              onUpload={handleUpload}
              isUploading={false}
            />
          ) : (
            <FileDropzone
              onFileSelect={handleFileSelect}
              disabled={false}
            />
          )}

          {state === 'error' && error && (
            <div className="mt-4 text-center">
              <p className="text-sm text-destructive mb-3">{error}</p>
              <button
                onClick={handleRetry}
                className="text-sm text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </Card>
      </div>
    </main>
  </div>
  );
};

export default Upload;
