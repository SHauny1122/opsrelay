# OpsRelay

**Human-guided incident recovery for agentic operations**

OpsRelay is a deterministic manufacturing incident-response dashboard. It connects customer orders, inventory, suppliers, purchase orders, production jobs and incidents so an external WebMCP agent can investigate a disruption, propose a recovery and execute it only after explicit human approval.

The fully simulated incident is a 48-hour delay from Northstar Metals for Aluminium 6061 Sheet. The delay creates a 1,340 kg shortage, blocks tomorrow's production schedule, puts three customer orders and R423,000 of revenue at risk, and gives the agent several supplier alternatives with meaningful cost, speed, capacity and reliability trade-offs.

## Why WebMCP

Recovery requires reasoning across operational data, not a single dashboard lookup. WebMCP gives an agent structured, page-provided tools for inspecting the incident, comparing supplier options, simulating consequences and applying an approved plan against the same browser-local state shown in the UI. This avoids scraping the interface and keeps every proposed or executed action visible to the operator.

No OpenAI API, AI SDK or embedded AI model runs inside this application. The agent is supplied by the user's WebMCP-capable browser or client.

## WebMCP tools

The application registers exactly nine tools through `document.modelContext.registerTool`:

- `get_current_incident`
- `get_inventory`
- `get_at_risk_orders`
- `search_supplier_options`
- `compare_supplier_options`
- `simulate_recovery_plan`
- `request_recovery_approval`
- `execute_recovery_plan`
- `get_recovery_status`

All tools call the same typed operational runtime as the UI. `simulate_recovery_plan` stores a proposal and workflow activity, so it has `readOnlyHint: false`, but it does not change inventory, orders, production or purchasing. Operational state changes only when an approved plan is executed.

## Human approval trust boundary

**Human approval is intentionally not exposed as a WebMCP tool. An agent can propose and request approval but cannot grant approval to itself.**

The intended workflow is:

```text
investigate → compare → simulate → request approval → human approves in UI → execute → verify
```

The dashboard is the only surface that can approve or reject a proposal. Approval records `approvedBy: "human"` and an ISO `approvedAt` timestamp. Execution is rejected unless the plan belongs to the active incident, has explicit unrevoked human approval, has not been rejected and has not already executed.

## Agent workflow

1. Inspect the active incident, affected inventory and at-risk orders.
2. Search and compare qualified suppliers against the 1,340 kg shortage and production deadline.
3. Simulate a recovery plan and review its costs, protected orders and schedule changes.
4. Request human approval using the returned recovery plan ID.
5. A human approves or rejects the plan in the dashboard UI.
6. After approval, the agent discovers the approval through `get_recovery_status` and calls `execute_recovery_plan`.
7. The agent verifies the purchase order, incoming inventory, production schedule, orders and incident status.

Use **Reset Demo** to restore the exact original incident and seeded operational state.

## Tech stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Imperative WebMCP browser API
- Browser-local deterministic state with no authentication, database or paid APIs
- Vercel-compatible static application shell

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Available validation commands:

```bash
npm run lint
npm run typecheck
npm run build
```

## Test WebMCP

1. Run the app locally or deploy it to an HTTPS URL.
2. Open it in a browser/client that supports the imperative `document.modelContext` WebMCP API.
3. Confirm the sidebar reports **WebMCP Ready**.
4. Ask the external agent to investigate the Northstar Metals incident, compare alternatives and simulate a recovery plan.
5. Ask the agent to request approval, then approve or reject the proposal yourself in the dashboard.
6. If approved, ask the agent to execute the plan and verify the result.

During development, `http://localhost:3000/debug/webmcp` lists the nine registered tool names and provides clearly labelled local test actions, including **Simulate human approval**. It is not a WebMCP approval tool. The route deliberately returns 404 in production.

### Browser requirements

The browser must expose `document.modelContext.registerTool`. WebMCP availability depends on the browser/client rollout. Unsupported browsers show **WebMCP Unavailable** while the dashboard remains usable. For local Chrome experiments, use a build that explicitly supports the imperative WebMCP API and verify in DevTools:

```js
typeof document.modelContext?.registerTool === "function"
```

## Deterministic data and limitations

Application state is deterministic, in-memory and browser-local. It is not persisted to an external database and **Reset Demo** always restores the same seeded scenario.

- The 48-hour supplier delivery delay is the fully implemented end-to-end simulation.
- Unexpected demand spike and production machine downtime are secondary seeded demo scenarios and are not yet fully simulated.
- The application does not contact suppliers, place real orders or connect to a live ERP/MRP system.

## License

MIT License. See [LICENSE](./LICENSE).
