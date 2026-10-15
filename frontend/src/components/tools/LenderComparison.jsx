import { LENDERS_VERIFIED_AS_OF, formatVerifiedDate, isSafeLenderUrl, lendersForType } from "@/lib/lenders.mjs";

const SECTIONS = [
  { type: "home", id: "home-loan-lenders", title: "Home loan lenders" },
  { type: "personal", id: "personal-loan-lenders", title: "Personal loan lenders" },
];

export function LenderComparison() {
  return (
    <div className="flex flex-col gap-10">
      {SECTIONS.map((section) => (
        <section key={section.type} aria-labelledby={section.id}>
          <h3 id={section.id} className="text-xl font-semibold tracking-tight">
            {section.title}
          </h3>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {lendersForType(section.type).map((lender) => (
              <li key={lender.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
                <p className="text-lg font-semibold">{lender.name}</p>
                <p className="text-sm text-text-muted">{lender.description}</p>
                <p className="text-xs text-text-muted">
                  Checked on {formatVerifiedDate(lender.verifiedAt)}. Source:{" "}
                  {isSafeLenderUrl(lender.sourceUrl) ? (
                    <a
                      href={lender.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-primary"
                    >
                      lender&apos;s page
                    </a>
                  ) : (
                    "lender's page"
                  )}
                </p>
                {isSafeLenderUrl(lender.applyUrl) ? (
                  <a
                    href={lender.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center justify-center rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
                  >
                    Visit {lender.name} (opens in a new tab)
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-text-muted">
        Information as of {formatVerifiedDate(LENDERS_VERIFIED_AS_OF)}, taken from each lender&apos;s public website.
        Listing a lender here does not imply a partnership or endorsement, and HomeNest shows no interest rates, fees or offers here. Rates,
        eligibility and terms change; confirm everything directly with the lender.
      </p>
    </div>
  );
}
