import { useParams } from "wouter";
import { useGetEvent, getGetEventQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Receipt, Users, CalendarDays } from "lucide-react";

export default function EventShare() {
  const { id } = useParams();
  const eventId = Number(id);

  const { data: event, isLoading } = useGetEvent(eventId, {
    query: {
      enabled: !!eventId,
      queryKey: getGetEventQueryKey(eventId),
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-10 w-32 mx-auto" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-6">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Bill not found</h1>
          <p className="text-muted-foreground text-sm">This split link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  const paidCount = event.participants.filter((p: any) => p.paymentStatus === "paid").length;
  const total = event.participants.length;
  const allPaid = paidCount === total && total > 0;
  const progressPct = total > 0 ? Math.round((paidCount / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-sm space-y-5">

        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-primary rounded-full px-4 py-1.5 mb-6">
            <span className="text-primary-foreground font-bold text-sm tracking-wide">Gawa</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Split by {event.payerName} · {event.splitType} split
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Total Bill</div>
              <div className="text-3xl font-bold">{formatCurrency(event.totalAmount)}</div>
            </div>
            <Badge
              variant={allPaid ? "default" : "outline"}
              className={allPaid ? "bg-primary text-primary-foreground" : ""}
            >
              {allPaid ? "✓ Settled" : `${paidCount}/${total} paid`}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Collection progress</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-secondary/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Users className="h-3 w-3" />
                People
              </div>
              <div className="font-semibold">{total}</div>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <CalendarDays className="h-3 w-3" />
                Created
              </div>
              <div className="font-semibold text-sm">{formatDate(event.createdAt)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Who owes what</span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {event.participants.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    p.paymentStatus === "paid"
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.paymentStatus === "paid" ? "Paid ✓" :
                       p.paymentStatus === "requested" ? "Request sent" : "Pending"}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-semibold text-sm ${p.paymentStatus === "paid" ? "text-primary" : ""}`}>
                    {formatCurrency(p.shareAmount)}
                  </div>
                  {p.paymentStatus === "paid" && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto mt-0.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {event.outstandingAmount > 0 && (
          <div className="rounded-2xl bg-secondary/40 border border-border p-4 text-center space-y-1">
            <div className="text-xs text-muted-foreground">Still outstanding</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(event.outstandingAmount)}</div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Powered by <span className="font-semibold text-foreground">Gawa</span> · Split bills, send Mpesa
        </p>
      </div>
    </div>
  );
}
