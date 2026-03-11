import { useState, useRef } from "react";
import { useAssets, useCreateAsset, useAssetTypes } from "@/hooks/use-assets";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssetSchema, type InsertAsset } from "@shared/schema";
import { Plus, Search, Filter, Loader2, FileText, Eye, History, Upload, Download, ImageIcon } from "lucide-react";
import { ImagePreview } from "@/components/image-preview";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { BulkAssetUploadDialog } from "@/components/bulk-upload-dialogs";
import { QRBarcodeScanner } from "@/components/qr-barcode-scanner";
import * as XLSX from "xlsx";

export default function AssetsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"inventory" | "search">("inventory");
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const { data: assets, isLoading } = useAssets({ search, status: statusFilter });
  const { data: assetTypes } = useAssetTypes();

  const filteredAssets = assets?.filter(asset => {
    if (typeFilter && asset.type.id !== Number(typeFilter)) return false;
    return true;
  });

  const handleSearchDetected = (serialNumber: string) => {
    setSearch(serialNumber);
    const found = assets?.find(a => a.serialNumber === serialNumber);
    setSearchResult(found || null);
  };

  return (
    <LayoutShell>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Asset Inventory</h1>
          <p className="text-muted-foreground mt-1">Manage and track company assets.</p>
        </div>
        <div className="flex gap-2 flex-wrap md:flex-nowrap">
            <BulkAssetUploadDialog assetTypes={assetTypes || []} />
            <CreateAssetDialog assetTypes={assetTypes || []} />
            <Button 
              variant={activeTab === "inventory" ? "default" : "outline"}
              onClick={() => setActiveTab("inventory")}
              className="font-semibold"
              data-testid="button-inventory-tab"
            >
              Inventory
            </Button>
            <Button 
              variant={activeTab === "search" ? "default" : "outline"}
              onClick={() => setActiveTab("search")}
              className="font-semibold"
              data-testid="button-asset-search-tab"
            >
              Asset Search
            </Button>
        </div>
      </div>

      {activeTab === "inventory" && (
      <>
      <Card className="mb-6 shadow-sm border-border">
        <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by serial number..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-muted/20 border-border focus:bg-background transition-colors"
                    />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Asset Type" />
                    </SelectTrigger>
                    <SelectContent>
                        {assetTypes?.map(t => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Available">Available</SelectItem>
                        <SelectItem value="Allocated">Allocated</SelectItem>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                        <SelectItem value="Lost">Lost</SelectItem>
                        <SelectItem value="Scrapped">Scrapped</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {(search || typeFilter || statusFilter) && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter(undefined); setStatusFilter(undefined); }} className="w-full">
                    Clear All Filters
                </Button>
            )}
        </CardContent>
      </Card>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
        <Table className="min-w-[800px] md:min-w-full">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-foreground">Serial Number</TableHead>
              <TableHead className="text-foreground">Type</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
              <TableHead className="text-foreground">Added Date</TableHead>
              <TableHead className="text-right text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                </TableRow>
            ) : assets?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        No assets found.
                    </TableCell>
                </TableRow>
            ) : (
                filteredAssets?.map((asset) => (
                    <TableRow key={asset.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium font-mono text-foreground">{asset.serialNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{asset.type.name}</TableCell>
                        <TableCell>
                            <StatusBadge status={asset.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                            {new Date(asset.createdAt!).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                            <ViewAssetLifecycleDialog asset={asset} />
                        </TableCell>
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
      </>
      )}

      {activeTab === "search" && (
      <div className="space-y-6">
        <Card className="shadow-sm border-border">
          <CardContent className="p-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Search Asset by Serial Number</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <QRBarcodeScanner onDetected={handleSearchDetected} placeholder="Scan or enter asset serial number" />
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Or type serial number..." 
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value.toUpperCase());
                      const found = assets?.find(a => a.serialNumber.includes(e.target.value.toUpperCase()));
                      setSearchResult(found || null);
                    }}
                    className="pl-9 bg-muted/20 border-border focus:bg-background transition-colors"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {searchResult ? (
          <Card className="shadow-sm border-border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Asset Found</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase">Serial Number</p>
                  <p className="font-mono text-foreground">{searchResult.serialNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase">Type</p>
                  <p className="text-foreground">{searchResult.type?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase">Status</p>
                  <StatusBadge status={searchResult.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase">Added</p>
                  <p className="text-foreground">{new Date(searchResult.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : search ? (
          <Card className="shadow-sm border-border bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">No asset found with serial number: <span className="font-mono font-semibold">{search}</span></p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm border-border">
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Scan a QR code, barcode, or enter a serial number to search</p>
            </CardContent>
          </Card>
        )}
      </div>
      )}

    </LayoutShell>
  );
}

function ViewAssetLifecycleDialog({ asset }: { asset: any }) {
    const { data: allocations, isLoading } = useQuery<(any)[]>({
        queryKey: ["/api/allocations"],
    });

    const assetAllocations = allocations?.filter(a => a.assetId === asset.id).sort((a, b) => 
        new Date(b.allocatedAt).getTime() - new Date(a.allocatedAt).getTime()
    );

    const exportLifecycle = () => {
        if (!assetAllocations || assetAllocations.length === 0) return;

        const exportData = assetAllocations.map(a => ({
            "Employee Name": a.employee?.name || "Unknown",
            "Employee ID": a.employee?.id || "N/A",
            "Allocated Date": new Date(a.allocatedAt).toLocaleString(),
            "Return Date": a.returnDate ? new Date(a.returnDate).toLocaleString() : "Active",
            "Status": a.status,
            "Verification Status": a.verificationStatus || "N/A"
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Lifecycle");
        XLSX.writeFile(workbook, `${asset.serialNumber}_lifecycle_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                    <Eye className="w-4 h-4 mr-1" /> View
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <div className="flex justify-between items-center">
                    <DialogHeader>
                        <DialogTitle>Asset Lifecycle: {asset.serialNumber}</DialogTitle>
                    </DialogHeader>
                    {assetAllocations && assetAllocations.length > 0 && (
                        <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={exportLifecycle}
                            className="flex items-center gap-2"
                            data-testid="button-export-lifecycle"
                        >
                            <Download className="w-4 h-4" /> Export
                        </Button>
                    )}
                </div>
                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg border border-border">
                        <div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Type</p>
                            <p className="text-sm font-medium text-foreground">{asset.type?.name}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Status</p>
                            <StatusBadge status={asset.status} />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Added On</p>
                            <p className="text-sm font-medium text-foreground">{new Date(asset.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {(() => {
                        const allImgs: string[] = [];
                        // Collect from asset-level images
                        if (asset.images?.length) allImgs.push(...asset.images);
                        // Collect from allocation images (most recent first)
                        assetAllocations?.forEach((a: any) => {
                            if (a.images?.length) allImgs.push(...a.images);
                            else if (a.imageUrl) allImgs.push(a.imageUrl);
                        });
                        return allImgs.length > 0 ? (
                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4" /> Asset Photos
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {allImgs.map((url: string, idx: number) => (
                                        <ImagePreview key={idx} src={url} alt={`Asset photo ${idx + 1}`} className="aspect-square" />
                                    ))}
                                </div>
                            </div>
                        ) : null;
                    })()}

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <History className="w-4 h-4" /> Allocation History
                        </h3>
                        {isLoading ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                        ) : !assetAllocations || assetAllocations.length === 0 ? (
                            <p className="text-center py-4 text-muted-foreground text-sm">No allocation history found.</p>
                        ) : (
                            <div className="relative border-l-2 border-border ml-3 pl-6 space-y-6">
                                {assetAllocations.map((a, i) => (
                                    <div key={a.id} className="relative">
                                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-semibold text-foreground">
                                                    Allocated to {a.employee?.name}
                                                </p>
                                                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{a.status}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(a.allocatedAt).toLocaleString()}
                                            </p>
                                            {a.returnDate && (
                                                <p className="text-xs text-destructive font-medium">
                                                    Returned: {new Date(a.returnDate).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        Available: "bg-green-500/10 text-green-500 border-green-500/20",
        Allocated: "bg-primary/10 text-primary border-primary/20",
        Damaged: "bg-destructive/10 text-destructive border-destructive/20",
        Lost: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        Scrapped: "bg-muted text-muted-foreground border-border",
    };
    return <Badge variant="outline" className={`${styles[status] || "bg-muted"} px-2 py-0.5 rounded-full`}>{status}</Badge>;
}

function CreateAssetDialog({ assetTypes }: { assetTypes: any[] }) {
    const [open, setOpen] = useState(false);
    const mutation = useCreateAsset();
    const form = useForm<InsertAsset>({
        resolver: zodResolver(insertAssetSchema),
        defaultValues: {
            assetTypeId: undefined as any,
            serialNumber: "",
            status: "Available",
            specifications: {},
            images: [],
        }
    });

    const onSubmit = (data: InsertAsset) => {
        // Ensure numbers are numbers
        const submissionData = {
            ...data,
            assetTypeId: Number(data.assetTypeId)
        };
        mutation.mutate(submissionData, {
            onSuccess: () => {
                setOpen(false);
                form.reset();
            }
        });
    };

    const handleSNDetected = (serialNumber: string) => {
        form.setValue("serialNumber", serialNumber);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4 mr-2" /> Add Asset
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Asset</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="serialNumber"
                            render={({ field }) => (
                                <FormItem>
                                            <FormLabel>Serial Number</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input 
                                                placeholder="SN-12345" 
                                                {...field} 
                                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                                className="pr-10"
                                            />
                                            <QRBarcodeScanner onDetected={handleSNDetected} placeholder="SN-12345" inline={true} />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="assetTypeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Asset Type</FormLabel>
                                    <Select 
                                        onValueChange={(val) => {
                                            field.onChange(Number(val));
                                        }} 
                                        value={field.value ? String(field.value) : ""}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {assetTypes.map(t => (
                                                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending ? "Adding..." : "Add Asset"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
