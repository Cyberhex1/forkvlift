import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { buttonClasses, StateMessage } from "@forkvlift/ui";

export function RouteError() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : "Something broke";
  if (import.meta.env.DEV) console.error(error);
  return (
    <StateMessage title={title} tone="danger" action={<Link to="/" className={buttonClasses("secondary")}>Back to the feed</Link>}>
      Try reloading the page. If it keeps happening, let us know in the forum.
    </StateMessage>
  );
}
