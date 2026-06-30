import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight, Layers, Shield, Bot, FileText } from "lucide-react";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-sidebar flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <Image src="/prd-logo.png" alt="SkolaTech PRD Studio" width={32} height={32} className="rounded-lg" />
          <span className="text-sidebar-foreground font-bold text-lg">SkolaTech PRD Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="text-sidebar-foreground/70 hover:text-sidebar-foreground text-sm font-medium transition-colors">
            Sign In
          </Link>
          <Link href="/sign-up" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-sidebar-accent text-sidebar-foreground/70 border border-sidebar-border px-3 py-1.5 rounded-full text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
          AI Command Centre for Product Blueprinting
        </div>
        <h1 className="text-4xl font-bold text-sidebar-foreground leading-snug max-w-3xl mb-5">
          Describe your app once. Get the complete build blueprint.
        </h1>
        <p className="text-sidebar-foreground/60 text-base max-w-xl mb-10 leading-relaxed">
          PRD, technical requirements, backend schema, UI/UX brief, security checklist, and implementation plan — structured, AI-generated, and ready for developers or AI agents.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/sign-up" className="flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-xl text-base font-semibold hover:opacity-90 transition-opacity">
            Start Building <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/sign-in" className="text-sidebar-foreground/70 hover:text-sidebar-foreground text-base font-medium transition-colors">
            Sign in →
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 max-w-4xl w-full">
          {[
            { icon: FileText, title: "7 Documents", desc: "PRD, TRD, App Flow, UI/UX, Schema, Plan, Security" },
            { icon: Shield, title: "Security First", desc: "Every project gets a Security Blueprint by default" },
            { icon: Bot, title: "Agent Ready", desc: "Tasks prepared for Cursor, Windsurf, Claude Code" },
            { icon: Layers, title: "Readiness Scores", desc: "Blueprint, Security, and Agent readiness metrics" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-sidebar-accent/50 border border-sidebar-border rounded-xl p-5 text-left">
              <div className="w-9 h-9 rounded-lg bg-brand/20 flex items-center justify-center mb-3">
                <Icon className="w-4.5 h-4.5 text-brand" />
              </div>
              <p className="text-sidebar-foreground font-semibold text-sm mb-1">{title}</p>
              <p className="text-sidebar-foreground/50 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
