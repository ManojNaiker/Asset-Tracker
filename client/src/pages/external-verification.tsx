import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function ExternalVerificationPage({ params }: { params: { token: string } }) {
  const [remarks, setRemarks] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<number[]>([]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: allocation, isLoading, error } = useQuery<any>({
    queryKey: ["/api/verifications/token", params.token],
    queryFn: async () => {
      const res = await fetch(`/api/verifications/token/${params.token}`);
      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.message || "Invalid or expired verification link");
        } catch (e) {
          throw new Error("Invalid or expired verification link");
        }
      }
      return res.json();
    }
  });

  const mutation = useMutation({
    mutationFn: async (status: "Approved" | "Rejected") => {
      if (selectedAssets.length === 0) {
        throw new Error("Please select the asset to proceed with verification");
      }
      const res = await fetch("/api/verifications/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.token,
          status,
          remarks
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (verification: any) => {
      toast({ title: "Verification submitted successfully" });
      setLocation(`/verification-success?id=${verification.id}`);
    },
    onError: (err: Error) => {
      toast({ 
        title: "Verification failed", 
        description: err.message,
        variant: "destructive" 
      });
    }
  });

  const toggleAsset = (id: number) => {
    setSelectedAssets(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-background text-destructive font-medium">{error.message}</div>;

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-lg border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Asset Verification</CardTitle>
          <CardDescription className="text-muted-foreground">
            Hello {allocation.employee.name}, please select and verify the asset(s) allocated to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2 text-foreground">
              <Info className="w-4 h-4 text-primary" />
              Allocated Assets
            </label>
            <div 
              className={`p-3 sm:p-4 rounded-lg border-2 transition-colors cursor-pointer flex items-start sm:items-center gap-3 sm:gap-4 ${
                selectedAssets.includes(allocation.asset.id) 
                  ? "bg-primary/10 border-primary/20" 
                  : "bg-card border-border"
              }`}
              onClick={() => toggleAsset(allocation.asset.id)}
            >
              <div className="pt-1 sm:pt-0">
                <Checkbox 
                  checked={selectedAssets.includes(allocation.asset.id)}
                  onCheckedChange={() => toggleAsset(allocation.asset.id)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <span className="font-medium text-foreground text-sm sm:text-base">{allocation.asset.type.name}</span>
                  <span className="text-[10px] sm:text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded self-start">
                    {allocation.asset.serialNumber}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Select this asset to approve or reject its current status.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Remarks (Optional)</label>
            <Textarea 
              placeholder="e.g. Asset received in good condition..." 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="min-h-[100px] bg-background text-foreground border-border"
            />
          </div>
        </CardContent>
        <CardFooter className="flex gap-4">
          <Button 
            variant="outline"
            className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10"
            onClick={() => mutation.mutate("Rejected")}
            disabled={mutation.isPending || selectedAssets.length === 0}
            data-testid="button-reject"
          >
            <XCircle className="w-4 h-4 mr-2" /> Reject
          </Button>
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => mutation.mutate("Approved")}
            disabled={mutation.isPending || selectedAssets.length === 0}
            data-testid="button-approve"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
