"use client";

import { useState } from "react";
import {
  Shield,
  Users,
  Layers,
  Coins,
  DollarSign,
  RotateCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { trpc } from "~/trpc/client";
import { toast } from "sonner";

export default function AdminDashboardPage() {
  const statsQuery = trpc.admin.getStats.useQuery();
  const [userSearch, setUserSearch] = useState("");
  const usersQuery = trpc.admin.getUsers.useQuery({ page: 1, limit: 20, search: userSearch });
  const [jobStatus, setJobStatus] = useState<any>(undefined);
  const jobsQuery = trpc.admin.getJobs.useQuery({ page: 1, limit: 20, status: jobStatus });

  const adjustCreditsMutation = trpc.admin.adjustCredits.useMutation();
  const retryJobMutation = trpc.admin.retryJob.useMutation();

  // Credit adjustment state
  const [adjustTarget, setAdjustTarget] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>("10");
  const [adjustReason, setAdjustReason] = useState<string>("Manual admin courtesy credits");
  const [isAdjusting, setIsAdjusting] = useState(false);

  const handleAdjustCredits = async () => {
    if (!adjustTarget || !adjustAmount) return;
    setIsAdjusting(true);
    try {
      await adjustCreditsMutation.mutateAsync({
        userId: String(adjustTarget._id),
        amount: parseInt(adjustAmount, 10),
        reason: adjustReason,
      });
      toast.success(`Successfully adjusted credits for ${adjustTarget.fullName}`);
      setAdjustTarget(null);
      usersQuery.refetch();
      statsQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust credits");
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryJobMutation.mutateAsync({ listingObjectId: jobId });
      toast.success("Job re-enqueued to BullMQ worker");
      jobsQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to retry job");
    }
  };

  const stats = statsQuery.data;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-rose-600 text-white font-bold text-[10px]">Restricted Area</Badge>
          </div>
          <h1 className="text-3xl font-black tracking-tight mt-1 flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-400" />
            ListingLift Admin Console
          </h1>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total Users</span>
            <div className="text-3xl font-black mt-1">{stats?.totalUsers ?? "..."}</div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total Listings</span>
            <div className="text-3xl font-black mt-1">{stats?.totalListings ?? "..."}</div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Gross Revenue</span>
            <div className="text-3xl font-black text-emerald-400 mt-1">
              ₹{stats?.revenueRupees?.toLocaleString() ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Estimated Profit</span>
            <div className="text-3xl font-black text-indigo-400 mt-1">
              ₹{stats?.estimatedProfitRupees?.toLocaleString() ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid grid-cols-2 max-w-xs">
          <TabsTrigger value="users" className="gap-1.5 text-xs font-bold">
            <Users className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5 text-xs font-bold">
            <Layers className="h-3.5 w-3.5" /> Job Queue
          </TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, store..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground uppercase font-bold text-[10px] border-b border-border/40">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Store Name</th>
                  <th className="p-3">Credits</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(usersQuery.data?.users || []).map((u: any) => (
                  <tr key={u._id} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold">
                      <div>{u.fullName}</div>
                      <div className="text-[11px] text-muted-foreground font-normal">{u.email}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{u.storeName || "—"}</td>
                    <td className="p-3 font-bold text-amber-400">{u.creditBalance}</td>
                    <td className="p-3">
                      <Badge variant={u.role === "admin" ? "default" : "outline"} className="capitalize text-[10px]">
                        {u.role}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAdjustTarget(u);
                          setAdjustAmount("10");
                        }}
                        className="h-7 text-xs font-semibold"
                      >
                        Adjust Credits
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* JOBS TAB */}
        <TabsContent value="jobs" className="space-y-4">
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground uppercase font-bold text-[10px] border-b border-border/40">
                <tr>
                  <th className="p-3">Product Title</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Credits</th>
                  <th className="p-3">Retries</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(jobsQuery.data?.jobs || []).map((job: any) => (
                  <tr key={job._id} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold max-w-[200px] truncate">
                      {job.userTitle || "Untitled"}
                    </td>
                    <td className="p-3 text-muted-foreground capitalize">
                      {job.type?.replace("_", " ")}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          job.status === "completed"
                            ? "default"
                            : job.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        className="capitalize text-[10px]"
                      >
                        {job.status}
                      </Badge>
                    </td>
                    <td className="p-3">{job.creditsCharged}</td>
                    <td className="p-3">{job.retryCount || 0}</td>
                    <td className="p-3 text-right">
                      {job.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryJob(String(job._id))}
                          className="h-7 text-xs font-semibold gap-1 text-indigo-400"
                        >
                          <RotateCw className="h-3 w-3" /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Credit Adjustment Modal */}
      <Dialog open={!!adjustTarget} onOpenChange={() => setAdjustTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Credits for {adjustTarget?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Amount (positive to add, negative to deduct)
              </label>
              <Input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Reason</label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustCredits}
              disabled={isAdjusting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {isAdjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
