import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function ExternalVerificationPage({ params }: { params: { token: string } }) {
  const [remarks, setRemarks] = useState("");
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
    onSuccess: () => {
      toast({ title: "Verification submitted successfully" });
      setLocation("/verification-success");
    }
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600 font-medium">{error.message}</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 flex items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Asset Verification</CardTitle>
          <CardDescription>
            Hello {allocation.employee.name}, please verify the following asset allocated to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Asset Type:</span>
              <span className="font-medium">{allocation.asset.type.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Serial Number:</span>
              <span className="font-mono font-medium">{allocation.asset.serialNumber}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Remarks (Optional)</label>
            <Textarea 
              placeholder="e.g. Asset received in good condition..." 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
        <CardFooter className="flex gap-4">
          <Button 
            variant="outline"
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => mutation.mutate("Rejected")}
            disabled={mutation.isPending}
          >
            <XCircle className="w-4 h-4 mr-2" /> Reject
          </Button>
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => mutation.mutate("Approved")}
            disabled={mutation.isPending}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
