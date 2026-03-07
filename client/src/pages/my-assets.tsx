import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Box, CheckCircle2, AlertCircle } from "lucide-react";
import { Allocation, Asset } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function MyAssetsPage() {
  const { toast } = useToast();
  const { data: allocations, isLoading } = useQuery<(Allocation & { asset: Asset })[]>({ 
    queryKey: ["/api/allocations"] 
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ assetId, status, remarks }: { assetId: number; status: string; remarks?: string }) => {
      return apiRequest("POST", "/api/verifications", {
        assetId,
        status,
        remarks: remarks || `User self-acknowledgement: ${status}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      toast({
        title: "Asset Status Updated",
        description: "Your response has been recorded successfully.",
      });
    },
  });

  const [comment, setComment] = useState("");

  if (isLoading) return <LayoutShell>Loading...</LayoutShell>;

  return (
    <LayoutShell>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Asset Allocation Confirmation</h1>
        <p className="text-muted-foreground mt-1">Review equipment currently assigned to you and acknowledge receipt.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto mb-6">
        <Table className="min-w-[900px] md:min-w-full">
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="w-12"></TableHead>
              <TableHead className="dark:text-slate-200">Inventory No.</TableHead>
              <TableHead className="dark:text-slate-200">Asset No.</TableHead>
              <TableHead className="dark:text-slate-200">Category</TableHead>
              <TableHead className="dark:text-slate-200">Asset Name</TableHead>
              <TableHead className="dark:text-slate-200">Description</TableHead>
              <TableHead className="dark:text-slate-200">Allocated Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations?.map((a) => (
              <TableRow key={a.id} className="dark:hover:bg-slate-800/30">
                <TableCell>
                  <input type="checkbox" defaultChecked className="rounded border-slate-300" />
                </TableCell>
                <TableCell className="dark:text-slate-400 font-mono text-xs">{a.asset?.serialNumber}</TableCell>
                <TableCell className="text-blue-600 underline dark:text-blue-400 text-xs">{a.asset?.serialNumber}</TableCell>
                <TableCell className="dark:text-slate-400 text-xs">{a.asset?.type?.name || "General"}</TableCell>
                <TableCell className="dark:text-slate-400 text-xs font-medium">{a.asset?.type?.name}</TableCell>
                <TableCell className="dark:text-slate-400 text-xs">{a.remarks || "No description provided"}</TableCell>
                <TableCell className="dark:text-slate-400 text-xs">{a.allocatedAt ? new Date(a.allocatedAt).toLocaleDateString() : "N/A"}</TableCell>
              </TableRow>
            ))}
            {allocations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No assets currently allocated to you.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {allocations && allocations.length > 0 && (
        <div className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Comment</label>
            <textarea 
              className="w-full min-h-[100px] p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add your comments here..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
              onClick={() => {
                if (allocations && allocations.length > 0) {
                  verifyMutation.mutate({ 
                    assetId: allocations[0].assetId, 
                    status: "Approved",
                    remarks: comment 
                  });
                }
              }}
              disabled={verifyMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
            </Button>
            <Button 
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 min-w-[120px]"
              onClick={() => {
                if (allocations && allocations.length > 0) {
                  verifyMutation.mutate({ 
                    assetId: allocations[0].assetId, 
                    status: "Rejected",
                    remarks: comment 
                  });
                }
              }}
              disabled={verifyMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" /> Reject
            </Button>
            <Button 
              variant="outline"
              className="bg-green-700 hover:bg-green-800 text-white border-none"
            >
              View Other Assignment
            </Button>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}
