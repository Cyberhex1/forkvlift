import { createApiClient } from "@forkvlift/shared";

/** Typed API client. `api.call("getProject", { params: { slug } })` */
export const api = createApiClient({ validateResponses: import.meta.env.DEV });
