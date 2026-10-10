/**
 * Theme, motion and "show unlicensed" preferences. Signed-out visitors keep them
 * in localStorage; signed-in users get them from their account settings.
 * Settings UI (Flash, 2.10) and the filter drawer (Sol, 1.10) both use this.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RouteInput, Routes, Theme } from "@forkvlift/shared";
import { api } from "../lib/api";
import { sessionKey, useSession } from "./session";

type Motion = "system" | "on" | "off";

interface Preferences {
  theme: Theme;
  reducedMotion: Motion;
  /** Effective "prefers reduced motion" (setting or OS). */
  motionReduced: boolean;
  showUnlicensed: boolean;
  disclaimerAccepted: boolean;
  setTheme: (t: Theme) => void;
  setReducedMotion: (m: Motion) => void;
  /** Call only after the disclaimer dialog when turning on for the first time. */
  setShowUnlicensed: (on: boolean, opts?: { acceptDisclaimer?: boolean }) => Promise<void>;
}

const Ctx = createContext<Preferences | null>(null);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode); preference lasts for this page only
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [theme, setThemeState] = useState<Theme>(() => (read("fv-theme") as Theme) || "system");
  const [reducedMotion, setMotionState] = useState<Motion>(() => (read("fv-motion") as Motion) || "system");
  const [localUnlicensed, setLocalUnlicensed] = useState(() => read("fv-show-unlicensed") === "true");
  const [localAccepted, setLocalAccepted] = useState(() => read("fv-unlicensed-accepted") === "true");
  const [osReduced, setOsReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);

  // Account settings win once loaded.
  useEffect(() => {
    if (!user) return;
    setThemeState(user.settings.theme);
    setMotionState(user.settings.reducedMotion);
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    if (reducedMotion === "system") delete root.dataset.motion;
    else root.dataset.motion = reducedMotion === "on" ? "reduce" : "full";
  }, [theme, reducedMotion]);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setOsReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const saveRemote = useCallback(
    async (patch: RouteInput<Routes["updateSettings"]>["body"]) => {
      if (!user) return;
      const settings = await api.call("updateSettings", { body: patch });
      qc.setQueryData(sessionKey, { user: { ...user, settings } });
    },
    [user, qc],
  );

  const value = useMemo<Preferences>(
    () => ({
      theme,
      reducedMotion,
      motionReduced: reducedMotion === "on" || (reducedMotion === "system" && osReduced),
      showUnlicensed: user ? user.settings.showUnlicensed : localUnlicensed,
      disclaimerAccepted: user ? Boolean(user.settings.unlicensedDisclaimerAcceptedAt) : localAccepted,
      setTheme: (t) => {
        setThemeState(t);
        write("fv-theme", t);
        void saveRemote({ theme: t });
      },
      setReducedMotion: (m) => {
        setMotionState(m);
        write("fv-motion", m);
        void saveRemote({ reducedMotion: m });
      },
      setShowUnlicensed: async (on, opts) => {
        if (opts?.acceptDisclaimer) {
          setLocalAccepted(true);
          write("fv-unlicensed-accepted", "true");
        }
        setLocalUnlicensed(on);
        write("fv-show-unlicensed", String(on));
        await saveRemote({ showUnlicensed: on, acceptUnlicensedDisclaimer: opts?.acceptDisclaimer });
      },
    }),
    [theme, reducedMotion, osReduced, user, localUnlicensed, localAccepted, saveRemote],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreferences(): Preferences {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return ctx;
}
