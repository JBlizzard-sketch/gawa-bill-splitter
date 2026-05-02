import { useState } from "react";
import { useListTrips, getListTripsQueryKey, useCreateTrip } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, Plus, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function TripsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: trips, isLoading } = useListTrips(undefined, {
    query: { queryKey: getListTripsQueryKey() }
  });

  const createTrip = useCreateTrip();

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createTrip.mutate(
      { data: { name: form.name, description: form.description || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Trip created!" });
          queryClient.invalidateQueries({ queryKey: getListTripsQueryKey() });
          setOpen(false);
          setForm({ name: "", description: "" });
        },
        onError: () => toast({ title: "Failed to create trip", variant: "destructive" }),
      }
    );
  };

  const NewTripDialog = () => (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Trip
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Trip</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Trip Name</Label>
            <Input
              placeholder="e.g. Mombasa Weekend, Diani Beach"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              placeholder="e.g. 4 friends, 3 nights at the coast"
              rows={2}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!form.name.trim() || createTrip.isPending}
            className="w-full"
          >
            {createTrip.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trips & Groups</h1>
          <p className="text-muted-foreground text-sm">Manage group expenses</p>
        </div>
        <NewTripDialog />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : trips?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-secondary p-4 rounded-full mb-4">
              <MapIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No trips yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Group your bills together for a trip or a shared house.
            </p>
            <Button onClick={() => setOpen(true)}>Create a Trip</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {trips?.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <MapIcon className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant={trip.status === 'active' ? "default" : "secondary"}>
                      {trip.status}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{trip.name}</h3>
                  {trip.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-1">{trip.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
                    <div>
                      <div className="text-xs text-muted-foreground">Total Spent</div>
                      <div className="font-semibold">{formatCurrency(trip.totalSpent)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Events</div>
                      <div className="font-semibold">{trip.eventCount}</div>
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
