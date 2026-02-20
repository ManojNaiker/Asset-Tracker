import { useQuery } from "@tanstack/react-query";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "user" | "viewer";
  employeeCode?: string;
  designation?: string;
  department?: string;
  profileImageUrl?: string;
  isActivated?: boolean;
  mustChangePassword?: boolean;
  authMethod?: "local" | "saml";
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
