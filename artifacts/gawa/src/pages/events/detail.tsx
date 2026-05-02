import { useLocation, useParams } from "wouter";
import { 
  useGetEvent, getGetEventQueryKey,
  useAddParticipant, 
  useSendPaymentRequests,
  useMarkPaid
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatCurrency, formatPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, CheckCircle2, UserPlus, Phone, Loader2, MoreVertical, MessageCircle, Share2, Link2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

function toKenyanE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  return "254" + digits;
}

function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${toKenyanE164(phone)}?text=${encodeURIComponent(message)}`;
}

function buildReminderMessage(eventTitle: string, amount: number, payerName: string): string {
  return `Hi! 👋 You owe *${formatCurrency(amount)}* for *${eventTitle}* (paid by ${payerName}). Please send via Mpesa when you get a chance. Thanks!`;
}

export default function EventDetail() {
  const { id } = useParams();
  const eventId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ name: "", phone: "", amount: "" });
  const [markingPaid, setMarkingPaid] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: event, isLoading } = useGetEvent(eventId, {
    query: {
      enabled: !!eventId,
      queryKey: getGetEventQueryKey(eventId),
      refetchInterval: 10000,
    }
  });

  const addParticipant = useAddParticipant();
  const sendRequests = useSendPaymentRequests();
  const markPaid = useMarkPaid();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });

  const handleAddParticipant = () => {
    addParticipant.mutate({
      eventId,
      data: {
        name: newParticipant.name,
        mpesaPhone: newParticipant.phone,
        shareAmount: Number(newParticipant.amount) || null
      }
    }, {
      onSuccess: () => {
        setIsAddParticipantOpen(false);
        setNewParticipant({ name: "", phone: "", amount: "" });
        invalidate();
        toast({ title: "Participant added" });
      },
      onError: () => toast({ title: "Error adding participant", variant: "destructive" })
    });
  };

  const handleSendRequests = () => {
    sendRequests.mutate({ eventId }, {
      onSuccess: (res) => {
        toast({ title: `Sent ${res.sent} payment request${res.sent !== 1 ? 's' : ''}!` });
        invalidate();
      },
      onError: () => toast({ title: "Failed to send requests", variant: "destructive" })
    });
  };

  const handleMarkPaid = (participantId: number) => {
    setMarkingPaid(participantId);
    markPaid.mutate({ eventId, participantId }, {
      onSuccess: () => {
        toast({ title: "Marked as paid" });
        invalidate();
        setMarkingPaid(null);
      },
      onError: () => {
        toast({ title: "Failed to mark as paid", variant: "destructive" });
        setMarkingPaid(null);
      }
    });
  };

  const handleCopyLink = () => {
    const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
    const shareUrl = `${base}/share/${eventId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it in your group chat." });
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleShareAll = () => {
    if (!event) return;
    const unpaid = event.participants.filter((p: any) => p.paymentStatus !== "paid");
    unpaid.forEach((p: any) => {
      const msg = buildReminderMessage(event.title, p.shareAmount, event.payerName);
      window.open(buildWhatsAppLink(p.mpesaPhone, msg), "_blank", "noopener,noreferrer");
    });
    toast({ title: `Opened ${unpaid.length} WhatsApp chat${unpaid.length !== 1 ? "s" : ""}` });
  };

  if (isLoading) {
    return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!event) return <div>Not found</div>;

  const unpaidParticipants = event.participants.filter((p: any) => p.paymentStatus !== "paid");
  const paidParticipants = event.participants.filter((p: any) => p.paymentStatus === "paid");

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-32">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/events")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{event.title}</h1>
          <p className="text-muted-foreground text-sm">
            {formatCurrency(event.totalAmount)} • {event.splitType} split • Paid by {event.payerName}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleCopyLink}
          >
            {copied
              ? <><Check className="h-3.5 w-3.5 text-primary" /> Copied</>
              : <><Link2 className="h-3.5 w-3.5" /> Share</>
            }
          </Button>
          <Badge variant={
            event.status === 'settled' ? 'default' :
            event.status === 'partial' ? 'outline' :
            event.status === 'sent' ? 'secondary' : 'outline'
          }>
            {event.status === 'settled' ? '✓ Settled' :
             event.status === 'partial' ? `${paidParticipants.length}/${event.participants.length} paid` :
             event.status === 'sent' ? 'Requests Sent' : 'Draft'}
          </Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">
                Participants
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {paidParticipants.length}/{event.participants.length} paid
                </span>
              </CardTitle>
              <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <UserPlus className="h-4 w-4" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Participant</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={newParticipant.name}
                        onChange={e => setNewParticipant(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mpesa Phone Number</Label>
                      <Input
                        value={newParticipant.phone}
                        onChange={e => setNewParticipant(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="07XX XXX XXX"
                      />
                    </div>
                    {event.splitType === 'custom' && (
                      <div className="space-y-2">
                        <Label>Amount (Ksh)</Label>
                        <Input
                          type="number"
                          value={newParticipant.amount}
                          onChange={e => setNewParticipant(prev => ({ ...prev, amount: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleAddParticipant}
                      disabled={!newParticipant.name || !newParticipant.phone || addParticipant.isPending}
                    >
                      {addParticipant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Person
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {event.participants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No participants yet. Add friends to split the bill.
                </div>
              ) : (
                <div className="space-y-3 mt-2">
                  {event.participants.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 flex-shrink-0" /> {formatPhone(p.mpesaPhone)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(p.shareAmount)}</div>
                          <div className="mt-1">
                            {p.paymentStatus === 'paid' ? (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                              </Badge>
                            ) : p.paymentStatus === 'requested' ? (
                              <Badge variant="secondary" className="text-xs">Requested</Badge>
                            ) : p.paymentStatus === 'failed' ? (
                              <Badge variant="destructive" className="text-xs">Failed</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Pending</Badge>
                            )}
                          </div>
                        </div>
                        {p.paymentStatus !== 'paid' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                {markingPaid === p.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <MoreVertical className="h-4 w-4" />
                                }
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                asChild
                              >
                                <a
                                  href={buildWhatsAppLink(
                                    p.mpesaPhone,
                                    buildReminderMessage(event.title, p.shareAmount, event.payerName)
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center cursor-pointer"
                                >
                                  <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                                  Send WhatsApp Reminder
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleMarkPaid(p.id)}>
                                <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                                Mark as Paid
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {event.items && event.items.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Bill Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {event.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                      <span className="text-sm">{item.name}</span>
                      <span className="font-medium text-sm">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="bg-secondary/20">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">Outstanding</div>
              <div className="text-3xl font-bold text-primary mb-2">{formatCurrency(event.outstandingAmount)}</div>
              <div className="text-xs text-muted-foreground mb-6">
                of {formatCurrency(event.totalAmount)} total
              </div>

              {event.outstandingAmount > 0 ? (
                <Button
                  size="lg"
                  className="w-full font-bold shadow-lg shadow-primary/20 py-6"
                  disabled={unpaidParticipants.length === 0 || sendRequests.isPending}
                  onClick={handleSendRequests}
                >
                  {sendRequests.isPending
                    ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    : <Send className="mr-2 h-5 w-5" />
                  }
                  Send Mpesa Requests
                </Button>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-primary">All paid!</p>
                  <p className="text-xs text-muted-foreground mt-1">Everyone has settled up.</p>
                </div>
              )}

              {unpaidParticipants.length > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  {unpaidParticipants.length} person{unpaidParticipants.length !== 1 ? 's' : ''} still owe
                </p>
              )}
            </CardContent>
          </Card>

          {unpaidParticipants.length > 0 && (
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-green-500 rounded-full p-1.5 flex-shrink-0">
                    <MessageCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">WhatsApp Reminders</div>
                    <div className="text-xs text-muted-foreground">
                      Nudge all {unpaidParticipants.length} unpaid at once
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {unpaidParticipants.map((p: any) => (
                    <a
                      key={p.id}
                      href={buildWhatsAppLink(
                        p.mpesaPhone,
                        buildReminderMessage(event.title, p.shareAmount, event.payerName)
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 hover:bg-background transition-colors border border-border/30 group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(p.shareAmount)}</div>
                        </div>
                      </div>
                      <Share2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-green-500 transition-colors flex-shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
                {unpaidParticipants.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 border-green-500/30 text-green-500 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/50"
                    onClick={handleShareAll}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message All {unpaidParticipants.length}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {event.payments && event.payments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payment History</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  {event.payments.slice(0, 5).map((pmt: any) => (
                    <div key={pmt.id} className="flex justify-between items-center text-xs py-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          pmt.status === 'completed' ? 'bg-primary' :
                          pmt.status === 'failed' ? 'bg-destructive' : 'bg-amber-500'
                        }`} />
                        <span className="text-muted-foreground">{pmt.mpesaReference || 'Mpesa Request'}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(pmt.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
