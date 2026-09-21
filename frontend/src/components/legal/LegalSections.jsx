export function LegalSections({ sections }) {
  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-text-muted">
            {section.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
