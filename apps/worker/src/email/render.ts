/** Email rendering: thin adapters over the templates (task 2.13). */
import type { NotificationType } from "@forkvlift/shared";
import { magicLinkEmail, notificationEmail, weeklyDigest } from "./templates";
import type { OutgoingEmail } from "./send";

export interface NotificationEmailData {
  type: NotificationType;
  title: string;
  /** Absolute URL to the thing the notification is about. */
  url: string;
  settingsUrl: string;
}

export interface DigestItem {
  title: string;
  url: string;
}

export function renderNotification(d: NotificationEmailData): Omit<OutgoingEmail, "to"> {
  return notificationEmail(d);
}

export function renderDigest(items: DigestItem[], settingsUrl: string): Omit<OutgoingEmail, "to"> {
  return weeklyDigest(items, settingsUrl);
}

export function renderMagicLink(url: string): Omit<OutgoingEmail, "to"> {
  return magicLinkEmail(url, url.replace(/\/api\/.*$/, "/settings"));
}
