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
        // Create a worksheet with headers and a sample row
        const data = [
            { "Serial Number": "SN001", "Asset Type Name": assetTypes[0]?.name || "Laptop", "Status": "Available" }
        ];
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Add a helper sheet for Asset Type Names so users know what to type
        const typeNames = assetTypes.map(t => [t.name]);
        const typeSheet = XLSX.utils.aoa_to_sheet([["Available Asset Types"], ...typeNames]);
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
        XLSX.utils.book_append_sheet(workbook, typeSheet, "Valid Asset Types");
        
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

                if (data.length === 0) {
                    throw new Error("The uploaded file is empty");
                }

                const formattedData = data.map((item: any, index: number) => {
                    const typeName = String(item["Asset Type Name"] || "").trim();
                    const type = assetTypes.find(t => t.name.toLowerCase() === typeName.toLowerCase());
                    
                    if (!type) {
                        throw new Error(`Row ${index + 2}: Asset Type "${typeName}" not found. Please check "Valid Asset Types" sheet.`);
                    }

                    return {
                        serialNumber: String(item["Serial Number"] || "").trim().toUpperCase(),
                        assetTypeId: type.id,
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
                toast({ 
                    title: "Import Failed", 
                    description: err.message || "Invalid data format", 
                    variant: "destructive" 
                });
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
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
        const data = [
            { "Employee ID": "EMP001", "Asset Serial Number": "SN001", "Action": "Allocate", "Return Reason": "" },
            { "Employee ID": "EMP002", "Asset Serial Number": "SN002", "Action": "Return", "Return Reason": "Upgrading" }
        ];
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Add hints sheet
        const hints = [
            ["Action Options", "Description"],
            ["Allocate", "Assigns an available asset to the employee"],
            ["Return", "Marks an existing allocation as returned"]
        ];
        const hintSheet = XLSX.utils.aoa_to_sheet(hints);
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Allocations");
        XLSX.utils.book_append_sheet(workbook, hintSheet, "Instructions");
        
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

                const formattedData = data.map((item: any) => {
                    const action = String(item["Action"] || "Allocate").trim().toLowerCase();
                    return {
                        employeeEmpId: String(item["Employee ID"] || "").trim(),
                        assetSerialNumber: String(item["Asset Serial Number"] || "").trim().toUpperCase(),
                        status: action === "return" ? "Returned" : "Active",
                        returnReason: item["Return Reason"] || ""
                    };
                });

                await apiRequest("POST", "/api/allocations/import", formattedData);
                queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
                queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
                toast({ title: "Allocations processed successfully" });
                setOpen(false);
            } catch (err: any) {
                toast({ title: "Failed to process allocations", description: err.message, variant: "destructive" });
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
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
