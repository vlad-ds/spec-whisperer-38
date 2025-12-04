import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
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
  CONTRACT_TYPES,
  type ParsedContract,
} from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const ContractEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [contract, setContract] = useState<ParsedContract | null>(null);
  const [originalContract, setOriginalContract] = useState<ParsedContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchContract = async () => {
      if (!id) return;
      
      try {
        const record = await getContract(id);
        const parsed = parseContract(record);
        setContract(parsed);
        setOriginalContract(parsed);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load contract',
          variant: 'destructive',
        });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchContract();
  }, [id, navigate]);

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
      
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      savedTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch {
      setSaveStatus('error');
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

  const handleMarkReviewed = async () => {
    if (!id) return;
    
    setIsMarkingReviewed(true);
    
    try {
      await markAsReviewed(id);
      setContract(prev => prev ? { ...prev, status: 'reviewed' } : null);
      setShowReviewDialog(false);
      toast({
        title: 'Contract reviewed',
        description: 'This contract has been marked as reviewed.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to mark as reviewed',
        variant: 'destructive',
      });
    } finally {
      setIsMarkingReviewed(false);
    }
  };

  if (loading) {
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

  if (!contract) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Contract not found</p>
      </div>
    );
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
            <SaveIndicator status={saveStatus} />
            
            {isReviewed ? (
              <Button disabled className="gap-2">
                <Check className="h-4 w-4" />
                Reviewed
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
          <Card className="p-6">
            <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Parties
            </label>
            <PartyInput
              parties={contract.parties}
              onChange={(parties) => handleFieldChange('parties', parties)}
            />
          </Card>

          {/* Contract Type */}
          <Card className="p-6">
            <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Contract Type
            </label>
            <Select
              value={contract.contractType}
              onValueChange={(value) => handleFieldChange('contractType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contract type" />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.split('-').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Dates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <DateField
                label="Agreement Date"
                value={contract.agreementDate}
                onChange={(date) => handleFieldChange('agreementDate', date)}
              />
            </Card>
            <Card className="p-6">
              <DateField
                label="Effective Date"
                value={contract.effectiveDate}
                onChange={(date) => handleFieldChange('effectiveDate', date)}
              />
            </Card>
            <Card className="p-6">
              <DateField
                label="Expiration Date"
                value={contract.expirationDate}
                onChange={(date) => handleFieldChange('expirationDate', date)}
              />
            </Card>
            <Card className="p-6">
              <DateField
                label="Notice Deadline"
                value={contract.noticeDeadline}
                onChange={(date) => handleFieldChange('noticeDeadline', date)}
              />
            </Card>
          </div>

          {/* Text Fields */}
          <Card className="p-6">
            <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Governing Law
            </label>
            <Input
              value={contract.governingLaw}
              onChange={(e) => handleFieldChange('governingLaw', e.target.value)}
              placeholder="e.g., State of Delaware"
            />
          </Card>

          <Card className="p-6">
            <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Notice Period
            </label>
            <Input
              value={contract.noticePeriod}
              onChange={(e) => handleFieldChange('noticePeriod', e.target.value)}
              placeholder="e.g., 90 days prior written notice"
            />
          </Card>

          <Card className="p-6">
            <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Renewal Term
            </label>
            <Textarea
              value={contract.renewalTerm}
              onChange={(e) => handleFieldChange('renewalTerm', e.target.value)}
              placeholder="Enter renewal term details..."
              rows={4}
            />
          </Card>
        </div>
      </main>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Reviewed</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this contract as reviewed? This indicates that all extracted data has been verified.
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
              onClick={handleMarkReviewed}
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
