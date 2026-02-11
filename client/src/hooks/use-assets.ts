import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertAsset, type AssetType, type InsertAssetType } from "@shared/schema";

// --- Asset Types ---

export function useAssetTypes() {
  return useQuery({
    queryKey: [api.assetTypes.list.path],
    queryFn: async () => {
      const res = await fetch(api.assetTypes.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch asset types");
      return api.assetTypes.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAssetType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAssetType) => {
      const res = await fetch(api.assetTypes.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create asset type");
      return api.assetTypes.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.assetTypes.list.path] }),
  });
}

// --- Assets ---

export function useAssets(filters?: { search?: string; status?: string }) {
  const queryKey = filters ? [api.assets.list.path, filters] : [api.assets.list.path];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = filters 
        ? `${api.assets.list.path}?${new URLSearchParams(filters as any).toString()}`
        : api.assets.list.path;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assets");
      const json = await res.json();
      return api.assets.list.responses[200].parse(json);
    },
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertAsset) => {
        // Zod coercion for numbers happens on server side if configured, 
        // but here we ensure typeId is a number before sending if possible.
        // The API schema handles input validation.
      const res = await fetch(api.assets.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create asset");
      return api.assets.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [api.assets.list.path] });
        queryClient.invalidateQueries({ queryKey: [api.stats.dashboard.path] });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertAsset>) => {
      const url = buildUrl(api.assets.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update asset");
      return api.assets.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.assets.list.path] }),
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.assets.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete asset");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.assets.list.path] }),
  });
}
