import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
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
import { FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  
  const { data: contracts, isLoading, error } = useQuery({
    queryKey: ['contracts'],
    queryFn: fetchContracts,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
            <p className="text-muted-foreground">No contracts found</p>
            <Link 
              to="/" 
              className="text-primary hover:underline mt-2 inline-block"
            >
              Upload your first contract
            </Link>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContracts.map((contract) => {
                  const parties = parseParties(contract.fields.parties);
                  
                  return (
                    <TableRow 
                      key={contract.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => window.location.href = `/contracts/${contract.id}`}
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ContractsList;
