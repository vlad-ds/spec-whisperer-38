import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, ArrowUpDown, ArrowUp, ArrowDown, Trash2, ExternalLink, Info, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/AppHeader';
import { deleteContract, getContract, parseContract, uploadContract } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { FileDropzone } from '@/components/FileDropzone';
import { FileSelected } from '@/components/FileSelected';
import { ProcessingState } from '@/components/ProcessingState';

interface AirtableRecord {
  id: string;
  fields: {
    filename?: string;
    parties?: string;
    contract_type?: string;
    agreement_date?: string;
    effective_date?: string;
    expiration_date?: string;
    status?: string;
    governing_law?: string;
  };
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

type SortField = 'filename' | 'contract_type' | 'parties' | 'effective_date' | 'expiration_date' | 'status' | 'createdTime';
type SortDirection = 'asc' | 'desc';
type UploadState = 'idle' | 'selected' | 'uploading' | 'error';

const fetchContracts = async (): Promise<AirtableRecord[]> => {
  const { data, error } = await supabase.functions.invoke<AirtableResponse>('airtable-contracts');
  
  if (error) {
    throw new Error(error.message || 'Failed to fetch contracts');
  }
  
  return data?.records || [];
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
};

const parseParties = (parties: string | undefined): string[] => {
  if (!parties) return [];
  try {
    return JSON.parse(parties);
  } catch {
    return parties.split(',').map(p => p.trim());
  }
};


const SortableHeader = ({ 
  label, 
  field, 
  currentSort, 
  currentDirection, 
  onSort 
}: { 
  label: string; 
  field: SortField; 
  currentSort: SortField; 
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
}) => {
  const isActive = currentSort === field;
  
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => onSort(field)}
    >
      {label}
      {isActive ? (
        currentDirection === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
};

const ContractsList = () => {
  const [sortField, setSortField] = useState<SortField>('createdTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<AirtableRecord | null>(null);
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: contracts, isLoading, error } = useQuery({
    queryKey: ['contracts'],
    queryFn: fetchContracts,
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContract(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: 'Contract deleted',
        description: 'The contract has been successfully deleted.',
      });
      setDeleteDialogOpen(false);
      setContractToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete contract',
        variant: 'destructive',
      });
    },
  });

  // Upload handlers
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadState('selected');
    setUploadError(null);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setUploadState('idle');
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState('uploading');
    setUploadError(null);
    abortController.current = new AbortController();

    try {
      const result = await uploadContract(selectedFile);
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: 'Contract uploaded',
        description: 'Metadata has been extracted successfully.',
      });
      setUploadDialogOpen(false);
      setUploadState('idle');
      setSelectedFile(null);
      navigate(`/contracts/${result.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(message);
      setUploadState('error');
      toast({
        title: 'Upload failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleCancelUpload = () => {
    abortController.current?.abort();
    setUploadState('selected');
  };

  const handleRetryUpload = () => {
    handleUpload();
  };

  const handleCloseUploadDialog = () => {
    if (uploadState !== 'uploading') {
      setUploadDialogOpen(false);
      setUploadState('idle');
      setSelectedFile(null);
      setUploadError(null);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, contract: AirtableRecord) => {
    e.stopPropagation();
    setContractToDelete(contract);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (contractToDelete) {
      deleteMutation.mutate(contractToDelete.id);
    }
  };

  const prefetchContract = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: ['contract', id],
      queryFn: async () => {
        const record = await getContract(id);
        return parseContract(record);
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  const sortedContracts = useMemo(() => {
    if (!contracts) return [];
    
    return [...contracts].sort((a, b) => {
      let aValue: string | undefined;
      let bValue: string | undefined;
      
      switch (sortField) {
        case 'filename':
          aValue = a.fields.filename?.toLowerCase();
          bValue = b.fields.filename?.toLowerCase();
          break;
        case 'contract_type':
          aValue = a.fields.contract_type?.toLowerCase();
          bValue = b.fields.contract_type?.toLowerCase();
          break;
        case 'parties':
          aValue = parseParties(a.fields.parties).join(', ').toLowerCase();
          bValue = parseParties(b.fields.parties).join(', ').toLowerCase();
          break;
        case 'effective_date':
          aValue = a.fields.effective_date;
          bValue = b.fields.effective_date;
          break;
        case 'expiration_date':
          aValue = a.fields.expiration_date;
          bValue = b.fields.expiration_date;
          break;
        case 'status':
          aValue = a.fields.status;
          bValue = b.fields.status;
          break;
        case 'createdTime':
          aValue = a.createdTime;
          bValue = b.createdTime;
          break;
      }
      
      if (!aValue && !bValue) return 0;
      if (!aValue) return sortDirection === 'asc' ? 1 : -1;
      if (!bValue) return sortDirection === 'asc' ? -1 : 1;
      
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [contracts, sortField, sortDirection]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Alert className="mb-6 border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              <strong>Note:</strong> Contract fields should be edited via this site. Click on a contract below to edit it.
            </span>
            <a 
              href="https://airtable.com/appN3qGux4iVHtdU8/shrjlpeDlxZqd7UOq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline ml-4 text-sm font-medium shrink-0"
            >
              View in Airtable
              <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Contracts</h2>
            <p className="text-muted-foreground mt-1">
              Click on a contract to review and edit it
            </p>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Contract
          </Button>
        </div>

        {isLoading ? (
          <Card className="p-4">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </Card>
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-destructive">
              {error instanceof Error ? error.message : 'Failed to load contracts'}
            </p>
          </Card>
        ) : sortedContracts.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No contracts found</p>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload your first contract
            </Button>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader 
                      label="Filename" 
                      field="filename" 
                      currentSort={sortField} 
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader 
                      label="Type" 
                      field="contract_type" 
                      currentSort={sortField} 
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <SortableHeader 
                      label="Parties" 
                      field="parties" 
                      currentSort={sortField} 
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <SortableHeader 
                      label="Effective" 
                      field="effective_date" 
                      currentSort={sortField} 
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <SortableHeader 
                      label="Expires" 
                      field="expiration_date" 
                      currentSort={sortField} 
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader 
                      label="Status" 
                      field="status" 
                      currentSort={sortField} 
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <SortableHeader 
                      label="Uploaded" 
                      field="createdTime" 
                      currentSort={sortField} 
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContracts.map((contract) => {
                  const parties = parseParties(contract.fields.parties);
                  
                  return (
                    <TableRow 
                      key={contract.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/contracts/${contract.id}`)}
                      onMouseEnter={() => prefetchContract(contract.id)}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {contract.fields.filename || 'Untitled'}
                      </TableCell>
                      <TableCell className="capitalize">
                        {contract.fields.contract_type?.replace(/-/g, ' ') || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                        {parties.length > 0 ? parties.join(', ') : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatDate(contract.fields.effective_date)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatDate(contract.fields.expiration_date)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={contract.fields.status === 'reviewed' ? 'default' : 'secondary'}
                        >
                          {contract.fields.status === 'reviewed' ? 'Reviewed' : 'Under Review'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {formatDate(contract.createdTime)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteClick(e, contract)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{contractToDelete?.fields.filename || 'this contract'}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={handleCloseUploadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Contract</DialogTitle>
          </DialogHeader>
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-700">
              <strong>Demo only:</strong> Do not upload sensitive, confidential, or company documents.
            </AlertDescription>
          </Alert>
          <div className="py-4">
            {uploadState === 'uploading' ? (
              <ProcessingState onCancel={handleCancelUpload} />
            ) : uploadState === 'selected' && selectedFile ? (
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

            {uploadState === 'error' && uploadError && (
              <div className="mt-4 text-center">
                <p className="text-sm text-destructive mb-3">{uploadError}</p>
                <button
                  onClick={handleRetryUpload}
                  className="text-sm text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractsList;