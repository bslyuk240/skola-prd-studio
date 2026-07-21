import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourceIngestionForm } from "@/components/eie/source-ingestion-form";

export default function EieIngestPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Ingest Source</CardTitle>
      </CardHeader>
      <CardContent>
        <SourceIngestionForm />
      </CardContent>
    </Card>
  );
}
