import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertAllocation } from "@shared/schema";

export function useAllocations() {
  return useQuery({
    queryKey: [api.allocations.list.path],
    queryFn: async () => {
      const res = await fetch(api.allocations.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return api.allocations.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAllocation) => {
      const res = await fetch(api.allocations.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to allocate asset");
      return api.allocations.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [api.allocations.list.path] });
        queryClient.invalidateQueries({ queryKey: [api.assets.list.path] });
    },
  });
}

export function useReturnAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, returnReason, status, details }: { id: number; returnReason: string; status: string; details?: any }) => {
      const url = buildUrl(api.allocations.return.path, { id });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnReason, status, details }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to return allocation");
      return api.allocations.return.responses[200].parse(await res.json());
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [api.allocations.list.path] });
        queryClient.invalidateQueries({ queryKey: [api.assets.list.path] });
    },
  });
}
