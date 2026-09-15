import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/reset-password")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
