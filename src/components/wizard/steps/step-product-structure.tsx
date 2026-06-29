"use client";

import { WizardData } from "../blueprint-wizard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONETISATION = ["Free", "Freemium", "Subscription (monthly)", "Subscription (annual)", "One-time payment", "Pay-per-use", "Marketplace commission", "None"];
const NOTIFICATIONS = ["Email only", "Email + In-app", "Email + Push", "Email + SMS", "None"];

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepProductStructure({ data, update, onBack, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Product Structure</h2>
        <p className="text-muted-foreground text-sm">Define roles, features, and key product decisions.</p>
      </div>

      <div className="grid gap-5">
        <div className="space-y-2">
          <Label htmlFor="userRoles">User Roles</Label>
          <Input
            id="userRoles"
            placeholder="e.g. Student, Teacher, Admin, Parent"
            value={data.userRoles}
            onChange={(e) => update({ userRoles: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Comma-separated list of all user roles in your app.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mainFeatures">Core Features</Label>
          <Textarea
            id="mainFeatures"
            placeholder="List the main features users will have. e.g. Create study plans, Track progress, Take quizzes, Join study groups"
            rows={4}
            value={data.mainFeatures}
            onChange={(e) => update({ mainFeatures: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="adminFeatures">Admin Features</Label>
          <Textarea
            id="adminFeatures"
            placeholder="What can admins do? e.g. Manage users, View analytics, Send announcements"
            rows={3}
            value={data.adminFeatures}
            onChange={(e) => update({ adminFeatures: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Monetisation Model</Label>
            <Select value={data.monetisationModel} onValueChange={(v) => v && update({ monetisationModel: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MONETISATION.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notification Needs</Label>
            <Select value={data.notificationNeeds} onValueChange={(v) => v && update({ notificationNeeds: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select notifications" />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATIONS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="integrationNeeds">Third-party Integrations</Label>
          <Input
            id="integrationNeeds"
            placeholder="e.g. Google Calendar, Slack, Zapier, OpenAI"
            value={data.integrationNeeds}
            onChange={(e) => update({ integrationNeeds: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between border border-border rounded-lg p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Multi-tenancy</p>
              <p className="text-xs text-muted-foreground">Support organisations / workspaces</p>
            </div>
            <Switch
              checked={data.multiTenancy}
              onCheckedChange={(v) => update({ multiTenancy: v })}
            />
          </div>
          <div className="flex items-center justify-between border border-border rounded-lg p-4">
            <div>
              <p className="text-sm font-medium text-foreground">File Uploads</p>
              <p className="text-xs text-muted-foreground">Users can upload files</p>
            </div>
            <Switch
              checked={data.fileUpload}
              onCheckedChange={(v) => update({ fileUpload: v })}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={onNext}>Next: Security Level →</Button>
      </div>
    </div>
  );
}
