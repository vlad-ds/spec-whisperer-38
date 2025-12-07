import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { ExternalLink, AlertCircle, RefreshCw, FileText, Calendar, Inbox, ChevronDown, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DocumentSummary {
  celex: string;
  topic: string;
  title: string;
  analyzed_at: string;
  eurlex_url: string;
  is_material: boolean;
  relevance: "high" | "medium" | "low" | "none";
  summary: string;
  impact: string | null;
  action_required: string | null;
}

interface WeeklySummaryResponse {
  period_start: string;
  period_end: string;
  generated_at: string;
  total_documents: number;
  material_documents: number;
  documents_by_topic: Record<string, number>;
  executive_summary: string;
  documents: DocumentSummary[];
}

const topicColors: Record<string, string> = {
  DORA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MiCA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  AML: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  AIFMD: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  AI: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ESG: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  default: "bg-muted text-muted-foreground",
};

const relevanceColors: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
  none: "bg-muted",
};

const fetchWeeklySummary = async (): Promise<WeeklySummaryResponse[]> => {
  const { data, error } = await supabase.functions.invoke("regulatory-digest");
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  // Wrap single response in array for future multi-report support
  return data.total_documents > 0 ? [data] : [];
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const formatShortDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const NavItem = ({ to, children }: { to: string; children: React.ReactNode }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={cn(
        "text-sm font-medium transition-colors hover:text-primary",
        isActive ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {children}
    </Link>
  );
};

const downloadPdf = async (periodStart: string, periodEnd: string) => {
  const { data, error } = await supabase.functions.invoke("regulatory-digest", {
    body: null,
    method: "GET",
  });
  
  // The invoke method doesn't support query params well for GET, so we'll use fetch directly
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/regulatory-digest?format=pdf`, {
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "apikey": supabaseKey,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to download PDF: ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `regulatory-digest-${periodStart}-to-${periodEnd}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

const RegulatoryDigest = () => {
  const { data: reports, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["regulatory-digest"],
    queryFn: fetchWeeklySummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">ComplyFlow</h1>
          <nav className="flex gap-4">
            <NavItem to="/">Upload</NavItem>
            <NavItem to="/contracts">Contracts</NavItem>
            <NavItem to="/analytics">Analytics</NavItem>
            <NavItem to="/regulatory-digest">Digest</NavItem>
            <NavItem to="/chat">Chat</NavItem>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            Weekly Regulatory Digest
          </h2>
          <p className="text-muted-foreground mt-1">
            Regulatory updates sorted by most recent
          </p>
        </div>

        {isLoading && <DigestSkeleton />}

        {error && (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load digest</h3>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
              <Button variant="outline" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {reports && reports.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-16 w-16 text-muted-foreground/50 mb-6" />
              <h3 className="text-xl font-semibold mb-2">No digest available yet</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                The weekly regulatory analysis hasn't run yet for this period. Digests are generated automatically each week.
              </p>
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                {isFetching ? "Checking..." : "Check Again"}
              </Button>
            </CardContent>
          </Card>
        )}

        {reports && reports.length > 0 && (
          <div className="space-y-4">
            {reports.map((report) => (
              <ReportCard key={`${report.period_start}-${report.period_end}`} report={report} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const ReportCard = ({ report }: { report: WeeklySummaryResponse }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const materialDocs = report.documents
    ?.filter((d) => d.is_material)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2, none: 3 };
      return order[a.relevance] - order[b.relevance];
    }) || [];

  const handlePdfDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadPdf(report.period_start, report.period_end);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("PDF download failed:", error);
      toast.error("Failed to download PDF", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        {/* Collapsed Header - Always Visible */}
        <div className="flex items-center justify-between p-4 gap-4">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-4 flex-1 text-left hover:bg-muted/50 -m-2 p-2 rounded-lg transition-colors">
              <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-semibold text-foreground">
                    {formatShortDate(report.period_start)} — {formatShortDate(report.period_end)}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{report.total_documents} docs</span>
                    <span className="text-destructive font-medium">
                      {report.material_documents} material
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(report.documents_by_topic).map(([topic, count]) => (
                    <Badge
                      key={topic}
                      variant="secondary"
                      className={cn("text-xs", topicColors[topic] || topicColors.default)}
                    >
                      {topic}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
          
          <Button onClick={handlePdfDownload} size="sm" className="gap-2 shrink-0" disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isDownloading ? "Downloading..." : "Download PDF"}
          </Button>
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="border-t border-border px-6 py-6 space-y-6">
            {/* Executive Summary */}
            <Card className="bg-muted/30 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {report.executive_summary.split("\n\n").map((paragraph, i) => (
                    <p key={i} className="text-foreground leading-relaxed mb-3 last:mb-0 text-sm">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Material Documents */}
            {materialDocs.length > 0 && (
              <section>
                <h4 className="text-base font-semibold mb-3">Material Documents</h4>
                <div className="space-y-3">
                  {materialDocs.map((doc) => (
                    <DocumentCard key={doc.celex} document={doc} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

const DocumentCard = ({ document }: { document: DocumentSummary }) => {
  return (
    <Card className="bg-card">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-2 mb-2">
          <Badge className={cn("text-xs", topicColors[document.topic] || topicColors.default)}>
            {document.topic}
          </Badge>
          <div className="flex items-center gap-1.5">
            <span
              className={cn("h-2 w-2 rounded-full", relevanceColors[document.relevance])}
            />
            <span className="text-xs text-muted-foreground capitalize">
              {document.relevance}
            </span>
          </div>
        </div>

        <h5 className="font-medium text-foreground text-sm mb-2">{document.title}</h5>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{document.summary}</p>

        {document.impact && (
          <div className="bg-muted/50 rounded-md p-2 mb-2">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Impact</p>
            <p className="text-xs text-foreground">{document.impact}</p>
          </div>
        )}

        {document.action_required && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2 mb-2">
            <p className="text-xs font-medium text-destructive mb-0.5">Action Required</p>
            <p className="text-xs text-foreground">{document.action_required}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground font-mono">{document.celex}</span>
          <Button variant="ghost" size="sm" asChild className="gap-1 h-7 text-xs">
            <a href={document.eurlex_url} target="_blank" rel="noopener noreferrer">
              EUR-Lex
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const DigestSkeleton = () => (
  <div className="space-y-4">
    {[...Array(2)].map((_, i) => (
      <Card key={i}>
        <div className="p-4 flex items-center gap-4">
          <Skeleton className="h-5 w-5" />
          <div className="flex-1">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      </Card>
    ))}
  </div>
);

export default RegulatoryDigest;
