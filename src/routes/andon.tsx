import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/andon")({
  beforeLoad: () => {
    throw redirect({
      to: "/web",
    });
  },
  component: () => null,
});
