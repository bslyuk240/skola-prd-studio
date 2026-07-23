"use client";

type SectionLink = {
  title: string;
  id: string;
};

type LearningHubSectionNavProps = {
  sections: SectionLink[];
};

export function LearningHubSectionNav({ sections }: LearningHubSectionNavProps) {
  function scrollToSection(id: string) {
    const target = document.getElementById(id);
    if (!target) return;

    window.history.replaceState(null, "", `#${id}`);
    target.scrollIntoView({ block: "start" });
  }

  return (
    <nav className="space-y-1 lg:sticky lg:top-8 lg:self-start">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => scrollToSection(section.id)}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {section.title}
        </button>
      ))}
    </nav>
  );
}
