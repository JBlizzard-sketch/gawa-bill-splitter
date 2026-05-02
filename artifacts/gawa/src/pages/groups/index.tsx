import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListGroups, useCreateGroup, useDeleteGroup,
  useGetGroup, useAddGroupMember, useRemoveGroupMember,
  getListGroupsQueryKey, getGetGroupQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, UserPlus, Phone, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/format";

function avatarColor(name: string) {
  const colors = ["bg-emerald-600","bg-blue-600","bg-purple-600","bg-amber-600","bg-rose-600","bg-cyan-600","bg-indigo-600","bg-orange-600"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function GroupsList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: groups, isLoading } = useListGroups({
    query: { queryKey: getListGroupsQueryKey() }
  });

  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();

  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");

  const { data: selectedGroup, isLoading: groupLoading } = useGetGroup(
    selectedGroupId ?? 0,
    { query: { enabled: selectedGroupId !== null, queryKey: getGetGroupQueryKey(selectedGroupId ?? 0) } }
  );

  function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    createGroup.mutate(
      { data: { name: newGroupName.trim() } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          setNewGroupName("");
          setShowNewGroup(false);
          toast({ title: "Group created" });
        },
        onError: () => toast({ title: "Failed to create group", variant: "destructive" }),
      }
    );
  }

  function handleDeleteGroup(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    deleteGroup.mutate(
      { id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          if (selectedGroupId === id) setSelectedGroupId(null);
          toast({ title: "Group deleted" });
        },
        onError: () => toast({ title: "Failed to delete group", variant: "destructive" }),
      }
    );
  }

  function handleAddMember() {
    if (!selectedGroupId || !memberName.trim() || !memberPhone.trim()) return;
    addMember.mutate(
      { id: selectedGroupId, data: { name: memberName.trim(), mpesaPhone: memberPhone.trim() } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetGroupQueryKey(selectedGroupId) });
          qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          setMemberName("");
          setMemberPhone("");
          setShowAddMember(false);
          toast({ title: "Member added" });
        },
        onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
      }
    );
  }

  function handleRemoveMember(memberId: number) {
    if (!selectedGroupId) return;
    removeMember.mutate(
      { id: selectedGroupId, memberId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetGroupQueryKey(selectedGroupId) });
          qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          toast({ title: "Member removed" });
        },
        onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
            <p className="text-muted-foreground text-sm">Save groups of people to add to splits in one tap</p>
          </div>
        </div>
        <Button onClick={() => setShowNewGroup(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Group
        </Button>
      </div>

      {/* Group List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !groups || groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">No groups yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create a group to add people to splits in one tap</p>
            </div>
            <Button onClick={() => setShowNewGroup(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <Card
              key={group.id}
              className="cursor-pointer hover:bg-secondary/40 transition-colors"
              onClick={() => setSelectedGroupId(group.id)}
            >
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{group.name}</p>
                  <p className="text-sm text-muted-foreground">{group.memberCount} member{group.memberCount !== 1 ? "s" : ""} · Created {formatDate(group.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{group.memberCount}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={(e) => handleDeleteGroup(group.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="e.g. Mombasa Crew, Flat 4B"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateGroup()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewGroup(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={createGroup.isPending || !newGroupName.trim()}>
              {createGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Detail Sheet */}
      <Sheet open={selectedGroupId !== null} onOpenChange={open => !open && setSelectedGroupId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{selectedGroup?.name ?? "Group"}</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {selectedGroup?.memberCount ?? 0} member{(selectedGroup?.memberCount ?? 0) !== 1 ? "s" : ""}
            </p>
          </SheetHeader>

          {groupLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Members */}
              {selectedGroup && selectedGroup.members.length > 0 ? (
                <div className="space-y-2">
                  {selectedGroup.members.map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(member.name)}`}>
                        {initials(member.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />{member.mpesaPhone}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No members yet. Add the first one below.
                </div>
              )}

              {/* Add member inline */}
              {showAddMember ? (
                <div className="space-y-2 p-3 rounded-lg border border-border bg-secondary/20">
                  <Input
                    placeholder="Full name"
                    value={memberName}
                    onChange={e => setMemberName(e.target.value)}
                    autoFocus
                  />
                  <Input
                    placeholder="M-Pesa phone e.g. 0722 456 789"
                    value={memberPhone}
                    onChange={e => setMemberPhone(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setShowAddMember(false); setMemberName(""); setMemberPhone(""); }}>Cancel</Button>
                    <Button size="sm" className="flex-1" onClick={handleAddMember} disabled={addMember.isPending || !memberName.trim() || !memberPhone.trim()}>
                      {addMember.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full gap-2" onClick={() => setShowAddMember(true)}>
                  <UserPlus className="h-4 w-4" />
                  Add Member
                </Button>
              )}

              {/* Use Group CTA */}
              {selectedGroup && selectedGroup.members.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center mb-3">
                    Pick this group when creating a new split to add all members at once
                  </p>
                  <Button
                    className="w-full gap-2"
                    onClick={() => { setSelectedGroupId(null); setLocation("/events/new"); }}
                  >
                    <Plus className="h-4 w-4" />
                    Create Split with {selectedGroup.name}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
