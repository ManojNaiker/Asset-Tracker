import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  color?: "blue" | "green" | "orange" | "purple";
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, color = "blue" }: StatCardProps) {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-xl ${colorStyles[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              trendUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              {trend}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold font-display mt-1 tracking-tight text-slate-900 dark:text-white">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
