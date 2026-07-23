"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function scrollMainToTarget() {
  const main = document.querySelector("main");
  if (!main) return;

  const hash = window.location.hash.slice(1);
  if (hash) {
    const target = document.getElementById(hash);
    if (target) {
      target.scrollIntoView({ block: "start" });
      return;
    }
  }

  main.scrollTo({ top: 0, left: 0 });
}

export function MainScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    scrollMainToTarget();

    const onHashChange = () => scrollMainToTarget();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);

  return null;
}
