import { LearningHubCatalog } from "@/components/eie/learning-hub-catalog";

export default function LearningHubPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Learning Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse curated engineering concepts, patterns, and implementation guides
        </p>
      </div>
      <LearningHubCatalog />
    </div>
  );
}
