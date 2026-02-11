import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { insertEmployeeSchema, type InsertEmployee, type Employee } from "@shared/schema";

export function useEmployees(filters?: { search?: string; branch?: string }) {
  const queryKey = filters ? [api.employees.list.path, filters] : [api.employees.list.path];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = filters 
        ? `${api.employees.list.path}?${new URLSearchParams(filters as any).toString()}`
        : api.employees.list.path;
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return api.employees.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertEmployee) => {
      const validated = api.employees.create.input.parse(data);
      const res = await fetch(api.employees.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create employee");
      return api.employees.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.employees.list.path] }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertEmployee>) => {
      const validated = api.employees.update.input.parse(data);
      const url = buildUrl(api.employees.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update employee");
      return api.employees.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.employees.list.path] }),
  });
}

export function useImportEmployees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertEmployee[]) => {
      // Validate array of employees
      const res = await fetch(api.employees.import.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to import employees");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.employees.list.path] }),
  });
}
