"""
Generate a synthetic receivables corpus as Tally XML.

Why this writes Tally XML rather than seeding the database directly (#37):
`backend/app/connectors/tally/` already contains a tested TallyConnector. If the
generator emits the envelope that connector parses, the real ingestion path is
exercised — parser, canonical mapping, the lot — instead of bypassed. And if
anyone later gets a genuine Tally export working, it drops in with no code
change, because the pipeline downstream of this file never knew the difference.

We tried real Tally files first. Tally stores company data in an undocumented
binary format with no parser and no published spec, so reading it without Tally
itself is a dead end. This is the honest substitute: real format, real parser,
synthetic contents, said out loud.

Determinism is not optional here. Every claim we make from this corpus has to be
reproducible by someone else, so the RNG is seeded and the seed is committed.
"""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from xml.sax.saxutils import escape

# Fixed so the corpus — and therefore every figure measured from it — is
# reproducible. Change it deliberately, never incidentally.
SEED = 20260829

# Indian mid-market manufacturing/services names. Deliberately fictional: no
# real company should appear in a public repo attached to invented receivables.
SUPPLIER_NAMES = [
    "Vertex Components", "Kalinga Precision Works", "Sundar Engineering",
    "Deccan Polymers", "Anand Tooling", "Nashik Fabricators", "Coimbatore Castings",
    "Meenakshi Textiles", "Godavari Chemicals", "Sarvodaya Electricals",
    "Pragati Metalworks", "Konark Instruments", "Bhoomi Agro Processing",
    "Trichy Auto Parts", "Vidarbha Packaging", "Surat Weaving", "Malabar Rubber",
    "Indus Valves", "Chandrapur Alloys", "Kaveri Plastics", "Ranchi Forgings",
    "Palghar Wire", "Hubli Bearings", "Erode Spinning", "Bharuch Coatings",
]

BUYER_NAMES = [
    "Bharat Auto", "Sundaram Textiles", "Orion Retail", "Nilgiri Foods",
    "Apex Infrastructure", "Sagar Cements", "Vayu Aerospace", "Trident Motors",
    "Himalaya Consumer", "Nova Electronics", "Ganga Pharmaceuticals",
    "Silverline Hospitality", "Prakash Steel", "Vindhya Power", "Coastal Shipping",
    "Rajdhani Logistics", "Ashoka Constructions", "Meridian Healthcare",
    "Zenith Appliances", "Kritika Apparel", "Surya Solar", "Bharati Telecom",
    "Nandi Dairy", "Oberoi Furnishings", "Tarang Media", "Ekta Chemicals",
    "Girnar Mining", "Yamuna Paper", "Saraswati Publishing", "Kailash Cements",
    "Vasant Agro", "Neelkanth Ceramics", "Amrut Beverages", "Shakti Pumps",
    "Vishnu Cables", "Tapti Rail Systems", "Mahesh Bearings", "Chetak Tyres",
    "Bhima Jewellers", "Pushpak Interiors",
]


class PaymentHabit:
    """
    How a buyer actually pays, which is the property real Tally data would have
    given us and the one most worth simulating carefully.

    Buyer risk is meaningless if every buyer behaves identically — providers
    would have nothing to price against, and the verification tier would carry
    all the signal on its own.
    """

    # (label, mean days late, spread, probability of still being unpaid)
    RELIABLE = ("reliable", -1.0, 3.0, 0.10)
    SLOW = ("slow", 12.0, 8.0, 0.30)
    ERRATIC = ("erratic", 6.0, 22.0, 0.25)
    DELINQUENT = ("delinquent", 34.0, 20.0, 0.55)

    ALL = [RELIABLE, SLOW, ERRATIC, DELINQUENT]
    # Most buyers pay roughly on time; a long tail does not. A corpus where
    # everyone is delinquent is as unrealistic as one where nobody is.
    WEIGHTS = [0.45, 0.28, 0.19, 0.08]


@dataclass
class Buyer:
    name: str
    habit: tuple
    email: str


@dataclass
class Bill:
    number: str
    supplier: str
    buyer: str
    bill_date: date
    credit_days: int
    amount: int          # whole rupees
    outstanding: int      # whole rupees still owed; 0 = settled
    paid_on: date | None


def tally_date(d: date) -> str:
    """Tally writes dates as YYYYMMDD with no separators."""
    return d.strftime("%Y%m%d")


def money(rupees: int) -> str:
    """
    Tally writes receivables as NEGATIVE balances — a sundry debtor is a credit
    on the ledger. The connector relies on this sign convention, so getting it
    backwards produces invoices that look like payments.
    """
    return f"-{rupees}.00" if rupees else "0.00"


def pick_amount(rng: random.Random) -> int:
    """
    Log-normal-ish spread from ~₹40k to ~₹85L, clustered low.

    A uniform distribution would be wrong in a way that matters: flat fees are
    regressive, so the fee's effect on effective cost depends entirely on having
    genuinely small invoices in the mix. A corpus of uniformly large invoices
    would quietly hide the mechanism the worked example turns on.
    """
    base = rng.lognormvariate(mu=13.0, sigma=0.85)
    return int(max(40_000, min(8_500_000, base)) // 1000 * 1000)


def pick_tenor(rng: random.Random) -> int:
    return rng.choices([15, 30, 45, 60, 90], weights=[0.08, 0.34, 0.30, 0.20, 0.08])[0]


def build_bills(rng: random.Random, count: int, as_of: date) -> tuple[list[Bill], list[Buyer]]:
    buyers = [
        Buyer(
            name=f"{n} Ltd" if rng.random() < 0.5 else f"{n} Pvt Ltd",
            habit=rng.choices(PaymentHabit.ALL, weights=PaymentHabit.WEIGHTS)[0],
            email=f"accounts@{n.split()[0].lower()}.example",
        )
        for n in BUYER_NAMES
    ]
    suppliers = [f"{n} Pvt Ltd" for n in SUPPLIER_NAMES]

    bills: list[Bill] = []
    for i in range(count):
        supplier = suppliers[i % len(suppliers)]
        buyer = rng.choice(buyers)
        tenor = pick_tenor(rng)
        amount = pick_amount(rng)

        # Spread issue dates over the past ~5 months so the corpus contains both
        # long-settled history (which is what makes a payment habit observable)
        # and live receivables (which is what there is to finance).
        bill_date = as_of - timedelta(days=rng.randint(0, 150))
        due = bill_date + timedelta(days=tenor)

        label, mean_late, spread, unpaid_p = buyer.habit
        outstanding, paid_on = amount, None

        if due <= as_of and rng.random() > unpaid_p:
            days_late = max(-tenor + 1, int(rng.gauss(mean_late, spread)))
            settled = due + timedelta(days=days_late)
            if settled <= as_of:
                # A minority pay partially — this is what makes OPENINGBALANCE
                # and CLOSINGBALANCE differ, and it is real behaviour, not noise.
                if rng.random() < 0.12:
                    outstanding = int(amount * rng.uniform(0.2, 0.7)) // 1000 * 1000
                else:
                    outstanding, paid_on = 0, settled

        bills.append(Bill(
            number=f"INV-{bill_date.year}-{i + 1000:04d}",
            supplier=supplier, buyer=buyer.name, bill_date=bill_date,
            credit_days=tenor, amount=amount, outstanding=outstanding, paid_on=paid_on,
        ))

    return bills, buyers


def envelope(inner: str) -> str:
    return (
        "<ENVELOPE>\n"
        "  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>\n"
        "  <BODY>\n    <DATA>\n      <COLLECTION>\n"
        f"{inner}"
        "      </COLLECTION>\n    </DATA>\n  </BODY>\n</ENVELOPE>\n"
    )


def bills_xml(bills: list[Bill]) -> str:
    rows = []
    for b in bills:
        rows.append(
            f'        <BILLS NAME="{escape(b.number)}">\n'
            f"          <NAME>{escape(b.number)}</NAME>\n"
            f"          <PARENT>{escape(b.buyer)}</PARENT>\n"
            f"          <BILLDATE>{tally_date(b.bill_date)}</BILLDATE>\n"
            f"          <BILLCREDITPERIOD>{b.credit_days} Days</BILLCREDITPERIOD>\n"
            f"          <OPENINGBALANCE>{money(b.amount)}</OPENINGBALANCE>\n"
            f"          <CLOSINGBALANCE>{money(b.outstanding)}</CLOSINGBALANCE>\n"
            f"        </BILLS>\n"
        )
    return "".join(rows)


def customers_xml(buyers: list[Buyer], bills: list[Bill]) -> str:
    owed: dict[str, int] = {}
    for b in bills:
        owed[b.buyer] = owed.get(b.buyer, 0) + b.outstanding

    rows = []
    for buyer in buyers:
        rows.append(
            f'        <LEDGER NAME="{escape(buyer.name)}">\n'
            f"          <NAME>{escape(buyer.name)}</NAME>\n"
            f"          <PARENT>Sundry Debtors</PARENT>\n"
            f"          <EMAIL>{escape(buyer.email)}</EMAIL>\n"
            f"          <CLOSINGBALANCE>{money(owed.get(buyer.name, 0))}</CLOSINGBALANCE>\n"
            f"        </LEDGER>\n"
        )
    return "".join(rows)


def payments_xml(bills: list[Bill]) -> str:
    """Settled bills, as receipt vouchers."""
    rows = []
    for b in bills:
        if not b.paid_on:
            continue
        rows.append(
            f'        <VOUCHER VCHTYPE="Receipt" ACTION="Create">\n'
            f"          <DATE>{tally_date(b.paid_on)}</DATE>\n"
            f"          <PARTYLEDGERNAME>{escape(b.buyer)}</PARTYLEDGERNAME>\n"
            f"          <VOUCHERNUMBER>RCPT-{escape(b.number)}</VOUCHERNUMBER>\n"
            f"          <BILLNAME>{escape(b.number)}</BILLNAME>\n"
            f"          <AMOUNT>{b.amount}.00</AMOUNT>\n"
            f"        </VOUCHER>\n"
        )
    return "".join(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--count", type=int, default=500, help="number of bills")
    ap.add_argument("--out", type=Path, default=Path("data/corpus"))
    ap.add_argument("--seed", type=int, default=SEED)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    as_of = date(2026, 8, 29)

    bills, buyers = build_bills(rng, args.count, as_of)
    args.out.mkdir(parents=True, exist_ok=True)

    (args.out / "invoices.xml").write_text(envelope(bills_xml(bills)))
    (args.out / "customers.xml").write_text(envelope(customers_xml(buyers, bills)))
    (args.out / "payments.xml").write_text(envelope(payments_xml(bills)))

    outstanding = [b for b in bills if b.outstanding > 0]
    settled = [b for b in bills if b.paid_on]
    partial = [b for b in bills if b.outstanding and b.outstanding != b.amount]

    print(f"seed={args.seed}  as_of={as_of}")
    print(f"{len(bills)} bills · {len(buyers)} buyers · {len(set(b.supplier for b in bills))} suppliers")
    print(f"  outstanding {len(outstanding)}   settled {len(settled)}   partly paid {len(partial)}")
    print(f"  amounts Rs {min(b.amount for b in bills):,} .. {max(b.amount for b in bills):,}")
    print(f"  wrote {args.out}/invoices.xml, customers.xml, payments.xml")


if __name__ == "__main__":
    main()
