// Static, reviewed list of lenders shown on /tools/loans. HomeNest only links
// to each lender's own public product page: it holds no partnership, API or
// credentials with any of them, and shows no rates, fees or offers (none were
// verified). Every entry needs: stable id, name, loanType, a factual
// description taken from the page itself, an official HTTPS applyUrl, the
// sourceUrl the description came from, and the date it was last checked.
//
// IDs are mirrored in backend/src/utils/loanEnquiryValidation.js (KNOWN_LENDERS);
// lenders.test.mjs fails if the two lists drift apart.

export const LENDERS_VERIFIED_AS_OF = "2026-10-15";

export const LENDERS = [
  {
    id: "icici-home-loan",
    name: "ICICI Bank",
    loanType: "home",
    description:
      "Home loan product page covering how to apply online, eligibility, features and required documents.",
    applyUrl: "https://www.icici.bank.in/personal-banking/loans/home-loan",
    sourceUrl: "https://www.icici.bank.in/personal-banking/loans/home-loan",
    verifiedAt: "2026-10-15",
  },
  {
    id: "hdfc-home-loan",
    name: "HDFC Bank",
    loanType: "home",
    description:
      "Home loan page covering eligibility, documents, fees, the online application process, repayment options and EMI calculators.",
    applyUrl: "https://homeloans.hdfc.bank.in/housing-loans/home-loans",
    sourceUrl: "https://homeloans.hdfc.bank.in/housing-loans/home-loans",
    verifiedAt: "2026-10-15",
  },
  {
    id: "sbi-home-loan",
    name: "State Bank of India",
    loanType: "home",
    description: "SBI Home Loan site with product information, calculators, FAQs and application services.",
    applyUrl: "https://homeloans.sbi.bank.in",
    sourceUrl: "https://homeloans.sbi.bank.in",
    verifiedAt: "2026-10-15",
  },
  {
    id: "icici-personal-loan",
    name: "ICICI Bank",
    loanType: "personal",
    description:
      "Collateral-free personal loans that can be applied for online; the page covers eligibility, documents and application steps.",
    applyUrl: "https://www.icici.bank.in/personal-banking/loans/personal-loan",
    sourceUrl: "https://www.icici.bank.in/personal-banking/loans/personal-loan",
    verifiedAt: "2026-10-15",
  },
  {
    id: "hdfc-personal-loan",
    name: "HDFC Bank",
    loanType: "personal",
    description: "Personal loan page with an online application form, a personal loan calculator and related loan products.",
    applyUrl: "https://www.hdfc.bank.in/personal-loan",
    sourceUrl: "https://www.hdfc.bank.in/personal-loan",
    verifiedAt: "2026-10-15",
  },
  {
    id: "sbi-personal-loan",
    name: "State Bank of India",
    loanType: "personal",
    description:
      "Personal loan options including a loan for salaried customers with an SBI salary account, pre-approved loans and a digital loan through the YONO app.",
    applyUrl: "https://sbi.bank.in/web/personal-banking/loans/personal-loans",
    sourceUrl: "https://sbi.bank.in/web/personal-banking/loans/personal-loans",
    verifiedAt: "2026-10-15",
  },
];

export function lendersForType(loanType) {
  return LENDERS.filter((lender) => lender.loanType === loanType);
}

// Only verified, well-formed https links may be rendered as external anchors.
export function isSafeLenderUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function formatVerifiedDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
