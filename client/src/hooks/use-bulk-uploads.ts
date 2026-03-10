import { useQuery } from "@tanstack/react-query";

export function useBulkUploadLogs() {
  return useQuery({
    queryKey: ["/api/allocations/bulk-uploads"],
    queryFn: async () => {
      const res = await fetch("/api/allocations/bulk-uploads", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch upload logs");
      return res.json();
    },
  });
}

export function useBulkUploadLog(id: number) {
  return useQuery({
    queryKey: ["/api/allocations/bulk-uploads", id],
    queryFn: async () => {
      const res = await fetch(`/api/allocations/bulk-uploads/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch upload log");
      return res.json();
    },
  });
}
