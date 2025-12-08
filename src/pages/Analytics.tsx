import { useState, useMemo, createContext, useContext } from "react";
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
  Calendar,
  Info,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    effective_date?: string;
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

// Simulated date for demo purposes (October 1, 2013)
const SIMULATED_DATE = new Date(2013, 9, 1); // Month is 0-indexed

// Context for sharing the current "now" date across components
const DateContext = createContext<Date>(new Date());

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

const isWithinDays = (dateStr: string | null | undefined, days: number, referenceDate: Date): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date(referenceDate);
  now.setHours(0, 0, 0, 0);
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return date >= now && date <= future;
};

const getDaysUntil = (dateStr: string | null | undefined, referenceDate: Date): number | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date(referenceDate);
  now.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getEarliestDeadline = (contract: ContractRecord, referenceDate: Date): { date: string | null; days: number | null } => {
  const deadlines = [
    contract.fields.notice_deadline,
    contract.fields.expiration_date,
  ].filter(Boolean) as string[];
  
  if (deadlines.length === 0) return { date: null, days: null };
  
  const sorted = deadlines.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const earliest = sorted[0];
  return { date: earliest, days: getDaysUntil(earliest, referenceDate) };
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
  selectedJurisdictions,
  setSelectedJurisdictions,
  selectedTypes,
  setSelectedTypes,
  selectedStatuses,
  setSelectedStatuses,
  allParties,
  jurisdictions,
  contractTypes,
}: {
  selectedParties: string[];
  setSelectedParties: (value: string[]) => void;
  selectedJurisdictions: string[];
  setSelectedJurisdictions: (value: string[]) => void;
  selectedTypes: string[];
  setSelectedTypes: (value: string[]) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (value: string[]) => void;
  allParties: string[];
  jurisdictions: string[];
  contractTypes: string[];
}) => {
  const statusOptions = [
    { value: "under_review", label: "Under Review" },
    { value: "reviewed", label: "Reviewed" },
  ];
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

  const toggleJurisdiction = (jurisdiction: string) => {
    if (selectedJurisdictions.includes(jurisdiction)) {
      setSelectedJurisdictions(selectedJurisdictions.filter((j) => j !== jurisdiction));
    } else {
      setSelectedJurisdictions([...selectedJurisdictions, jurisdiction]);
    }
  };

  const clearJurisdictions = () => {
    setSelectedJurisdictions([]);
  };

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const clearTypes = () => {
    setSelectedTypes([]);
  };

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
    } else {
      setSelectedStatuses([...selectedStatuses, status]);
    }
  };

  const clearStatuses = () => {
    setSelectedStatuses([]);
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
              {allParties.length > 0 && (
                <label
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer border-b pb-2 mb-1"
                >
                  <Checkbox
                    checked={selectedParties.length === allParties.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedParties(allParties);
                      } else {
                        setSelectedParties([]);
                      }
                    }}
                  />
                  <span className="text-sm font-medium">Select All</span>
                </label>
              )}
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

      
      {/* Jurisdiction Multi-Select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[180px] justify-between gap-2">
            <span className="truncate">
              {selectedJurisdictions.length === 0
                ? "All Jurisdictions"
                : selectedJurisdictions.length === 1
                ? selectedJurisdictions[0]
                : `${selectedJurisdictions.length} jurisdictions`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0 bg-popover" align="start">
          <div className="p-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Select Jurisdictions</span>
            {selectedJurisdictions.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearJurisdictions} className="h-auto py-1 px-2 text-xs">
                Clear all
              </Button>
            )}
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-2 space-y-1">
              {jurisdictions.length > 0 && (
                <label
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer border-b pb-2 mb-1"
                >
                  <Checkbox
                    checked={selectedJurisdictions.length === jurisdictions.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedJurisdictions(jurisdictions);
                      } else {
                        setSelectedJurisdictions([]);
                      }
                    }}
                  />
                  <span className="text-sm font-medium">Select All</span>
                </label>
              )}
              {jurisdictions.map((jurisdiction) => (
                <label
                  key={jurisdiction}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedJurisdictions.includes(jurisdiction)}
                    onCheckedChange={() => toggleJurisdiction(jurisdiction)}
                  />
                  <span className="text-sm truncate">{jurisdiction}</span>
                </label>
              ))}
              {jurisdictions.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No jurisdictions found
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Contract Type Multi-Select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[180px] justify-between gap-2">
            <span className="truncate">
              {selectedTypes.length === 0
                ? "All Types"
                : selectedTypes.length === 1
                ? selectedTypes[0]
                : `${selectedTypes.length} types`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0 bg-popover" align="start">
          <div className="p-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Select Types</span>
            {selectedTypes.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearTypes} className="h-auto py-1 px-2 text-xs">
                Clear all
              </Button>
            )}
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-2 space-y-1">
              {contractTypes.length > 0 && (
                <label
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer border-b pb-2 mb-1"
                >
                  <Checkbox
                    checked={selectedTypes.length === contractTypes.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTypes(contractTypes);
                      } else {
                        setSelectedTypes([]);
                      }
                    }}
                  />
                  <span className="text-sm font-medium">Select All</span>
                </label>
              )}
              {contractTypes.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                  />
                  <span className="text-sm truncate">{type}</span>
                </label>
              ))}
              {contractTypes.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No types found
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Status Multi-Select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[150px] justify-between gap-2">
            <span className="truncate">
              {selectedStatuses.length === 0
                ? "All Statuses"
                : selectedStatuses.length === 1
                ? statusOptions.find(s => s.value === selectedStatuses[0])?.label
                : `${selectedStatuses.length} statuses`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0 bg-popover" align="start">
          <div className="p-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Select Status</span>
            {selectedStatuses.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearStatuses} className="h-auto py-1 px-2 text-xs">
                Clear all
              </Button>
            )}
          </div>
          <div className="p-2 space-y-1">
            <label
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer border-b pb-2 mb-1"
            >
              <Checkbox
                checked={selectedStatuses.length === statusOptions.length}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedStatuses(statusOptions.map(s => s.value));
                  } else {
                    setSelectedStatuses([]);
                  }
                }}
              />
              <span className="text-sm font-medium">Select All</span>
            </label>
            {statusOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selectedStatuses.includes(option.value)}
                  onCheckedChange={() => toggleStatus(option.value)}
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      
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
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contracts by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="h-[200px] w-[200px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2">
            {data.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-sm flex-shrink-0" 
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium">{item.value}</span>
                <span className="text-muted-foreground">({((item.value / total) * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Deadline Calendar Heatmap
const DeadlineCalendarHeatmap = ({ 
  contracts, 
  referenceDate 
}: { 
  contracts: ContractRecord[]; 
  referenceDate: Date;
}) => {
  // Build a map of dates to deadlines
  const deadlineMap = useMemo(() => {
    const map = new Map<string, { count: number; contracts: { id: string; name: string; type: string }[] }>();
    
    contracts.forEach(c => {
      const deadlines = [
        c.fields.expiration_date,
        c.fields.notice_deadline,
      ].filter(Boolean) as string[];
      
      const parties = parseParties(c.fields.parties);
      const name = parties[0] || c.fields.filename || 'Unknown';
      
      deadlines.forEach(d => {
        const dateKey = d.split('T')[0]; // YYYY-MM-DD
        const existing = map.get(dateKey) || { count: 0, contracts: [] };
        existing.count++;
        existing.contracts.push({ 
          id: c.id, 
          name, 
          type: c.fields.contract_type || 'Unknown' 
        });
        map.set(dateKey, existing);
      });
    });
    
    return map;
  }, [contracts]);

  // Generate 4 months of calendar data starting from reference date
  const calendarMonths = useMemo(() => {
    const months: { 
      label: string; 
      weeks: { 
        days: { 
          date: Date; 
          dateKey: string;
          isCurrentMonth: boolean; 
          isToday: boolean;
          deadlines: { count: number; contracts: { id: string; name: string; type: string }[] } | null;
        }[] 
      }[] 
    }[] = [];

    for (let m = 0; m < 4; m++) {
      const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + m, 1);
      const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + m + 1, 0);
      
      const label = monthStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const weeks: typeof months[0]['weeks'] = [];
      
      // Start from the Sunday of the week containing the 1st
      const calStart = new Date(monthStart);
      calStart.setDate(calStart.getDate() - calStart.getDay());
      
      let currentWeek: typeof weeks[0] = { days: [] };
      const current = new Date(calStart);
      
      // Generate up to 6 weeks
      for (let w = 0; w < 6; w++) {
        currentWeek = { days: [] };
        for (let d = 0; d < 7; d++) {
          const dateKey = current.toISOString().split('T')[0];
          const isCurrentMonth = current.getMonth() === monthStart.getMonth();
          const isToday = current.toDateString() === referenceDate.toDateString();
          
          currentWeek.days.push({
            date: new Date(current),
            dateKey,
            isCurrentMonth,
            isToday,
            deadlines: deadlineMap.get(dateKey) || null,
          });
          current.setDate(current.getDate() + 1);
        }
        weeks.push(currentWeek);
        
        // Stop if we've passed the month end
        if (current > monthEnd && current.getDay() === 0) break;
      }
      
      months.push({ label, weeks });
    }
    
    return months;
  }, [referenceDate, deadlineMap]);

  const getHeatColor = (count: number) => {
    if (count === 0) return "";
    if (count === 1) return "bg-warning/50";
    if (count === 2) return "bg-warning/80";
    return "bg-destructive/70";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deadline Calendar (Next 4 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {calendarMonths.map((month, mi) => (
            <div key={mi} className="space-y-1">
              <div className="text-xs font-medium text-center mb-2">{month.label}</div>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px text-[9px] text-muted-foreground text-center mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="space-y-px">
                {month.weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-px">
                    {week.days.map((day, di) => {
                      const hasDeadlines = day.deadlines && day.deadlines.count > 0;
                      
                      return (
                        <Tooltip key={di}>
                          <TooltipTrigger asChild>
                            <div
                              className={`
                                aspect-square flex items-center justify-center text-[10px] rounded-sm cursor-default
                                ${!day.isCurrentMonth ? 'text-muted-foreground/30' : ''}
                                ${day.isToday ? 'ring-1 ring-primary font-bold' : ''}
                                ${hasDeadlines ? getHeatColor(day.deadlines!.count) : 'bg-muted/20'}
                                ${hasDeadlines ? 'cursor-pointer' : ''}
                              `}
                            >
                              {day.date.getDate()}
                            </div>
                          </TooltipTrigger>
                          {hasDeadlines && (
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                <div className="font-medium">
                                  {day.date.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' })}
                                </div>
                                <div className="text-muted-foreground">
                                  {day.deadlines!.count} deadline{day.deadlines!.count > 1 ? 's' : ''}
                                </div>
                                {day.deadlines!.contracts.slice(0, 3).map((c, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <span>• {c.name}</span>
                                  </div>
                                ))}
                                {day.deadlines!.contracts.length > 3 && (
                                  <div className="text-muted-foreground">
                                    +{day.deadlines!.contracts.length - 3} more
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-muted/20 rounded-sm" />
            <span>No deadlines</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-warning/50 rounded-sm" />
            <span>1 deadline</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-warning/80 rounded-sm" />
            <span>2 deadlines</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-destructive/70 rounded-sm" />
            <span>3+ deadlines</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 ring-1 ring-primary rounded-sm" />
            <span>Today</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Renewals Table
const RenewalsTable = ({ contracts, referenceDate }: { contracts: ContractRecord[]; referenceDate: Date }) => {
  const upcomingRenewals = useMemo(() => {
    return contracts
      .map((c) => {
        const { date, days } = getEarliestDeadline(c, referenceDate);
        return { contract: c, deadlineDate: date, daysUntil: days };
      })
      .filter(({ daysUntil }) => daysUntil !== null && daysUntil >= 0 && daysUntil <= 90)
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
  }, [contracts, referenceDate]);

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
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [useSimulatedDate, setUseSimulatedDate] = useState(true);

  // Use simulated date (Oct 1, 2013) or real current date
  const currentDate = useSimulatedDate ? SIMULATED_DATE : new Date();

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
      if (selectedJurisdictions.length > 0 && !selectedJurisdictions.includes(c.fields.governing_law || "")) {
        return false;
      }

      // Contract type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(c.fields.contract_type || "")) {
        return false;
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(c.fields.status || "")) {
        return false;
      }

      return true;
    });
  }, [contracts, selectedParties, selectedJurisdictions, selectedTypes, selectedStatuses]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const underReview = filteredContracts.filter((c) => c.fields.status === "under_review").length;
    const upcomingRenewals = filteredContracts.filter((c) =>
      isWithinDays(c.fields.notice_deadline, 30, currentDate) || isWithinDays(c.fields.expiration_date, 30, currentDate)
    ).length;

    return {
      total: filteredContracts.length,
      underReview,
      upcomingRenewals,
      materialUpdates: regulatoryData?.material_documents || 0,
    };
  }, [filteredContracts, regulatoryData, currentDate]);

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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-6 space-y-6">
        {/* Demo Mode Banner */}
        {useSimulatedDate && (
          <Alert className="border-primary/50 bg-primary/5">
            <Info className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Demo Mode Active — Viewing as October 1, 2013
            </AlertTitle>
            <AlertDescription>
              The current dataset contains historical contracts from 2012-2019. To demonstrate how deadline 
              tracking works, we're simulating the date as October 1, 2013. Toggle off below to see how the 
              dashboard appears with today's actual date.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Compliance Analytics</h2>
            <p className="text-muted-foreground text-sm">
              Overview of contracts and regulatory updates
            </p>
          </div>
          <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg border">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="demo-mode" className="text-sm cursor-pointer">
              Demo mode (Oct 1, 2013)
            </Label>
            <Switch
              id="demo-mode"
              checked={useSimulatedDate}
              onCheckedChange={setUseSimulatedDate}
            />
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar
          selectedParties={selectedParties}
          setSelectedParties={setSelectedParties}
          selectedJurisdictions={selectedJurisdictions}
          setSelectedJurisdictions={setSelectedJurisdictions}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
          selectedStatuses={selectedStatuses}
          setSelectedStatuses={setSelectedStatuses}
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
              <DeadlineCalendarHeatmap contracts={filteredContracts} referenceDate={currentDate} />
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
          <RenewalsTable contracts={filteredContracts} referenceDate={currentDate} />
        )}

        {/* Regulatory Summary */}
        <RegulatorySummary data={regulatoryData || null} loading={regulatoryLoading} />
      </main>
    </div>
  );
};

export default Analytics;
