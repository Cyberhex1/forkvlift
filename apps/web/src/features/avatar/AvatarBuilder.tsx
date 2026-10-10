/** Task 3.11: build your 16-bit Plaza avatar (hair, outfit, color, accessory, skin). */
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AvatarConfig } from "@forkvlift/shared";
import { AVATAR_PARTS, Button, DEFAULT_AVATAR, PixelAvatar, Spinner, StateMessage, buttonClasses, cn, fallbackLook, parseHair, useToast, type AvatarLook } from "@forkvlift/ui";
import { PageShell } from "../../app/kit";
import { sessionKey, signInUrl, useSession } from "../../app/session";
import { api } from "../../lib/api";

const label = (s: string) => s.replace(/^pixel-/, "Color ").replace(/^skin-/, "Tone ").replace(/^\w/, (c) => c.toUpperCase());

export function AvatarBuilderPage() {
  const { user, isLoading } = useSession();
  if (isLoading) return <Spinner label="Loading" className="m-8" />;
  if (!user) return <StateMessage title="Sign in to build your avatar" action={<a className={buttonClasses()} href={signInUrl()}>Sign in with GitHub</a>} />;
  return (
    <PageShell title="Your Plaza avatar">
      <AvatarBuilder initial={user.avatar ?? (fallbackLook(user.displayName) as AvatarConfig)} name={user.displayName} />
    </PageShell>
  );
}

export function AvatarBuilder({ initial, name }: { initial: AvatarConfig; name: string }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const [look, setLook] = useState<AvatarLook>({ ...DEFAULT_AVATAR, ...initial, skin: initial.skin ?? DEFAULT_AVATAR.skin });
  const hair = parseHair(look.hair);
  const setHair = (style: string, tone: string) => setLook((l) => ({ ...l, hair: style === "bald" ? "bald" : `${style}-${tone}` }));
  const save = useMutation({
    mutationFn: () => api.call("updateAvatar", { body: { hair: look.hair, outfit: look.outfit, color: look.color, accessory: look.accessory, skin: look.skin } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sessionKey });
      show("Avatar saved. See you in the Plaza.", { tone: "success" });
    },
    onError: (e) => show(e.message, { tone: "danger" }),
  });
  const random = () => setLook(fallbackLook(String(Math.random())));

  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
      <div className="flex flex-col items-center gap-3">
        <div className="grid size-56 place-items-center rounded-card border border-border bg-surface-2 bg-[linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] bg-[size:14px_14px]">
          <PixelAvatar look={look} name={`${name}'s avatar preview`} size={192} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={random}>Shuffle</Button>
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </div>
        <Link to="/plaza" className="text-sm text-muted hover:underline">Go to the Plaza</Link>
      </div>

      <div className="space-y-5">
        <Group title="Skin">
          {AVATAR_PARTS.skin.map((s) => (
            <Swatch key={s} selected={look.skin === s} onClick={() => setLook((l) => ({ ...l, skin: s }))} label={label(s)} color={`var(--color-${s})`} />
          ))}
        </Group>
        <Group title="Hair">
          {AVATAR_PARTS.hairStyles.map((s) => (
            <Option key={s} selected={hair.style === s || (s === "bald" && look.hair === "bald")} onClick={() => setHair(s, hair.tone)} label={label(s)}>
              <PixelAvatar look={{ ...look, hair: s === "bald" ? "bald" : `${s}-${hair.tone}`, accessory: null }} name={s} size={40} headOnly decorative />
            </Option>
          ))}
        </Group>
        {look.hair !== "bald" ? (
          <Group title="Hair color">
            {AVATAR_PARTS.hairTones.map((t) => (
              <Swatch key={t} selected={hair.tone === t} onClick={() => setHair(hair.style, t)} label={label(t)} color={`var(--color-hair-${t})`} />
            ))}
          </Group>
        ) : null}
        <Group title="Outfit">
          {AVATAR_PARTS.outfit.map((o) => (
            <Option key={o} selected={look.outfit === o} onClick={() => setLook((l) => ({ ...l, outfit: o }))} label={label(o)}>
              <PixelAvatar look={{ ...look, outfit: o }} name={o} size={40} decorative />
            </Option>
          ))}
        </Group>
        <Group title="Outfit color">
          {AVATAR_PARTS.color.map((c) => (
            <Swatch key={c} selected={look.color === c} onClick={() => setLook((l) => ({ ...l, color: c }))} label={label(c)} color={`var(--color-${c})`} />
          ))}
        </Group>
        <Group title="Accessory">
          {AVATAR_PARTS.accessory.map((a) => (
            <Option key={a ?? "none"} selected={look.accessory === a} onClick={() => setLook((l) => ({ ...l, accessory: a }))} label={a ? label(a) : "None"}>
              <PixelAvatar look={{ ...look, accessory: a }} name={a ?? "none"} size={40} headOnly decorative />
            </Option>
          ))}
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Option({ selected, onClick, label: text, children }: { selected: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} title={text} className={cn("flex flex-col items-center gap-1 rounded-pixel border p-1.5 text-[10px]", selected ? "border-accent bg-surface-2 ring-2 ring-accent" : "border-border bg-surface hover:bg-surface-2")}>
      {children}
      <span>{text}</span>
    </button>
  );
}

function Swatch({ selected, onClick, label: text, color }: { selected: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button type="button" aria-pressed={selected} aria-label={text} title={text} onClick={onClick} className={cn("size-9 rounded-pixel border-2", selected ? "border-fg ring-2 ring-accent" : "border-border")} style={{ background: color }} />
  );
}
