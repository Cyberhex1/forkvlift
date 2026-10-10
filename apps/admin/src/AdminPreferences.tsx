import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SITE_NAME } from "@forkvlift/shared";
import { api } from "./api";

/** Apply account theme/motion settings to the same token selectors as the public app. Access authorization remains with the admin API. */
export function AdminPreferences() {
  const session = useQuery({ queryKey: ["session"], queryFn: () => api.call("me"), retry: false });
  const settings = session.data?.user?.settings;
  useEffect(() => {
    document.title = `${SITE_NAME} admin`;
    const root = document.documentElement;
    if (!settings || settings.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    if (!settings || settings.reducedMotion === "system") delete root.dataset.motion;
    else root.dataset.motion = settings.reducedMotion === "on" ? "reduce" : "full";
  }, [settings]);
  return null;
}
