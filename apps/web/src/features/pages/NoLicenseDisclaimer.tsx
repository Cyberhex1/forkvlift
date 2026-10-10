import { NO_LICENSE_DISCLAIMER } from "@forkvlift/shared";
import { Badge, Button, Modal } from "@forkvlift/ui";
import { Link } from "react-router";

export interface NoLicenseBannerProps {
  /** Optional extra styling class name. */
  className?: string;
  /** Optional GitHub repo URL to generate an "Ask author on GitHub" issue link. */
  repoUrl?: string;
}

/**
 * Shared panel banner for unlicensed projects (task 1.9 focus panel).
 * Displays the exact NO_LICENSE_DISCLAIMER text as required by product guidelines.
 */
export function NoLicenseBanner({ className, repoUrl }: NoLicenseBannerProps) {
  const askLicenseIssueUrl = repoUrl
    ? `${repoUrl.replace(/\/+$/, "")}/issues/new?title=${encodeURIComponent("Please consider adding an open source license")}&body=${encodeURIComponent(
        `Hi! I discovered this project on ForkLift and would love to build on it or contribute. Would you consider adding an open source license (such as MIT or Apache-2.0)?\n\nThanks!`
      )}`
    : undefined;

  return (
    <div
      role="region"
      aria-label="License notice"
      className={`rounded-card border border-license-none/40 bg-surface-2 p-4 text-fg shadow-sm ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="license-none">No license</Badge>
        <span className="font-display text-sm font-semibold text-fg">
          {NO_LICENSE_DISCLAIMER.title}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        {NO_LICENSE_DISCLAIMER.body}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <Link
          to="/licensing"
          className="font-medium text-accent hover:underline focus:outline-none focus:ring-1 focus:ring-focus"
        >
          Read Licensing 101 →
        </Link>
        {askLicenseIssueUrl ? (
          <a
            href={askLicenseIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-muted hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
          >
            Ask author to add a license on GitHub ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

export interface NoLicenseDisclaimerModalProps {
  open: boolean;
  onClose: () => void;
  /** Callback fired when user clicks "I understand" to accept the disclaimer. */
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Shared disclaimer dialog shown when enabling "Show unlicensed projects"
 * for the first time (task 1.10 filter drawer and settings).
 */
export function NoLicenseDisclaimerModal({
  open,
  onClose,
  onConfirm,
  confirmLabel = "I understand, show them",
  cancelLabel = "Keep hidden",
}: NoLicenseDisclaimerModalProps) {
  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={NO_LICENSE_DISCLAIMER.title}
      className="max-w-lg"
    >
      <div className="mt-3 space-y-4">
        <div>
          <Badge tone="license-none">No license</Badge>
        </div>

        <p className="text-sm leading-relaxed text-muted sm:text-base">
          {NO_LICENSE_DISCLAIMER.body}
        </p>

        <p className="text-xs text-muted">
          Unlicensed projects are hidden by default to keep you safe from copyright infringement.
          You can toggle this off at any time in Settings or the filter drawer.{" "}
          <Link
            to="/licensing"
            onClick={onClose}
            className="text-accent underline hover:text-fg focus:outline-none focus:ring-1 focus:ring-focus"
          >
            Learn more in Licensing 101
          </Link>
          .
        </p>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="md" onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
