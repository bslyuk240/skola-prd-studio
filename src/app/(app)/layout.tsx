import { Sidebar } from "@/components/layout/sidebar";
import { MainScrollReset } from "@/components/layout/main-scroll-reset";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-60 h-screen min-w-0 overflow-y-auto overflow-x-hidden">
        <MainScrollReset />
        {children}
      </main>
    </div>
  );
}
