// What the voice says, and where the words come from (#29, #3).
//
// Every figure spoken aloud is read from a ScoredOffer the clearing engine
// already produced. Nothing here computes anything, and no language model
// writes a number into a sentence — the same rule the rest of the system runs
// on, applied to audio because a spoken figure is no less a claim than a
// printed one.
//
// The scripts are deliberately plain. Text-to-speech makes long sentences and
// nested clauses hard to follow, and a listener cannot re-read.

import type { ScoredOffer } from "@/lib/market/types";

/** Paise -> "9,34,188.36", Indian digit grouping. */
function rupees(paise: number): string {
  const s = (Math.abs(paise) / 100).toFixed(2);
  const [whole, frac] = s.split(".");
  // Indian grouping: last three digits, then pairs.
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `${grouped}.${frac}`;
}

/** Basis points -> "13.73 percent". Spoken, so the word rather than the symbol. */
function percent(bps: number): string {
  return `${(bps / 100).toFixed(2)} percent`;
}

/** "T+0" -> "the same day"; a listener parses words faster than notation. */
function settlement(days: number): string {
  if (days === 0) return "the same day";
  if (days === 1) return "the next day";
  return `in ${days} days`;
}

/**
 * Explain one offer aloud.
 *
 * Leads with cash and speed rather than the headline rate, because that
 * ordering is the whole argument: what reaches the account and when decides
 * whether an offer solves the problem, and the rate only ranks what survives.
 */
export function offerScript(offer: ScoredOffer): string {
  const parts: string[] = [];

  parts.push(
    `${offer.providerName}. ` +
      `This offer puts ${rupees(offer.netCashPaise)} rupees in the account, ` +
      `landing ${settlement(offer.offer.settlementDays)}.`,
  );

  parts.push(
    `The headline rate is ${percent(offer.offer.annualRateBps)}, ` +
      `but the true cost is ${percent(offer.effectiveCostBps)} ` +
      `once the ${(offer.offer.advanceRateBps / 100).toFixed(0)} percent advance rate ` +
      `and the fees are counted.`,
  );

  if (offer.disqualified) {
    parts.push("This offer is disqualified.");
    if (!offer.gates.sufficiency.passed) parts.push(offer.gates.sufficiency.reason + ".");
    if (!offer.gates.timing.passed) parts.push(offer.gates.timing.reason + ".");
  } else if (offer.rank === 1) {
    parts.push(
      "This is the best available offer. It clears both the sufficiency floor and the timing deadline, " +
        "and it has the lowest true cost of the offers that clear them.",
    );
  } else {
    parts.push(
      `It clears both gates, and ranks number ${offer.rank} on true cost among the offers that do.`,
    );
  }

  return parts.join(" ");
}

/**
 * The line an outbound verification call would say.
 *
 * Labelled as a simulation in the words themselves. A recorded voice that
 * implies a real call was placed to a real buyer would be a lie told in audio,
 * and the market is simulated — so the call says so.
 */
export function verificationCallScript(input: {
  buyerName: string;
  invoiceNumber: string;
  faceValueRupees: string;
}): { speaker: "agent" | "buyer"; text: string }[] {
  return [
    {
      speaker: "agent",
      text:
        `Good afternoon. This is an automated verification call from LienRho, ` +
        `regarding invoice ${input.invoiceNumber.replace(/-/g, " ")}. ` +
        `This is a simulated call for demonstration.`,
    },
    {
      speaker: "buyer",
      text: `Yes, this is accounts payable at ${input.buyerName}. Go ahead.`,
    },
    {
      speaker: "agent",
      text:
        `I am confirming a payable of ${input.faceValueRupees} rupees. ` +
        `Can you confirm this invoice has been received and approved for payment?`,
    },
    {
      speaker: "buyer",
      text: "Confirmed. It is approved and scheduled for payment on the due date.",
    },
    {
      speaker: "agent",
      text:
        "Thank you. The invoice verification tier has been upgraded to buyer accepted. " +
        "This will be reflected in the marketplace immediately.",
    },
  ];
}

/**
 * Make text safe to read aloud.
 *
 * Gate reasons come from the clearing engine and contain "₹" and digit
 * grouping meant for the eye. Text-to-speech renders the symbol
 * inconsistently — sometimes silence, sometimes the literal word — so it is
 * replaced rather than left to chance. Applied at the /api/voice/speak choke
 * point so every surface gets it, including text this module did not write.
 */
export function forSpeech(text: string): string {
  return text
    // "₹9,00,000.00" -> "9,00,000.00 rupees" — the unit reads better after
    // the number when spoken, which is the opposite of how it is written.
    .replace(/₹\s*([\d,]+(?:\.\d+)?)/g, "$1 rupees")
    .replace(/₹/g, " rupees ")
    // A trailing ".00" is noise out loud.
    .replace(/(\d)\.00\b/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
