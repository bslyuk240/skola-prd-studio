import { ConnectionsClient } from "@/components/admin/connections-client";
import { getEnvConnectionStatus } from "@/lib/env-status";

export default function EieConnectionsPage() {
  const status = getEnvConnectionStatus();

  return <ConnectionsClient status={status} />;
}
