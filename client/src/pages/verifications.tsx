import { useQuery, useMutation } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileCheck, Plus, CheckCircle2, XCircle } from "lucide-react";
import { api, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Verification } from "@shared/schema";

export default function VerificationsPage() {
  const { data: verifications, isLoading } = useQuery<Verification[]>({ 
    queryKey: ["/api/verifications"] 
  });

  if (isLoading) return <LayoutShell>Loading...</LayoutShell>;

  return (
    <LayoutShell>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Verifications</h1>
          <p className="text-muted-foreground mt-1">Review and verify asset allocations.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="dark:text-slate-200">Asset ID</TableHead>
              <TableHead className="dark:text-slate-200">Verifier ID</TableHead>
              <TableHead className="dark:text-slate-200">Status</TableHead>
              <TableHead className="dark:text-slate-200">Date</TableHead>
              <TableHead className="dark:text-slate-200">Remarks</TableHead>
              <TableHead className="text-right dark:text-slate-200">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {verifications?.map((v) => (
              <TableRow key={v.id} className="dark:hover:bg-slate-800/30">
                <TableCell className="dark:text-slate-200">#{v.assetId}</TableCell>
                <TableCell className="dark:text-slate-400">#{v.verifierId}</TableCell>
                <TableCell>
                  <Badge variant={v.status === "Approved" ? "default" : v.status === "Rejected" ? "destructive" : "secondary"}>
                    {v.status}
                  </Badge>
                </TableCell>
                <TableCell className="dark:text-slate-400">{v.verifiedAt ? new Date(v.verifiedAt).toLocaleDateString() : "N/A"}</TableCell>
                <TableCell className="max-w-xs truncate dark:text-slate-400">{v.remarks}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="dark:text-slate-300 dark:hover:text-white">View Details</Button>
                </TableCell>
              </TableRow>
            ))}
            {verifications?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No verification records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </LayoutShell>
  );
}
