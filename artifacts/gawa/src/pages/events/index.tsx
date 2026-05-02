import { useState, useMemo } from "react";
import { useListEvents, getListEventsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Receipt, Clock, CheckCircle2, Search, X, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StatusFilter = "all" | "draft" | "sent" | "partial" | "settled";
type SortKey = "newest" | "oldest" | "highest" | "lowest";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",     label: "All"      },
  { key: "draft",   label: "Draft"    },
  { key: "sent",    label: "Sent"     },
  { key: "partial", label: "Partial"  },
  { key: "settled", label: "Settled"  },
];

const SORT_LABELS: Record<SortKey, string> = {
  newest:  "Newest first",
  oldest:  "Oldest first",
  highest: "Highest amount",
  lowest:  "Lowest amount",
};

export default function EventsList() {
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState<StatusFilter>("all");
  const [sort, setSort]       = useState<SortKey>("newest");

  const { data: events, isLoading } = useListEvents(undefined, {
    query: { queryKey: getListEventsQueryKey() }
  });

  const filtered = useMemo(() => {
    if (!events) return [];
    let list = [...events];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.payerName.toLowerCase().includes(q)
      );
    }

    if (status !== "all") {
      list = list.filter(e => e.status === status);
    }

    switch (sort) {
      case "newest":  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case "oldest":  list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case "highest": list.sort((a, b) => b.totalAmount - a.totalAmount); break;
      case "lowest":  list.sort((a, b) => a.totalAmount - b.totalAmount); break;
    }

    return list;
  }, [events, search, status, sort]);

  const statusCounts = useMemo(() => {
    if (!events) return {} as Record<StatusFilter, number>;
    return {
      all:     events.length,
      draft:   events.filter(e => e.status === "draft").length,
      sent:    events.filter(e => e.status === "sent").length,
      partial: events.filter(e => e.status === "partial").length,
      settled: events.filter(e => e.status === "settled").length,
    };
  }, [events]);

  const hasActiveFilter = search.trim() || status !== "all" || sort !== "newest";

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground text-sm">All your bill splits</p>
        </div>
        <Link href="/events/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Split
          </Button>
        </Link>
      </div>

      {!isLoading && (events?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search events or payer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className={sort !== "newest" ? "border-primary text-primary" : ""}>
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuRadioGroup value={sort} onValueChange={v => setSort(v as SortKey)}>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {SORT_LABELS[key]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {STATUS_TABS.map(tab => {
              const count = statusCounts[tab.key] ?? 0;
              if (tab.key !== "all" && count === 0) return null;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatus(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    status === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {tab.label}
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                    status === tab.key
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : events?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <Receipt className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No events yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Create your first bill split to start collecting payments from friends.
            </p>
            <Link href="/events/new">
              <Button>Create a Split</Button>
            </Link>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Search className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No matches</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Try a different search term or filter.
            </p>
            {hasActiveFilter && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatus("all"); setSort("newest"); }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hasActiveFilter && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{filtered.length} of {events?.length} events</span>
              <button
                onClick={() => { setSearch(""); setStatus("all"); setSort("newest"); }}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          )}
          {filtered.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="hover:bg-secondary/50 transition-colors cursor-pointer mb-3">
                <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="bg-secondary p-3 rounded-full hidden sm:flex flex-shrink-0">
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base truncate">{event.title}</h3>
                      <div className="flex items-center text-sm text-muted-foreground gap-2 mt-0.5">
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatShortDate(event.createdAt)}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline truncate">Paid by {event.payerName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-base">{formatCurrency(event.totalAmount)}</div>
                    <div className="mt-1">
                      {event.status === "settled" ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" /> Settled
                        </Badge>
                      ) : event.status === "partial" ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                          {event.paidCount}/{event.participantCount} Paid
                        </Badge>
                      ) : event.status === "sent" ? (
                        <Badge variant="secondary" className="text-xs">Sent</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Draft</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
