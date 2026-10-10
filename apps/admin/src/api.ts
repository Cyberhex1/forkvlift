import { createApiClient } from "@forkvlift/shared";
export const api = createApiClient({ validateResponses: import.meta.env.DEV });
