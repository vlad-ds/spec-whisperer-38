import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Loader2, FileText, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { PartyInput } from '@/components/PartyInput';
import { DateField } from '@/components/DateField';
import { StatusBadge } from '@/components/StatusBadge';
import { SaveIndicator } from '@/components/SaveIndicator';
import {
  getContract,
  parseContract,
  markAsReviewed,
  updateField,
  getPdfUrl,
  getPdfProxyUrl,
  getCitations,
  type ParsedContract,
  type Citation,
} from '@/lib/api';
import { FieldWithCitation } from '@/components/FieldWithCitation';
import { toast } from '@/hooks/use-toast';
import { useAirtableSchema, DEFAULT_CONTRACT_TYPES } from '@/hooks/useAirtableSchema';

const ContractEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [contract, setContract] = useState<ParsedContract | null>(null);
  const [originalContract, setOriginalContract] = useState<ParsedContract | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch schema for select field options (cached in localStorage for 24h)
  const { data: schemaData } = useAirtableSchema();
  const contractTypes = schemaData?.selectFields?.contract_type ?? DEFAULT_CONTRACT_TYPES;

  // Fetch citations
  const { data: citations } = useQuery({
    queryKey: ['citations', id],
    queryFn: () => getCitations(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Helper to get citation by field name
  const getCitationForField = (fieldName: string): Citation | undefined => {
    return citations?.find(c => c.field_name === fieldName);
  };

  const { data, isLoading: loading, isError } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const record = await getContract(id!);
      return parseContract(record);
    },
    enabled: !!id,
    staleTime: 30 * 1000, // Consider stale after 30 seconds
    gcTime: 10 * 60 * 1000,
    refetchOnMount: 'always', // Always refetch when mounting to get fresh data
  });

  // Sync query data to local state
  useEffect(() => {
    if (data) {
      setContract(data);
      setOriginalContract(data);
    }
  }, [data]);

  // Handle error
  useEffect(() => {
    if (isError) {
      toast({
        title: 'Error',
        description: 'Failed to load contract',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [isError, navigate]);

  // Check if PDF is available - reset state when id changes
  useEffect(() => {
    if (!id) return;
    
    // Reset state immediately when id changes
    setHasPdf(false);
    setIsPdfLoading(true);
    
    const checkPdfAvailable = async () => {
      try {
        const result = await getPdfUrl(id);
        setHasPdf(!!result.pdfPath);
      } catch (error) {
        console.error('Failed to check PDF availability:', error);
        setHasPdf(false);
      } finally {
        setIsPdfLoading(false);
      }
    };
    
    checkPdfAvailable();
  }, [id]);

  const debouncedSave = useCallback(async (
    fieldName: string,
    originalValue: unknown,
    newValue: unknown
  ) => {
    if (!id) return;
    
    setSaveStatus('saving');
    
    try {
      await updateField(id, fieldName, originalValue, newValue);
      setSaveStatus('saved');
      
      // Update original contract to reflect the saved value
      setOriginalContract(prev => prev ? { ...prev, [fieldName]: newValue } : null);
      
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      setSaveStatus('error');
      
      // Revert to original value on error
      setContract(prev => prev ? { ...prev, [fieldName]: originalValue } : null);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('INVALID_MULTIPLE_CHOICE_OPTIONS') || errorMessage.includes('select option')) {
        toast({
          title: 'Invalid option',
          description: 'This value is not available. Please choose a different option.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Save failed',
          description: 'Could not save changes. Please try again.',
          variant: 'destructive',
        });
      }
    }
  }, [id]);

  const handleFieldChange = useCallback(<K extends keyof ParsedContract>(
    field: K,
    value: ParsedContract[K]
  ) => {
    if (!contract || !originalContract) return;
    
    setContract(prev => prev ? { ...prev, [field]: value } : null);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      debouncedSave(field, originalContract[field], value);
    }, 1000);
  }, [contract, originalContract, debouncedSave]);

  const handleToggleReview = async (markReviewed: boolean) => {
    if (!id) return;
    
    setIsMarkingReviewed(true);
    
    try {
      await markAsReviewed(id, markReviewed);
      setContract(prev => prev ? { ...prev, status: markReviewed ? 'reviewed' : 'under_review' } : null);
      setShowReviewDialog(false);
      toast({
        title: markReviewed ? 'Contract reviewed' : 'Contract unreviewed',
        description: markReviewed 
          ? 'This contract has been marked as reviewed.'
          : 'This contract has been marked as unreviewed.',
      });
    } catch {
      toast({
        title: 'Error',
        description: markReviewed ? 'Failed to mark as reviewed' : 'Failed to mark as unreviewed',
        variant: 'destructive',
      });
    } finally {
      setIsMarkingReviewed(false);
    }
  };

  // Show loading skeleton while fetching OR while data hasn't synced to state yet
  if (loading || (!contract && !isError)) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-[800px] mx-auto">
          <Skeleton className="h-10 w-24 mb-6" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-6 w-32 mb-6" />
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-16 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contract && isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Contract not found</p>
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  const isReviewed = contract.status === 'reviewed';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-[800px] mx-auto px-6 py-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex items-center gap-3">
            {hasPdf ? (
              <Button
                variant="outline"
                onClick={() => setShowPdfViewer(true)}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                View PDF
              </Button>
            ) : isPdfLoading ? (
              <Button variant="outline" disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading PDF...
              </Button>
            ) : null}
            
            <SaveIndicator status={saveStatus} />
            
            {isReviewed ? (
              <Button 
                variant="destructive" 
                onClick={() => setShowReviewDialog(true)}
                className="gap-2"
              >
                Mark as Unreviewed
              </Button>
            ) : (
              <Button onClick={() => setShowReviewDialog(true)}>
                Mark as Reviewed
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {contract.filename}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <StatusBadge status={contract.status} />
          </div>
        </div>

        <div className="space-y-6">
          {/* Parties */}
          <FieldWithCitation
            label="Parties"
            citation={getCitationForField('parties')}
          >
            <PartyInput
              parties={contract.parties}
              onChange={(parties) => handleFieldChange('parties', parties)}
            />
          </FieldWithCitation>

          {/* Contract Type */}
          <FieldWithCitation
            label="Contract Type"
            citation={getCitationForField('contract_type')}
          >
            <Select
              value={contract.contractType}
              onValueChange={(value) => handleFieldChange('contractType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contract type" />
              </SelectTrigger>
              <SelectContent>
                {contractTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.split('-').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldWithCitation>

          {/* Contract Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldWithCitation
              label="Agreement Date"
              citation={getCitationForField('agreement_date')}
            >
              <DateField
                value={contract.agreementDate}
                onChange={(date) => handleFieldChange('agreementDate', date)}
              />
            </FieldWithCitation>
            <FieldWithCitation
              label="Effective Date"
              citation={getCitationForField('effective_date')}
            >
              <DateField
                value={contract.effectiveDate}
                onChange={(date) => handleFieldChange('effectiveDate', date)}
              />
            </FieldWithCitation>
          </div>

          {/* Key Deadlines Section */}
          <div className="border border-destructive/30 rounded-lg p-4 bg-destructive/5">
            <div className="text-xs font-medium text-destructive mb-4 uppercase tracking-wide flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Key Deadlines
            </div>
            
            {/* Expiration Date - Primary Deadline */}
            <div className="mb-4">
              <FieldWithCitation
                label="Expiration Date"
                citation={getCitationForField('expiration_date')}
              >
                <DateField
                  value={contract.expirationDate}
                  onChange={(date) => handleFieldChange('expirationDate', date)}
                />
              </FieldWithCitation>
            </div>

            {/* Notice Period → Notice Deadline */}
            <div className="border-t border-destructive/20 pt-4 mb-4">
              <div className="text-xs text-muted-foreground mb-2">Notice Terms</div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                <FieldWithCitation
                  label="Notice Period"
                  citation={getCitationForField('notice_period')}
                >
                  <Input
                    value={contract.noticePeriod}
                    onChange={(e) => handleFieldChange('noticePeriod', e.target.value)}
                    placeholder="e.g., 90 days prior written notice"
                  />
                </FieldWithCitation>
                <div className="hidden md:flex items-center justify-center h-full pt-8">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <FieldWithCitation
                  label="Notice Deadline"
                  citation={getCitationForField('notice_deadline')}
                >
                  <DateField
                    value={contract.noticeDeadline}
                    onChange={(date) => handleFieldChange('noticeDeadline', date)}
                  />
                </FieldWithCitation>
              </div>
            </div>

            {/* Renewal Term → First Renewal Date */}
            <div className="border-t border-destructive/20 pt-4">
              <div className="text-xs text-muted-foreground mb-2">Renewal Terms</div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                <FieldWithCitation
                  label="Renewal Term"
                  citation={getCitationForField('renewal_term')}
                >
                  <Textarea
                    value={contract.renewalTerm}
                    onChange={(e) => handleFieldChange('renewalTerm', e.target.value)}
                    placeholder="Enter renewal term details..."
                    rows={3}
                  />
                </FieldWithCitation>
                <div className="hidden md:flex items-center justify-center h-full pt-8">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <FieldWithCitation
                  label="First Renewal Date"
                  citation={getCitationForField('first_renewal_date')}
                >
                  <DateField
                    value={contract.firstRenewalDate}
                    onChange={(date) => handleFieldChange('firstRenewalDate', date)}
                  />
                </FieldWithCitation>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* PDF Viewer Sheet */}
      <Sheet open={showPdfViewer} onOpenChange={setShowPdfViewer}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {contract?.filename}
            </SheetTitle>
          </SheetHeader>
          {hasPdf && id && (
            <iframe
              src={getPdfProxyUrl(id)}
              className="w-full h-[calc(100vh-80px)]"
              title="PDF Viewer"
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isReviewed ? 'Mark as Unreviewed' : 'Mark as Reviewed'}</DialogTitle>
            <DialogDescription>
              {isReviewed 
                ? 'Are you sure you want to mark this contract as unreviewed? This will indicate that the extracted data needs to be re-verified.'
                : 'Are you sure you want to mark this contract as reviewed? This indicates that all extracted data has been verified.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowReviewDialog(false)}
              disabled={isMarkingReviewed}
            >
              Cancel
            </Button>
            <Button 
              variant={isReviewed ? 'destructive' : 'default'}
              onClick={() => handleToggleReview(!isReviewed)}
              disabled={isMarkingReviewed}
            >
              {isMarkingReviewed && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractEditor;
