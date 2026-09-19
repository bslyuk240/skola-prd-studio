import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { oauthClients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FileText, GitBranch, Shield } from "lucide-react";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <p className="text-sm font-semibold text-destructive">Authorization request failed</p>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function OAuthAuthorizePage({ searchParams }: Props) {
  const params = await searchParams;
  const { userId } = await auth();

  const responseType = str(params.response_type);
  const clientId = str(params.client_id);
  const redirectUri = str(params.redirect_uri);
  const state = str(params.state);
  const codeChallenge = str(params.code_challenge);
  const codeChallengeMethod = str(params.code_challenge_method);
  const scope = str(params.scope);

  if (!userId) {
    return <ErrorCard message="You must be signed in to approve this connection." />;
  }
  if (responseType !== "code" || !clientId || !redirectUri || !codeChallenge) {
    return <ErrorCard message="This authorization request is missing required parameters." />;
  }
  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return <ErrorCard message="Unsupported PKCE method — only S256 is supported." />;
  }

  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId)).limit(1);
  if (!client) {
    return <ErrorCard message="Unknown client. This connector may not be registered." />;
  }
  const redirectUris = (client.redirectUris as string[]) ?? [];
  if (!redirectUris.includes(redirectUri)) {
    return <ErrorCard message="This client's redirect URL doesn't match what was registered." />;
  }

  let redirectHost: string;
  try {
    redirectHost = new URL(redirectUri).host;
  } catch {
    return <ErrorCard message="This client's redirect URL is malformed." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-base font-semibold">{client.clientName || "MCP Client"} wants to connect</CardTitle>
          <CardDescription className="text-xs">to your SkolaTech PRD Studio account</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-5">
          {/* The name above is self-reported at registration and not verified —
              the redirect destination below is the one thing we can actually
              guarantee, so surface it plainly as the real signal to check. */}
          <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              After you approve, you&apos;ll be sent back to
            </p>
            <p className="text-sm font-mono font-medium text-foreground break-all mt-0.5">
              {redirectHost}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground uppercase tracking-wide">This will allow it to:</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4 mt-0.5 shrink-0" /> Create projects and generate PRD/TRD documents
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <GitBranch className="w-4 h-4 mt-0.5 shrink-0" /> Add features to your existing projects
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 mt-0.5 shrink-0" /> Run security scans on your behalf
              </li>
            </ul>
          </div>
          <form method="POST" action="/api/oauth/authorize" className="flex gap-2">
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state ?? ""} />
            <input type="hidden" name="code_challenge" value={codeChallenge} />
            <input type="hidden" name="scope" value={scope ?? ""} />
            <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
              Deny
            </Button>
            <Button type="submit" name="decision" value="allow" className="flex-1">
              Allow
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
