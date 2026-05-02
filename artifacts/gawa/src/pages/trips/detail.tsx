import { useGetTrip, getGetTripQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Map as MapIcon, Receipt, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

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

  if (isLoading) {
    return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!trip) return <div>Not found</div>;

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
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-lg font-semibold">Trip Events</h2>
          {trip.events && trip.events.length > 0 ? (
            <div className="space-y-4">
              {trip.events.map((event: any) => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <Card className="hover:bg-secondary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-secondary p-3 rounded-full hidden sm:block">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{event.title}</h3>
                          <div className="text-sm text-muted-foreground mt-1">
                            Paid by {event.payerName} • {formatShortDate(event.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{formatCurrency(event.totalAmount)}</div>
                        <div className="mt-1">
                          {event.status === 'settled' ? (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Settled
                            </Badge>
                          ) : (
                            <Badge variant="outline">{event.status}</Badge>
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
               No events in this trip yet.
             </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-secondary/20">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Total Spent</div>
                  <div className="text-3xl font-bold">{formatCurrency(trip.totalSpent)}</div>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Total Outstanding</div>
                  <div className="text-xl font-bold text-primary">{formatCurrency(trip.outstandingAmount)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
