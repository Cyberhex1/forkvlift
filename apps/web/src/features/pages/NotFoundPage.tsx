import { Link } from "react-router";
import { buttonClasses, StateMessage } from "@forkvlift/ui";

/** 404 (task 1.17 owns the final design). */
export function NotFoundPage() {
  return (
    <StateMessage title="404: nothing to fork here" action={<Link to="/" className={buttonClasses("secondary")}>Back to the feed</Link>}>
      That page doesn't exist, or it moved.
    </StateMessage>
  );
}
