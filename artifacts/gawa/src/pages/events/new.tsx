import { useState } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useCreateEvent, useListTrips, getListTripsQueryKey, useListGroups, getListGroupsQueryKey, useGetGroup, getGetGroupQueryKey, useAddParticipant } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, SplitSquareHorizontal, ListPlus, Wand2, UsersRound, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  totalAmount: z.coerce.number().min(1, "Amount must be greater than 0"),
  splitType: z.enum(["equal", "itemised", "custom"]),
  payerName: z.string().min(2, "Payer name is required"),
  tripId: z.coerce.number().optional().nullable(),
});

export default function EventCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  
  const { data: trips } = useListTrips(undefined, {
    query: { queryKey: getListTripsQueryKey() }
  });
  const { data: groups } = useListGroups({
    query: { queryKey: getListGroupsQueryKey() }
  });
  const { data: selectedGroup } = useGetGroup(
    selectedGroupId ?? 0,
    { query: { enabled: selectedGroupId !== null, queryKey: getGetGroupQueryKey(selectedGroupId ?? 0) } }
  );
  
  const createEvent = useCreateEvent();
  const addParticipant = useAddParticipant();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      totalAmount: 0,
      splitType: "equal",
      payerName: "Me",
      tripId: null,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    createEvent.mutate(
      { data: values },
      {
        onSuccess: async (data) => {
          if (selectedGroup && selectedGroup.members.length > 0) {
            toast({ title: "Split created! Adding group members…" });
            for (const m of selectedGroup.members) {
              await new Promise<void>((resolve) => {
                addParticipant.mutate(
                  { eventId: data.id, data: { name: m.name, mpesaPhone: m.mpesaPhone, shareAmount: null } },
                  { onSuccess: () => resolve(), onError: () => resolve() }
                );
              });
            }
          } else {
            toast({ title: "Split created successfully" });
          }
          setLocation(`/events/${data.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create split", variant: "destructive" });
        }
      }
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/events")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Split</h1>
          <p className="text-muted-foreground text-sm">Create a bill to share with friends</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What was it for?</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Dinner at CJ's" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount (Ksh)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="payerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Who paid?</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Me" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="splitType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>How to split?</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-3 gap-4"
                      >
                        <FormItem>
                          <FormControl>
                            <RadioGroupItem value="equal" className="peer sr-only" />
                          </FormControl>
                          <Label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <SplitSquareHorizontal className="mb-3 h-6 w-6" />
                            Equal
                          </Label>
                        </FormItem>
                        <FormItem>
                          <FormControl>
                            <RadioGroupItem value="itemised" className="peer sr-only" />
                          </FormControl>
                          <Label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <ListPlus className="mb-3 h-6 w-6" />
                            Items
                          </Label>
                        </FormItem>
                        <FormItem>
                          <FormControl>
                            <RadioGroupItem value="custom" className="peer sr-only" />
                          </FormControl>
                          <Label className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <Wand2 className="mb-3 h-6 w-6" />
                            Custom
                          </Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {trips && trips.length > 0 && (
                <FormField
                  control={form.control}
                  name="tripId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Add to Trip (Optional)</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "none" ? null : Number(val))} 
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a trip" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Trip</SelectItem>
                          {trips.map(trip => (
                            <SelectItem key={trip.id} value={trip.id.toString()}>
                              {trip.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* From Group picker */}
              {groups && groups.length > 0 && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-muted-foreground" />
                    Add Participants from Group (Optional)
                  </Label>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {groups.map(g => {
                      const sel = selectedGroupId === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGroupId(sel ? null : g.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all flex-shrink-0 min-w-[64px] ${
                            sel
                              ? "border-primary bg-primary/10"
                              : "border-border bg-secondary/40 hover:border-primary/50"
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                            <UsersRound className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-[10px] font-medium leading-tight text-center w-full truncate">
                            {g.name}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{g.memberCount}p</span>
                          {sel && <Check className="h-3 w-3 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                  {selectedGroup && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                      <div className="text-xs font-medium text-primary">
                        {selectedGroup.members.length} member{selectedGroup.members.length !== 1 ? "s" : ""} will be added automatically
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedGroup.members.map(m => (
                          <span key={m.id} className="text-xs bg-background border border-border px-2 py-0.5 rounded-full">{m.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full font-bold" disabled={createEvent.isPending || addParticipant.isPending}>
                {(createEvent.isPending || addParticipant.isPending) ? "Creating…" : selectedGroup ? `Create Split + Add ${selectedGroup.memberCount} Members` : "Create Split"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
