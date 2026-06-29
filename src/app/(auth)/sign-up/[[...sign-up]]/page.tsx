import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="text-sidebar-foreground/60 text-sm font-medium tracking-widest uppercase mb-2">SkolaTech</p>
          <h1 className="text-2xl font-bold text-sidebar-foreground">PRD Studio</h1>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
