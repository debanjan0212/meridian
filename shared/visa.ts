/**
 * Entry rules for an Indian passport that we have checked by hand.
 * Anything not listed here shows "not verified yet" rather than an AI guess:
 * fake visa sites are common, so we never link a portal we have not checked.
 */
export type VisaRule = {
  country: string
  status: string
  tone: "ok" | "warn" | "check"
  summary: string
  before: string[]
  after: string[]
  leave: string[]
  portals: { label: string; url: string }[]
  checked: string
}

export const VISA: Record<string, VisaRule> = {
  KZ: {
    country: "Kazakhstan",
    status: "Visa-free · 14 days",
    tone: "ok",
    summary: "Up to 14 days per entry, within 42 days in any 180. QazETA is a free online entry authorization: apply in the app or on qazeta.kz at least 72 hours before. Almaty and Astana airports check it from 1 Jan 2027; it becomes mandatory on 1 Jul 2027.",
    before: ["Get QazETA (free) 3+ days before and save the approval.", "Passport valid for the whole trip; airlines often ask for 6 months.", "Keep your return ticket and first hotel booking handy."],
    after: ["No self-registration for stays up to 30 days; hotels notify the migration service.", "Declare cash above about USD 10,000 per person (EAEU rule)."],
    leave: ["Leave within 14 days of each entry. Overstays bring fines and can lead to a ban."],
    portals: [{ label: "QazETA", url: "https://qazeta.kz" }],
    checked: "8 Nov 2026",
  },
  KG: {
    country: "Kyrgyzstan",
    status: "e-Visa · confirm",
    tone: "warn",
    summary: "Recent sources say Indian passport holders need an e-Visa: about USD 50 single entry, 3–5 business days. Some older sites disagree, so confirm on the official portal before you apply.",
    before: ["Apply a week ahead and print the e-Visa.", "Passport valid at least 6 months from entry, to be safe."],
    after: ["Carry the e-Visa printout with your passport.", "Declare cash above about USD 10,000 per person (EAEU rule)."],
    leave: ["Leave before the e-Visa ends; it cannot be extended."],
    portals: [{ label: "Kyrgyz e-Visa portal", url: "https://evisa.e-gov.kg" }],
    checked: "8 Nov 2026",
  },
  UZ: {
    country: "Uzbekistan",
    status: "e-Visa · 30 days",
    tone: "check",
    summary: "e-Visa on e-visa.gov.uz: about USD 20, single entry, up to 30 days, 2–3 business days. Visa-free for 30 days already if you hold a valid multiple-entry US, UK, Schengen, Canada, Australia, Japan, New Zealand or South Korea visa and an onward ticket. Visa-free entry for all Indians was announced in Aug 2026 with no start date yet.",
    before: ["e-Visa 3+ business days before; print it.", "Carry prescriptions for any medicines; some are restricted."],
    after: ["Registration within 3 working days; hotels do it. Keep every slip.", "Declare cash above the equivalent of 100 million sum; keep the copy."],
    leave: ["Have registration slips and any cash declaration ready at exit."],
    portals: [{ label: "Uzbekistan e-Visa", url: "https://e-visa.gov.uz" }],
    checked: "8 Nov 2026",
  },
}

export const visaFor = (countryCode: string): VisaRule | null => VISA[countryCode.toUpperCase()] ?? null
