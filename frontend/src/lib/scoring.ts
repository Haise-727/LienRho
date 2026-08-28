export interface Bid {
  id: string;
  providerId: string;
  providerName: string;
  providerLogo?: string;
  rating: string;
  advanceRate: number; // e.g. 0.88 (88%)
  apr: number; // e.g. 0.112 (11.2%)
  speedDays: number; // e.g. 0.08 (2 hours) or 2 (2 days)
  processingFeeRate: number; // e.g. 0.005 (0.5%)
  tenorDays: number; // e.g. 90
  availableLiquidity: number;
}

export interface ComputedDeal {
  bid: Bid;
  invoiceAmount: number;
  netCashToday: number;
  totalFee: number;
  interestCost: number;
  totalCost: number;
  effectiveApr: number;
  remainingDay90: number;
  score: number;
  isParetoOptimal: boolean;
  speedBadge: string;
}

/**
 * Deterministic Multi-Attribute Utility / Pareto Scoring
 * Urgency Weight: 0.0 (Cheapest Cost) to 1.0 (Instant Liquidity)
 */
export function scoreBid(
  bid: Bid,
  invoiceAmount: number,
  urgencyWeight: number = 0.5 // 0 = Lowest Cost, 1 = Max Speed & Advance
): ComputedDeal {
  const advanceCash = invoiceAmount * bid.advanceRate;
  const processingFee = invoiceAmount * bid.processingFeeRate;
  const daysFraction = bid.tenorDays / 365.0;
  const interestCost = advanceCash * bid.apr * daysFraction;
  const totalCost = processingFee + interestCost;
  const netCashToday = advanceCash - processingFee;
  const remainingDay90 = invoiceAmount - advanceCash;
  const effectiveApr = (totalCost / advanceCash) * (365.0 / bid.tenorDays);

  // Normalized utility components (0 to 1)
  // Higher advance rate = better utility
  const advanceScore = Math.min(1, Math.max(0, (bid.advanceRate - 0.7) / 0.3));
  
  // Lower APR = better utility (range 8% to 24%)
  const costScore = Math.min(1, Math.max(0, (0.24 - bid.apr) / 0.16));
  
  // Faster speed = better utility (0.05 days to 5 days)
  const speedScore = Math.min(1, Math.max(0, (5 - bid.speedDays) / 5));

  // Multi-attribute weighted score
  const costWeight = 1.0 - urgencyWeight;
  const score = (
    urgencyWeight * (0.6 * speedScore + 0.4 * advanceScore) +
    costWeight * costScore
  );

  let speedBadge = "⚡ 2 Hours";
  if (bid.speedDays >= 2) speedBadge = "⏳ 2 Days";
  else if (bid.speedDays >= 1) speedBadge = "⚡ 24 Hours";
  else if (bid.speedDays > 0.2) speedBadge = "⚡ 6 Hours";

  return {
    bid,
    invoiceAmount,
    netCashToday,
    totalFee: processingFee,
    interestCost,
    totalCost,
    effectiveApr,
    remainingDay90,
    score,
    isParetoOptimal: score > 0.82,
    speedBadge
  };
}

export function rankBids(
  bids: Bid[],
  invoiceAmount: number,
  urgencyWeight: number
): ComputedDeal[] {
  return bids
    .map(b => scoreBid(b, invoiceAmount, urgencyWeight))
    .sort((a, b) => b.score - a.score);
}
