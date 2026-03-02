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
    mutationFn: async ({ assetId, status }: { assetId: number; status: string }) => {
      return apiRequest("POST", "/api/verifications", {
        assetId,
        status,
        remarks: `User self-acknowledgement: ${status}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verifications"] });
      toast({
        title: "Asset Verified",
        description: "Thank you for acknowledging the asset allocation.",
      });
    },
  });

  if (isLoading) return <LayoutShell>Loading...</LayoutShell>;

  return (
    <LayoutShell>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">My Allocated Assets</h1>
        <p className="text-muted-foreground mt-1">View equipment currently assigned to you and acknowledge receipt.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="dark:text-slate-200">Asset</TableHead>
              <TableHead className="dark:text-slate-200">Serial Number</TableHead>
              <TableHead className="dark:text-slate-200">Allocated Date</TableHead>
              <TableHead className="dark:text-slate-200">Status</TableHead>
              <TableHead className="text-right dark:text-slate-200">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations?.map((a) => (
              <TableRow key={a.id} className="dark:hover:bg-slate-800/30">
                <TableCell className="font-medium flex items-center gap-2 dark:text-slate-200">
                  <Box className="w-4 h-4 text-blue-500" />
                  Asset #{a.assetId}
                </TableCell>
                <TableCell className="dark:text-slate-400">{a.asset?.serialNumber}</TableCell>
                <TableCell className="dark:text-slate-400">{a.allocatedAt ? new Date(a.allocatedAt).toLocaleDateString() : "N/A"}</TableCell>
                <TableCell className="dark:text-slate-400">
                  <Badge variant="outline" className={a.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}>
                    {a.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {a.status === 'Active' && (
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        onClick={() => verifyMutation.mutate({ assetId: a.assetId, status: "Verified" })}
                        disabled={verifyMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        onClick={() => verifyMutation.mutate({ assetId: a.assetId, status: "Flagged" })}
                        disabled={verifyMutation.isPending}
                      >
                        <AlertCircle className="w-4 h-4 mr-1" /> Not Mine
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {allocations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No assets currently allocated to you.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </LayoutShell>
  );
}
