import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  FileText,
  AlertCircle,
  Search,
  Clock,
  FileCheck,
  Bell,
  ExternalLink,
  ChevronDown,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { AppHeader } from "@/components/AppHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

// Types
interface ContractRecord {
  id: string;
  fields: {
    parties?: string;
    contract_type?: string;
    expiration_date?: string;
    notice_deadline?: string;
    first_renewal_date?: string;
    governing_law?: string;
    status?: string;
    filename?: string;
  };
}

interface RegulatoryData {
  total_documents: number;
  material_documents: number;
  documents_by_topic: Record<string, number>;
}

// Helper functions
const parseParties = (parties: string | undefined): string[] => {
  if (!parties) return [];
  try {
    const parsed = JSON.parse(parties);
    return Array.isArray(parsed) ? parsed : [parties];
  } catch {
    return parties ? [parties] : [];
  }
};

const isWithinDays = (dateStr: string | null | undefined, days: number): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return date >= now && date <= future;
};

const getDaysUntil = (dateStr: string | null | undefined): number | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getEarliestDeadline = (contract: ContractRecord): { date: string | null; days: number | null } => {
  const deadlines = [
    contract.fields.notice_deadline,
    contract.fields.expiration_date,
  ].filter(Boolean) as string[];
  
  if (deadlines.length === 0) return { date: null, days: null };
  
  const sorted = deadlines.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const earliest = sorted[0];
  return { date: earliest, days: getDaysUntil(earliest) };
};

// Chart colors using design tokens
const CHART_COLORS = [
  "hsl(221, 83%, 53%)", // primary
  "hsl(142, 71%, 45%)", // success
  "hsl(48, 96%, 53%)",  // warning
  "hsl(0, 84%, 60%)",   // destructive
  "hsl(220, 14%, 46%)", // muted-foreground
  "hsl(270, 60%, 60%)", // purple accent
];

const TOPIC_COLORS: Record<string, string> = {
  DORA: "hsl(221, 83%, 53%)",
  MiCA: "hsl(142, 71%, 45%)",
  AIFMD: "hsl(48, 96%, 53%)",
  AML: "hsl(0, 84%, 60%)",
  AI: "hsl(270, 60%, 60%)",
  ESG: "hsl(180, 60%, 45%)",
};


// KPI Card component
const KPICard = ({
  title,
  value,
  icon: Icon,
  loading,
  variant = "default",
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  loading?: boolean;
  variant?: "default" | "warning" | "success" | "destructive";
}) => {
  const variantStyles = {
    default: "border-border",
    warning: "border-warning/50 bg-warning/5",
    success: "border-success/50 bg-success/5",
    destructive: "border-destructive/50 bg-destructive/5",
  };

  return (
    <Card className={`${variantStyles[variant]}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
};

// Filter bar component
const FilterBar = ({
  selectedParties,
  setSelectedParties,
  selectedJurisdiction,
  setSelectedJurisdiction,
  selectedTypes,
  setSelectedTypes,
  allParties,
  jurisdictions,
  contractTypes,
}: {
  selectedParties: string[];
  setSelectedParties: (value: string[]) => void;
  selectedJurisdiction: string;
  setSelectedJurisdiction: (value: string) => void;
  selectedTypes: string[];
  setSelectedTypes: (value: string[]) => void;
  allParties: string[];
  jurisdictions: string[];
  contractTypes: string[];
}) => {
  const toggleParty = (party: string) => {
    if (selectedParties.includes(party)) {
      setSelectedParties(selectedParties.filter((p) => p !== party));
    } else {
      setSelectedParties([...selectedParties, party]);
    }
  };

  const clearParties = () => {
    setSelectedParties([]);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border">
      {/* Party Multi-Select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[200px] justify-between gap-2">
            <span className="truncate">
              {selectedParties.length === 0
                ? "All Parties"
                : selectedParties.length === 1
                ? selectedParties[0]
                : `${selectedParties.length} parties selected`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0 bg-popover" align="start">
          <div className="p-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Select Parties</span>
            {selectedParties.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearParties} className="h-auto py-1 px-2 text-xs">
                Clear all
              </Button>
            )}
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-2 space-y-1">
              {allParties.map((party) => (
                <label
                  key={party}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedParties.includes(party)}
                    onCheckedChange={() => toggleParty(party)}
                  />
                  <span className="text-sm truncate">{party}</span>
                </label>
              ))}
              {allParties.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No parties found
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      
      <Select value={selectedJurisdiction} onValueChange={setSelectedJurisdiction}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Jurisdiction" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="all">All Jurisdictions</SelectItem>
          {jurisdictions.map((j) => (
            <SelectItem key={j} value={j}>{j}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select 
        value={selectedTypes.length === 1 ? selectedTypes[0] : "all"} 
        onValueChange={(v) => setSelectedTypes(v === "all" ? [] : [v])}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Contract Type" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="all">All Types</SelectItem>
          {contractTypes.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" disabled className="gap-2">
            Cost
            <Badge variant="secondary" className="text-xs">Soon</Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Coming Soon</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" disabled className="gap-2">
            Risk
            <Badge variant="secondary" className="text-xs">Soon</Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Coming Soon</TooltipContent>
      </Tooltip>
    </div>
  );
};

// Contracts by Type Chart
const ContractsByTypeChart = ({ data }: { data: { name: string; value: number }[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contracts by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Upcoming Deadlines Chart
const DeadlinesChart = ({ data }: { data: { month: string; deadlines: number }[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming Deadlines (Next 6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" allowDecimals={false} />
              <RechartsTooltip />
              <Bar dataKey="deadlines" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Renewals Table
const RenewalsTable = ({ contracts }: { contracts: ContractRecord[] }) => {
  const upcomingRenewals = useMemo(() => {
    return contracts
      .map((c) => {
        const { date, days } = getEarliestDeadline(c);
        return { contract: c, deadlineDate: date, daysUntil: days };
      })
      .filter(({ daysUntil }) => daysUntil !== null && daysUntil >= 0 && daysUntil <= 90)
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
  }, [contracts]);

  const getRowColor = (days: number | null) => {
    if (days === null) return "";
    if (days < 7) return "bg-destructive/10";
    if (days < 30) return "bg-warning/10";
    return "";
  };

  if (upcomingRenewals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Upcoming Renewals (90 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No upcoming deadlines in the next 90 days
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Upcoming Renewals (90 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Days Until</TableHead>
              <TableHead>Jurisdiction</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcomingRenewals.slice(0, 10).map(({ contract, deadlineDate, daysUntil }) => {
              const parties = parseParties(contract.fields.parties);
              return (
                <TableRow key={contract.id} className={getRowColor(daysUntil)}>
                  <TableCell className="font-medium">
                    <Link 
                      to={`/contracts/${contract.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {parties[0] || contract.fields.filename || "Unknown"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{contract.fields.contract_type || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    {deadlineDate ? new Date(deadlineDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={daysUntil !== null && daysUntil < 7 ? "destructive" : daysUntil !== null && daysUntil < 30 ? "outline" : "secondary"}
                    >
                      {daysUntil !== null ? `${daysUntil} days` : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contract.fields.governing_law || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

// Regulatory Summary
const RegulatorySummary = ({ data, loading }: { data: RegulatoryData | null; loading: boolean }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regulatory Updates This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regulatory Updates This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">No regulatory data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Regulatory Updates This Week</CardTitle>
        <Link to="/regulatory-digest">
          <Button variant="ghost" size="sm" className="gap-1">
            View All <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.documents_by_topic).map(([topic, count]) => (
              <Badge
                key={topic}
                style={{ backgroundColor: TOPIC_COLORS[topic] || "hsl(220, 14%, 46%)" }}
                className="text-white"
              >
                {topic}: {count}
              </Badge>
            ))}
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.material_documents}</span> material updates
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Analytics Page
const Analytics = () => {
  const [selectedParties, setSelectedParties] = useState<string[]>([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState("all");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Fetch contracts from Airtable
  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ["analytics-contracts"],
    queryFn: async () => {
      const allRecords: ContractRecord[] = [];
      let offset: string | undefined;

      do {
        const { data, error } = await supabase.functions.invoke("airtable-contracts", {
          body: null,
          method: "GET",
        });

        // Use fetch for GET with params
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const url = offset
          ? `${supabaseUrl}/functions/v1/airtable-contracts?offset=${offset}`
          : `${supabaseUrl}/functions/v1/airtable-contracts`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch contracts");
        }

        const result = await response.json();
        allRecords.push(...(result.records || []));
        offset = result.offset;
      } while (offset);

      return allRecords;
    },
    staleTime: 60000,
  });

  // Fetch regulatory data
  const { data: regulatoryData, isLoading: regulatoryLoading } = useQuery({
    queryKey: ["analytics-regulatory"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("regulatory-digest");
      if (error) throw error;
      return data as RegulatoryData;
    },
    staleTime: 300000,
  });

  const contracts = contractsData || [];

  // Extract unique values for filters
  const { allParties, jurisdictions, contractTypes } = useMemo(() => {
    const partySet = new Set<string>();
    const jurisdictionSet = new Set<string>();
    const typeSet = new Set<string>();

    contracts.forEach((c) => {
      const parties = parseParties(c.fields.parties);
      parties.forEach((p) => partySet.add(p));
      if (c.fields.governing_law) jurisdictionSet.add(c.fields.governing_law);
      if (c.fields.contract_type) typeSet.add(c.fields.contract_type);
    });

    return {
      allParties: Array.from(partySet).sort((a, b) => a.localeCompare(b)),
      jurisdictions: Array.from(jurisdictionSet).sort(),
      contractTypes: Array.from(typeSet).sort(),
    };
  }, [contracts]);

  // Apply filters
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      // Party filter
      if (selectedParties.length > 0) {
        const parties = parseParties(c.fields.parties);
        const hasSelectedParty = parties.some((p) => selectedParties.includes(p));
        if (!hasSelectedParty) return false;
      }

      // Jurisdiction filter
      if (selectedJurisdiction !== "all" && c.fields.governing_law !== selectedJurisdiction) {
        return false;
      }

      // Contract type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(c.fields.contract_type || "")) {
        return false;
      }

      return true;
    });
  }, [contracts, selectedParties, selectedJurisdiction, selectedTypes]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const underReview = filteredContracts.filter((c) => c.fields.status === "under_review").length;
    const upcomingRenewals = filteredContracts.filter((c) =>
      isWithinDays(c.fields.notice_deadline, 30) || isWithinDays(c.fields.expiration_date, 30)
    ).length;

    return {
      total: filteredContracts.length,
      underReview,
      upcomingRenewals,
      materialUpdates: regulatoryData?.material_documents || 0,
    };
  }, [filteredContracts, regulatoryData]);

  // Chart data: Contracts by type
  const contractsByTypeData = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    filteredContracts.forEach((c) => {
      const type = c.fields.contract_type || "Unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const sorted = Object.entries(typeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top 5 + Other
    if (sorted.length > 5) {
      const top5 = sorted.slice(0, 5);
      const otherValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
      return [...top5, { name: "Other", value: otherValue }];
    }

    return sorted;
  }, [filteredContracts]);

  // Chart data: Upcoming deadlines by month
  const deadlinesByMonthData = useMemo(() => {
    const monthCounts: Record<string, number> = {};
    const now = new Date();

    // Initialize next 6 months
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthCounts[key] = 0;
    }

    filteredContracts.forEach((c) => {
      const deadlines = [c.fields.expiration_date, c.fields.notice_deadline].filter(Boolean);
      deadlines.forEach((d) => {
        if (!d) return;
        const date = new Date(d);
        const monthsAhead = (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
        if (monthsAhead >= 0 && monthsAhead < 6) {
          const key = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
          if (key in monthCounts) {
            monthCounts[key]++;
          }
        }
      });
    });

    return Object.entries(monthCounts).map(([month, deadlines]) => ({ month, deadlines }));
  }, [filteredContracts]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Compliance Analytics</h2>
            <p className="text-muted-foreground text-sm">
              Overview of contracts and regulatory updates
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar
          selectedParties={selectedParties}
          setSelectedParties={setSelectedParties}
          selectedJurisdiction={selectedJurisdiction}
          setSelectedJurisdiction={setSelectedJurisdiction}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
          allParties={allParties}
          jurisdictions={jurisdictions}
          contractTypes={contractTypes}
        />

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Contracts"
            value={kpis.total}
            icon={FileText}
            loading={contractsLoading}
          />
          <KPICard
            title="Under Review"
            value={kpis.underReview}
            icon={FileCheck}
            loading={contractsLoading}
            variant={kpis.underReview > 0 ? "warning" : "default"}
          />
          <KPICard
            title="Upcoming Renewals (30d)"
            value={kpis.upcomingRenewals}
            icon={Clock}
            loading={contractsLoading}
            variant={kpis.upcomingRenewals > 0 ? "destructive" : "default"}
          />
          <KPICard
            title="Material Reg. Updates"
            value={kpis.materialUpdates}
            icon={Bell}
            loading={regulatoryLoading}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {contractsLoading ? (
            <>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[280px]" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[280px]" />
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <ContractsByTypeChart data={contractsByTypeData} />
              <DeadlinesChart data={deadlinesByMonthData} />
            </>
          )}
        </div>

        {/* Renewals Table */}
        {contractsLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px]" />
            </CardContent>
          </Card>
        ) : (
          <RenewalsTable contracts={filteredContracts} />
        )}

        {/* Regulatory Summary */}
        <RegulatorySummary data={regulatoryData || null} loading={regulatoryLoading} />
      </main>
    </div>
  );
};

export default Analytics;
