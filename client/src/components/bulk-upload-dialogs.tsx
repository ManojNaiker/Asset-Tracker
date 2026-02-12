import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function BulkAssetUploadDialog({ assetTypes }: { assetTypes: any[] }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const downloadTemplate = () => {
        const worksheet = XLSX.utils.json_to_sheet([
            { "Serial Number": "SN001", "Asset Type Name": assetTypes[0]?.name || "Laptop", "Status": "Available" }
        ]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
        XLSX.writeFile(workbook, "asset_upload_template.xlsx");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const formattedData = data.map((item: any) => {
                    const type = assetTypes.find(t => t.name === item["Asset Type Name"]);
                    return {
                        serialNumber: String(item["Serial Number"]),
                        assetTypeId: type?.id || assetTypes[0]?.id,
                        status: item["Status"] || "Available",
                        specifications: {},
                        images: []
                    };
                });

                await apiRequest("POST", "/api/assets/import", formattedData);
                queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
                toast({ title: "Assets imported successfully" });
                setOpen(false);
            } catch (err: any) {
                toast({ title: "Failed to import assets", description: err.message, variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" /> Bulk Upload
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bulk Upload Assets</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex flex-col gap-4">
                        <Button onClick={downloadTemplate} variant="secondary">
                            <Download className="w-4 h-4 mr-2" /> Download Template
                        </Button>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <Button
                                className="w-full"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                {loading ? "Uploading..." : "Select File"}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function BulkAllocationUploadDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const downloadTemplate = () => {
        const worksheet = XLSX.utils.json_to_sheet([
            { "Employee ID": "EMP001", "Asset Serial Number": "SN001", "Status": "Active", "Return Reason": "" }
        ]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Allocations");
        XLSX.writeFile(workbook, "allocation_upload_template.xlsx");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const formattedData = data.map((item: any) => ({
                    employeeEmpId: String(item["Employee ID"]),
                    assetSerialNumber: String(item["Asset Serial Number"]),
                    status: item["Status"] || "Active",
                    returnReason: item["Return Reason"] || ""
                }));

                await apiRequest("POST", "/api/allocations/import", formattedData);
                queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
                queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
                toast({ title: "Allocations imported successfully" });
                setOpen(false);
            } catch (err: any) {
                toast({ title: "Failed to import allocations", description: err.message, variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" /> Bulk Upload
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bulk Upload Allocations</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex flex-col gap-4">
                        <Button onClick={downloadTemplate} variant="secondary">
                            <Download className="w-4 h-4 mr-2" /> Download Template
                        </Button>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <Button
                                className="w-full"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                {loading ? "Uploading..." : "Select File"}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
