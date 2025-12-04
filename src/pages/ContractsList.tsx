import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Calendar, Users, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

const NavItem = ({ to, children }: { to: string; children: React.ReactNode }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={cn(
        'text-sm font-medium transition-colors hover:text-primary',
        isActive ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      {children}
    </Link>
  );
};

const ContractsList = () => {
  const { data: contracts, isLoading, error } = useQuery({
    queryKey: ['contracts'],
    queryFn: fetchContracts,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">ComplyFlow</h1>
          <nav className="flex gap-4">
            <NavItem to="/">Upload</NavItem>
            <NavItem to="/contracts">Contracts</NavItem>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Contracts</h2>
          <p className="text-muted-foreground mt-1">
            View and manage your uploaded contracts
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-destructive">
              {error instanceof Error ? error.message : 'Failed to load contracts'}
            </p>
          </Card>
        ) : contracts?.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No contracts found</p>
            <Link 
              to="/" 
              className="text-primary hover:underline mt-2 inline-block"
            >
              Upload your first contract
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contracts?.map((contract) => {
              const parties = parseParties(contract.fields.parties);
              
              return (
                <Link 
                  key={contract.id} 
                  to={`/contracts/${contract.id}`}
                  className="block"
                >
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-medium line-clamp-2">
                          {contract.fields.filename || 'Untitled Contract'}
                        </CardTitle>
                        <Badge 
                          variant={contract.fields.status === 'reviewed' ? 'default' : 'secondary'}
                          className="shrink-0"
                        >
                          {contract.fields.status || 'under_review'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {contract.fields.contract_type && (
                        <p className="text-sm text-muted-foreground capitalize">
                          {contract.fields.contract_type.replace(/-/g, ' ')}
                        </p>
                      )}
                      
                      {parties.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4 shrink-0" />
                          <span className="truncate">{parties.join(', ')}</span>
                        </div>
                      )}
                      
                      {contract.fields.effective_date && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 shrink-0" />
                          <span>Effective: {formatDate(contract.fields.effective_date)}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center text-primary text-sm pt-2">
                        <span>View details</span>
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default ContractsList;
