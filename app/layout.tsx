import type { Metadata } from "next";
import { OperationsProvider } from "@/components/operations-provider";
import { WebMcpBridge } from "@/components/webmcp-bridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpsRelay",
  description: "Human-guided incident recovery for agentic operations",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><OperationsProvider><WebMcpBridge />{children}</OperationsProvider></body></html>;
}
