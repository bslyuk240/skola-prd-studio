import { FeatureWizard } from "@/components/feature/feature-wizard";

export default function NewFeaturePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Plan a New Feature</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Connect your existing project and describe the feature you want to add.
        </p>
      </div>
      <FeatureWizard />
    </div>
  );
}
