import { notFound } from "next/navigation";
import { WebMcpDebugPanel } from "@/components/webmcp-debug-panel";

export default function WebMcpDebugPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <WebMcpDebugPanel />;
}
