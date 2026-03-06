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
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <CardContent className="p-3 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${colorStyles[color]}`}>
            <Icon className="w-4 h-4 sm:w-6 h-6" />
          </div>
          {trend && (
            <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
              trendUp ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {trend}
            </span>
          )}
        </div>
        <div className="mt-3 sm:mt-4">
          <p className="text-[10px] sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <h3 className="text-lg sm:text-2xl font-bold font-display mt-0.5 tracking-tight text-slate-900 dark:text-white leading-none">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
