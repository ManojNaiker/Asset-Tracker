import { useQuery } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Box } from "lucide-react";
import { Allocation, Asset } from "@shared/schema";

export default function MyAssetsPage() {
  const { data: allocations, isLoading } = useQuery<(Allocation & { asset: Asset })[]>({ 
    queryKey: ["/api/allocations"] 
  });

  // In a real app, we'd filter these by the logged-in user on the backend
  // For now, showing all allocations associated with assets

  if (isLoading) return <LayoutShell>Loading...</LayoutShell>;

  return (
    <LayoutShell>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">My Allocated Assets</h1>
        <p className="text-muted-foreground mt-1">View equipment currently assigned to you.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="dark:text-slate-200">Asset</TableHead>
              <TableHead className="dark:text-slate-200">Serial Number</TableHead>
              <TableHead className="dark:text-slate-200">Allocated Date</TableHead>
              <TableHead className="dark:text-slate-200">Status</TableHead>
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
                <TableCell className="dark:text-slate-400">{a.status}</TableCell>
              </TableRow>
            ))}
            {allocations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
