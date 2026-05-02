import { useListEvents, getListEventsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Clock, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function EventsList() {
  const { data: events, isLoading } = useListEvents(undefined, {
    query: {
      queryKey: getListEventsQueryKey(),
    }
  });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
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
      ) : (
        <div className="space-y-4">
          {events?.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="hover:bg-secondary/50 transition-colors cursor-pointer mb-4">
                <CardContent className="p-4 sm:p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-secondary p-3 rounded-full hidden sm:block">
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{event.title}</h3>
                      <div className="flex items-center text-sm text-muted-foreground gap-2 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatShortDate(event.createdAt)}
                        </span>
                        <span>•</span>
                        <span>Paid by {event.payerName}</span>
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
                      ) : event.status === 'partial' ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                          {event.paidCount}/{event.participantCount} Paid
                        </Badge>
                      ) : event.status === 'sent' ? (
                        <Badge variant="secondary">Requests Sent</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
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
