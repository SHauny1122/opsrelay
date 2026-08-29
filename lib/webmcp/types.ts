export interface JsonSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
}

export interface WebMcpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: { readOnlyHint: boolean };
  signal?: AbortSignal;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

export interface WebMcpRegistrationHandle {
  unregister?: () => void | Promise<void>;
  dispose?: () => void | Promise<void>;
}

export interface WebMcpModelContext {
  registerTool: (tool: WebMcpToolDefinition) => WebMcpRegistrationHandle | (() => void) | void | Promise<WebMcpRegistrationHandle | (() => void) | void>;
  unregisterTool?: (name: string) => void | Promise<void>;
}

declare global {
  interface Document { modelContext?: WebMcpModelContext; }
  interface Window {
    __operationsWebMcpRegistration?: { controller: AbortController; registrationPromise: Promise<() => Promise<void>> };
  }
}

export {};
