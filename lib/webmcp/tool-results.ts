export function jsonToolResult(data: unknown) {
  return JSON.stringify({ ok: true, data });
}

export function jsonToolError(error: unknown) {
  return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown tool error." });
}

export function toolExecutor(handler: (input: Record<string, unknown>) => unknown) {
  return async (input: Record<string, unknown>) => {
    try { return jsonToolResult(handler(input ?? {})); }
    catch (error) { return jsonToolError(error); }
  };
}
