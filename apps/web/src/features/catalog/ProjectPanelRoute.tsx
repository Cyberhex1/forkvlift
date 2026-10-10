import { useParams } from "react-router";

/** Focus panel for /p/:slug (task 1.9). */
export function ProjectPanelRoute() {
  const { slug } = useParams();
  return <p className="sr-only">Project {slug}</p>;
}
