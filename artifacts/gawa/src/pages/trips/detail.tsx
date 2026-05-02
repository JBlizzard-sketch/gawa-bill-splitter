import { useGetTrip, getGetTripQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Map as MapIcon, Receipt, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useMemo } from "react";
import { simplifyDebts } from "@/lib/debt-simplify";

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
const AVATAR_COLORS = [
  "bg-primary/20 text-primary",
  "bg-blue-500/20 text-blue-400",
  "bg-amber-500/20 text-amber-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-purple-500/20 text-purple-400",
  "bg-rose-500/20 text-rose-400",
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function TripDetail() {
  const { id } = useParams();
  const tripId = Number(id);
  const [, setLocation] = useLocation();

  const { data: trip, isLoading } = useGetTrip(tripId, {
    query: {
      enabled: !!tripId,
      queryKey: getGetTripQueryKey(tripId),
    }
  });

  const debts = useMemo(() => {
    if (!trip?.events?.length) return [];
    return simplifyDebts(
      (trip.events as any[]).map(e => ({
        payerName: e.payerName,
        participants: (e.participants ?? []).map((p: any) => ({
          name: p.name,
          shareAmount: p.shareAmount,
          paymentStatus: p.paymentStatus,
        })),
      }))
    );
  }, [trip]);

  if (isLoading) {
    return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!trip) return <div>Not found</div>;

  const totalSpent = (trip as any).totalSpent ?? 0;
  const outstandingAmount = (trip as any).outstandingAmount ?? 0;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/trips")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{trip.name}</h1>
            <Badge variant={trip.status === 'active' ? "default" : "secondary"}>
              {trip.status}
            </Badge>
          </div>
          {trip.description && <p className="text-muted-foreground text-sm">{trip.description}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Events list */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Trip Events</h2>
          {trip.events && trip.events.length > 0 ? (
            <div className="space-y-3">
              {(trip.events as any[]).map((event) => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <Card className="hover:bg-secondary/50 transition-colors cursor-pointer mb-3">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="bg-secondary p-3 rounded-full hidden sm:flex flex-shrink-0">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{event.title}</h3>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            Paid by {event.payerName} · {formatShortDate(event.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold">{formatCurrency(event.totalAmount)}</div>
                        <div className="mt-1">
                          {event.status === 'settled' ? (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs">
                              <CheckCircle2 className="h-3 w-3" /> Settled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">{event.status}</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm bg-secondary/20 rounded-xl border border-dashed border-border/50">
              No events in this trip yet.{" "}
              <Link href={`/events/new`} className="text-primary hover:underline">Create one</Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Summary */}
          <Card className="bg-secondary/20">
            <CardContent className="p-6 space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Total Spent</div>
                <div className="text-3xl font-bold">{formatCurrency(totalSpent)}</div>
              </div>
              <div className="pt-4 border-t border-border/50">
                <div className="text-sm font-medium text-muted-foreground mb-1">Outstanding</div>
                <div className="text-xl font-bold text-primary">{formatCurrency(outstandingAmount)}</div>
              </div>
              {(trip.events as any[])?.length > 0 && (
                <div className="pt-3 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Events</span>
                    <span className="font-medium text-foreground">{trip.events.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Settled</span>
                    <span className="font-medium text-foreground">
                      {(trip.events as any[]).filter(e => e.status === "settled").length}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Debt simplification card */}
          {(trip.events as any[])?.length > 0 && (
            <Card className={debts.length === 0 ? "border-primary/20 bg-primary/5" : "border-amber-500/20 bg-amber-500/5"}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-full ${debts.length === 0 ? "bg-primary/20" : "bg-amber-500/20"}`}>
                    <Sparkles className={`h-3.5 w-3.5 ${debts.length === 0 ? "text-primary" : "text-amber-500"}`} />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {debts.length === 0 ? "All settled up!" : "Settle Up"}
                  </CardTitle>
                </div>
                {debts.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 ml-7">
                    {debts.length} payment{debts.length !== 1 ? "s" : ""} to clear all debts
                  </p>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {debts.length === 0 ? (
                  <p className="text-xs text-muted-foreground ml-7">
                    No outstanding balances across this trip.
                  </p>
                ) : (
                  <div className="space-y-2 mt-1">
                    {debts.map((debt, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-background/60 border border-border/30"
                      >
                        {/* From avatar */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${avatarColor(debt.from)}`}>
                          {getInitials(debt.from)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            <span className="text-foreground">{debt.from}</span>
                            <span className="text-muted-foreground mx-1">pays</span>
                            <span className="text-foreground">{debt.to}</span>
                          </div>
                          <div className="text-sm font-bold text-amber-500 mt-0.5">
                            {formatCurrency(debt.amount)}
                          </div>
                        </div>

                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

                        {/* To avatar */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${avatarColor(debt.to)}`}>
                          {getInitials(debt.to)}
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground text-center pt-1">
                      Simplified from all outstanding splits
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
