import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-60 min-h-screen min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
