import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function VerificationSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Verification Complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 dark:text-slate-400">
            Thank you! Your asset verification has been submitted successfully.
          </p>
          <Button asChild className="w-full bg-blue-600">
            <Link href="/auth">Go to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
