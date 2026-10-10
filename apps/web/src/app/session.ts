import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { urlFor } from "@forkvlift/shared";
import { api } from "../lib/api";

export const sessionKey = ["session"] as const;

/** The signed-in user (null when signed out). */
export function useSession() {
  const query = useQuery({ queryKey: sessionKey, queryFn: () => api.call("me") });
  return { user: query.data?.user ?? null, isLoading: query.isLoading, error: query.error };
}

export function signInUrl(returnTo = location.pathname + location.search) {
  return urlFor("githubStart", { query: { returnTo } });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.call("logout"),
    onSuccess: () => qc.setQueryData(sessionKey, { user: null }),
  });
}

export function useSiteConfig() {
  return useQuery({ queryKey: ["siteConfig"], queryFn: () => api.call("siteConfig"), staleTime: Infinity });
}
