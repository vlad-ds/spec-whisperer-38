import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Download, ExternalLink, AlertCircle, RefreshCw, FileText, Calendar, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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

const fetchWeeklySummary = async (): Promise<WeeklySummaryResponse> => {
  const { data, error } = await supabase.functions.invoke("regulatory-digest");
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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

const RegulatoryDigest = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["regulatory-digest"],
    queryFn: fetchWeeklySummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleExportPdf = async () => {
    try {
      const { data: pdfData, error } = await supabase.functions.invoke("regulatory-digest", {
        body: null,
      });
      
      // For PDF we need to fetch directly with the right params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regulatory-digest?format=pdf`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      if (!response.ok) throw new Error("Failed to download PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `regulatory-digest-${data?.period_start}-${data?.period_end}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "PDF downloaded successfully" });
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const materialDocs = data?.documents
    ?.filter((d) => d.is_material)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2, none: 3 };
      return order[a.relevance] - order[b.relevance];
    }) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">ComplyFlow</h1>
          <nav className="flex gap-4">
            <NavItem to="/">Upload</NavItem>
            <NavItem to="/contracts">Contracts</NavItem>
            <NavItem to="/regulatory-digest">Digest</NavItem>
            <NavItem to="/chat">Chat</NavItem>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              Weekly Regulatory Digest
            </h2>
            {data && (
              <p className="text-muted-foreground mt-1">
                {formatDate(data.period_start)} — {formatDate(data.period_end)}
              </p>
            )}
          </div>
          {data && (
            <Button onClick={handleExportPdf} className="gap-2">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          )}
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

        {data && data.total_documents === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No regulatory digest available yet</h3>
              <p className="text-muted-foreground">
                Check back after the weekly analysis runs.
              </p>
            </CardContent>
          </Card>
        )}

        {data && data.total_documents > 0 && (
          <>
            {/* Summary Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.total_documents}</p>
                    <p className="text-sm text-muted-foreground">Total Analyzed</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.material_documents}</p>
                    <p className="text-sm text-muted-foreground">Material</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">By Topic</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.documents_by_topic).map(([topic, count]) => (
                      <Badge
                        key={topic}
                        className={cn("text-xs", topicColors[topic] || topicColors.default)}
                      >
                        {topic}: {count}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Executive Summary */}
            <Card className="mb-8 bg-muted/30 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {data.executive_summary.split("\n\n").map((paragraph, i) => (
                    <p key={i} className="text-foreground leading-relaxed mb-4 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Material Documents */}
            {materialDocs.length > 0 && (
              <section>
                <h3 className="text-xl font-semibold mb-4">Material Documents</h3>
                <div className="space-y-4">
                  {materialDocs.map((doc) => (
                    <DocumentCard key={doc.celex} document={doc} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const DocumentCard = ({ document }: { document: DocumentSummary }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <Badge className={cn("text-xs", topicColors[document.topic] || topicColors.default)}>
            {document.topic}
          </Badge>
          <div className="flex items-center gap-1.5">
            <span
              className={cn("h-2 w-2 rounded-full", relevanceColors[document.relevance])}
            />
            <span className="text-xs text-muted-foreground capitalize">
              {document.relevance} relevance
            </span>
          </div>
        </div>

        <h4 className="font-semibold text-foreground mb-2">{document.title}</h4>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{document.summary}</p>

        {document.impact && (
          <div className="bg-muted/50 rounded-lg p-3 mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Impact on BIT Capital</p>
            <p className="text-sm text-foreground">{document.impact}</p>
          </div>
        )}

        {document.action_required && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-3">
            <p className="text-xs font-medium text-destructive mb-1">Action Required</p>
            <p className="text-sm text-foreground">{document.action_required}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground font-mono">{document.celex}</span>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <a href={document.eurlex_url} target="_blank" rel="noopener noreferrer">
              View on EUR-Lex
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const DigestSkeleton = () => (
  <>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Card className="mb-8">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
    <Skeleton className="h-6 w-40 mb-4" />
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="h-5 w-16 mb-3" />
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  </>
);

export default RegulatoryDigest;
