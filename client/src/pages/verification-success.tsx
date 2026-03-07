import { CheckCircle2, Calendar, Hash, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export default function VerificationSuccessPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const { data: verification, isLoading, error } = useQuery<any>({
    queryKey: ["/api/verifications/public", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/verifications/public/${id}`);
      if (!res.ok) throw new Error("Failed to fetch verification details");
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !id) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md text-center border-border">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">Verification details not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-500/10 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Verification Submitted</CardTitle>
          <p className="text-muted-foreground mt-2">
            Your asset verification has been recorded successfully.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Hash className="w-4 h-4" />
                <span>Transaction ID</span>
              </div>
              <span className="font-mono font-medium text-foreground text-sm sm:text-base">
                #VER-{id}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <span className="w-4 h-4 flex items-center justify-center font-bold text-[10px]">A</span>
                <span>Asset</span>
              </div>
              <span className="font-medium text-foreground text-sm sm:text-base">
                {verification.assetName}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <span className="w-4 h-4 flex items-center justify-center font-bold text-[10px]">SN</span>
                <span>Serial Number</span>
              </div>
              <span className="font-mono text-xs text-foreground bg-background px-2 py-0.5 rounded self-start sm:self-auto border border-border">
                {verification.serialNumber}
              </span>
            </div>

            {verification?.verifiedAt && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>Date</span>
                  </div>
                  <span className="font-medium text-foreground text-sm sm:text-base">
                    {format(new Date(verification.verifiedAt), "PPP")}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Time</span>
                  </div>
                  <span className="font-medium text-foreground text-sm sm:text-base">
                    {format(new Date(verification.verifiedAt), "p")}
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="text-muted-foreground text-sm">Status</div>
              <div className="px-2 py-0.5 rounded text-xs font-semibold bg-green-500/10 text-green-500">
                {verification?.status || "Success"}
              </div>
            </div>
          </div>
          
          <div className="text-center text-xs text-muted-foreground pt-4">
            Please keep this screen for your records. You may now close this window.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
