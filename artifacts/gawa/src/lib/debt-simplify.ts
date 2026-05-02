export interface Debt {
  from: string;
  to: string;
  amount: number;
}

/**
 * Given a trip's events (with participants and payerName), computes the
 * minimum set of payments needed to settle all outstanding balances.
 *
 * Only unpaid / requested participants are counted — already-paid balances
 * are excluded so the result reflects what still needs to move.
 */
export function simplifyDebts(events: Array<{
  payerName: string;
  participants: Array<{
    name: string;
    shareAmount: number;
    paymentStatus: string;
  }>;
}>): Debt[] {
  // net[person] > 0  → they are owed money (creditor)
  // net[person] < 0  → they owe money (debtor)
  const net: Record<string, number> = {};

  for (const event of events) {
    for (const p of event.participants) {
      if (p.paymentStatus === "paid") continue; // already settled
      const ower = p.name.trim();
      const owee = event.payerName.trim();
      if (ower === owee) continue; // payer doesn't owe themselves

      net[ower] = (net[ower] ?? 0) - p.shareAmount;
      net[owee] = (net[owee] ?? 0) + p.shareAmount;
    }
  }

  // Build separate lists, rounded to 2dp to avoid float noise
  const creditors: { name: string; amount: number }[] = [];
  const debtors:   { name: string; amount: number }[] = [];

  for (const [name, balance] of Object.entries(net)) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.005)  creditors.push({ name, amount:  rounded });
    if (rounded < -0.005) debtors.push({   name, amount: -rounded });
  }

  // Sort descending so we always match the largest amounts first
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const result: Debt[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const settle = Math.min(c.amount, d.amount);
    const rounded = Math.round(settle * 100) / 100;

    if (rounded > 0.005) {
      result.push({ from: d.name, to: c.name, amount: rounded });
    }

    c.amount -= settle;
    d.amount -= settle;

    if (c.amount < 0.005) ci++;
    if (d.amount < 0.005) di++;
  }

  return result;
}
