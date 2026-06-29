"use client";

import { WizardData } from "../blueprint-wizard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["SaaS", "Marketplace", "AI App", "Admin Portal", "Mobile App", "Dashboard", "E-Commerce", "Social Platform", "EdTech", "FinTech", "HealthTech", "Other"];

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
  onNext: () => void;
}

export function StepAppIdentity({ data, update, onNext }: Props) {
  const canProceed = data.appName.trim() && data.shortDescription.trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">App Identity</h2>
        <p className="text-muted-foreground text-sm">Tell us about your app idea. Be as specific as possible.</p>
      </div>

      <div className="grid gap-5">
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="appName">App Name <span className="text-destructive">*</span></Label>
            <Input
              id="appName"
              placeholder="e.g. StudyBuddy"
              value={data.appName}
              onChange={(e) => update({ appName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="appCategory">App Category</Label>
            <Select value={data.appCategory} onValueChange={(v) => v && update({ appCategory: v })}>
              <SelectTrigger id="appCategory">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="shortDescription">Short Description <span className="text-destructive">*</span></Label>
          <Input
            id="shortDescription"
            placeholder="One sentence: what does your app do?"
            value={data.shortDescription}
            onChange={(e) => update({ shortDescription: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="longDescription">Detailed Description</Label>
          <Textarea
            id="longDescription"
            placeholder="Describe your app in detail. Include key features, how it works, and what makes it unique."
            rows={4}
            value={data.longDescription}
            onChange={(e) => update({ longDescription: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="targetUsers">Target Users</Label>
            <Input
              id="targetUsers"
              placeholder="e.g. Students, Teachers, Admins"
              value={data.targetUsers}
              onChange={(e) => update({ targetUsers: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mainGoal">Main Goal</Label>
            <Input
              id="mainGoal"
              placeholder="e.g. Help students organise study plans"
              value={data.mainGoal}
              onChange={(e) => update({ mainGoal: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="problemSolved">Problem Being Solved</Label>
          <Textarea
            id="problemSolved"
            placeholder="What specific problem does your app solve? Who suffers from this problem today?"
            rows={3}
            value={data.problemSolved}
            onChange={(e) => update({ problemSolved: e.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!canProceed}>
          Next: Stack Choices →
        </Button>
      </div>
    </div>
  );
}
