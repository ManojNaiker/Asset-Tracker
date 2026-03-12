import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function BulkAssetUploadDialog({ assetTypes }: { assetTypes: any[] }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const downloadTemplate = () => {
        // Create a worksheet with headers and a sample row
        const data: any[] = [
            { "Serial Number": "SN001", "Asset Type Name": assetTypes[0]?.name || "Laptop", "Status": "Available" }
        ];
        
        // Add dynamic fields from schema if available
        if (assetTypes[0]?.schema) {
            assetTypes[0].schema.forEach((field: any) => {
                data[0][field.name] = field.type === 'number' ? 0 : "Value";
            });
        }

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

                    // Extract specifications from extra columns
                    const specifications: Record<string, any> = {};
                    if (type.schema) {
                        type.schema.forEach((field: any) => {
                            if (item[field.name] !== undefined) {
                                specifications[field.name] = item[field.name];
                            }
                        });
                    }

                    return {
                        serialNumber: String(item["Serial Number"] || "").trim().toUpperCase(),
                        assetTypeId: type.id,
                        status: item["Status"] || "Available",
                        specifications,
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
    const [report, setReport] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const downloadTemplate = async (type: 'basic' | 'auto') => {
        try {
            const res = await fetch("/api/templates/allocations");
            const data = await res.json();
            const template = type === 'basic' ? data.basic : data.autoCreate;
            
            const worksheet = XLSX.utils.json_to_sheet(template);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
            XLSX.writeFile(workbook, `allocation_${type}_template.xlsx`);
        } catch (error) {
            toast({ title: "Failed to download template", variant: "destructive" });
        }
    };

    const downloadBatchFile = (type: 'failed' | 'created', data: any[]) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        XLSX.writeFile(workbook, `allocations_${type}_${Date.now()}.xlsx`);
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

                const response = await apiRequest("POST", "/api/allocations/bulk-import", data);
                const result = await response.json();
                setReport(result);
                queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
                queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
                queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
                queryClient.invalidateQueries({ queryKey: ["/api/allocations/bulk-uploads"] });
                toast({ title: "Upload complete", description: `Created: ${result.created}, Failed: ${result.failed}` });
            } catch (err: any) {
                toast({ title: "Failed to process allocations", description: err.message, variant: "destructive" });
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsBinaryString(file);
    };

    if (report) {
        return (
            <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setReport(null); }}>
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" /> Bulk Upload
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Bulk Upload Report</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                <p className="text-sm text-muted-foreground">Created</p>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{report.created}</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                <p className="text-sm text-muted-foreground">Failed</p>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{report.failed}</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-muted-foreground">Pending</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{report.pending}</p>
                            </div>
                        </div>

                        {report.failed > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-medium text-sm">Failed Records ({report.failed})</h3>
                                <div className="max-h-40 overflow-y-auto border rounded p-2 bg-muted/30">
                                    {report.failedData?.map((row: any, idx: number) => (
                                        <div key={idx} className="text-xs text-muted-foreground py-1 border-b">
                                            {Object.entries(row).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" | ")} ... {row.error}
                                        </div>
                                    ))}
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => downloadBatchFile('failed', report.failedData)}
                                    className="w-full"
                                >
                                    <Download className="w-3 h-3 mr-2" /> Download Failed Records
                                </Button>
                            </div>
                        )}

                        {report.created > 0 && (
                            <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => downloadBatchFile('created', report.createdData)}
                                className="w-full"
                            >
                                <Download className="w-3 h-3 mr-2" /> Download Created Records
                            </Button>
                        )}

                        <Button 
                            onClick={() => { setReport(null); setOpen(false); }}
                            className="w-full"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

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
                    <div className="flex flex-col gap-2">
                        <Label>Templates</Label>
                        <div className="flex gap-2">
                            <Button onClick={() => downloadTemplate('basic')} variant="secondary" className="flex-1">
                                <Download className="w-4 h-4 mr-2" /> Basic (IDs)
                            </Button>
                            <Button onClick={() => downloadTemplate('auto')} variant="secondary" className="flex-1">
                                <Download className="w-4 h-4 mr-2" /> Auto-Create (Names)
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2 border-t pt-4">
                        <Label htmlFor="alloc-file">Select Excel File</Label>
                        <div className="relative">
                            <input
                                id="alloc-file"
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

export function BulkEmployeeUploadDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const downloadTemplate = () => {
        const data = [
            { 
                "Employee ID": "EMP001", 
                "Full Name": "John Doe", 
                "Email": "john.doe@example.com", 
                "Branch": "Main", 
                "Department": "IT", 
                "Designation": "Developer", 
                "Mobile": "1234567890",
                "Joining Date": "2024-01-01"
            }
        ];
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
        XLSX.writeFile(workbook, "employee_upload_template.xlsx");
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
                    empId: String(item["Employee ID"] || "").trim(),
                    name: String(item["Full Name"] || "").trim(),
                    email: String(item["Email"] || "").trim(),
                    branch: String(item["Branch"] || "").trim(),
                    department: String(item["Department"] || "").trim(),
                    designation: String(item["Designation"] || "").trim(),
                    mobile: String(item["Mobile"] || "").trim(),
                    dateOfJoining: item["Joining Date"] ? new Date(item["Joining Date"]).toISOString().split('T')[0] : null,
                    status: "Active"
                }));

                await apiRequest("POST", "/api/employees/import", formattedData);
                queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
                toast({ title: "Employees imported successfully" });
                setOpen(false);
            } catch (err: any) {
                toast({ title: "Failed to import employees", description: err.message, variant: "destructive" });
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
                    <DialogTitle>Bulk Upload Employees</DialogTitle>
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

export function BulkUserUploadDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const downloadTemplate = () => {
        const data = [
            { 
                "Username/Email": "user@example.com", 
                "Password": "DefaultPassword123", 
                "Role": "user", 
                "Full Name": "John Doe", 
                "Employee Code": "LC001", 
                "Department": "IT", 
                "Designation": "Developer"
            }
        ];
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
        XLSX.writeFile(workbook, "user_upload_template.xlsx");
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
                    username: String(item["Username/Email"] || "").trim(),
                    password: String(item["Password"] || "User@123"),
                    role: String(item["Role"] || "user").toLowerCase(),
                    fullName: String(item["Full Name"] || "").trim(),
                    employeeCode: String(item["Employee Code"] || "").trim(),
                    department: String(item["Department"] || "").trim(),
                    designation: String(item["Designation"] || "").trim()
                }));

                await apiRequest("POST", "/api/users/bulk", formattedData);
                queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
                queryClient.invalidateQueries({ queryKey: ["/api/designations"] });
                toast({ title: "Users imported successfully" });
                setOpen(false);
            } catch (err: any) {
                toast({ title: "Failed to import users", description: err.message, variant: "destructive" });
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
                    <DialogTitle>Bulk Upload Users</DialogTitle>
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

export function BulkDepartmentUploadDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const downloadTemplate = () => {
        const data = [{ "Department Name": "Human Resources" }];
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Departments");
        XLSX.writeFile(workbook, "department_upload_template.xlsx");
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
                    name: String(item["Department Name"] || "").trim()
                })).filter(d => d.name);

                await apiRequest("POST", "/api/departments/bulk", formattedData);
                queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
                toast({ title: "Departments imported successfully" });
                setOpen(false);
            } catch (err: any) {
                toast({ title: "Failed to import departments", description: err.message, variant: "destructive" });
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
                    <DialogTitle>Bulk Upload Departments</DialogTitle>
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

export function BulkDesignationUploadDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const downloadTemplate = () => {
        const data = [{ "Designation Name": "Senior Manager" }];
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Designations");
        XLSX.writeFile(workbook, "designation_upload_template.xlsx");
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
                    name: String(item["Designation Name"] || "").trim()
                })).filter(d => d.name);

                await apiRequest("POST", "/api/designations/bulk", formattedData);
                queryClient.invalidateQueries({ queryKey: ["/api/designations"] });
                toast({ title: "Designations imported successfully" });
                setOpen(false);
            } catch (err: any) {
                toast({ title: "Failed to import designations", description: err.message, variant: "destructive" });
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
                    <DialogTitle>Bulk Upload Designations</DialogTitle>
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
