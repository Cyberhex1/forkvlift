import { ERROR_STATUS, type ErrorCode } from "@forkvlift/shared";

export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
  get status() {
    return ERROR_STATUS[this.code];
  }
}

export const notFound = (what = "Not found") => new HttpError("not_found", what);
export const notImplemented = (task: string) => new HttpError("not_implemented", `Not built yet (task ${task})`);
