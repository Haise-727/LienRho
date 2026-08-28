#!/usr/bin/env bash
# LienRho — walk the marketplace end to end against a running dev server.
#
#   Terminal 1:  cd frontend && npm run dev
#   Terminal 2:  ./scripts/demo.sh
#
# Everything printed is read from the API. Nothing is hardcoded here.
set -uo pipefail
B="${LIENRHO_URL:-http://localhost:3000}"
b=$'\e[1m'; d=$'\e[2m'; g=$'\e[32m'; r=$'\e[31m'; y=$'\e[33m'; n=$'\e[0m'
rule() { printf "${d}%s${n}\n" "────────────────────────────────────────────────────────────────────"; }

if ! curl -sf "$B/api/db-health" >/dev/null 2>&1; then
  printf "${r}Cannot reach %s${n}\n  Start it with:  cd frontend && npm run dev\n" "$B"; exit 1
fi

printf "\n${b}LienRho — agentic capital marketplace${n}\n${d}%s${n}\n" "$B"

rule; printf "${b}1. Is the system healthy?${n}\n\n"
curl -s "$B/api/db-health" | python3 -m json.tool | sed 's/^/  /'

rule; printf "\n${b}2. Who is in the market?${n}  ${d}(public view — mandates are private)${n}\n\n"
curl -s "$B/api/providers" | python3 -c "
import json,sys
for p in json.load(sys.stdin)['providers']:
    print('  %-22s %-16s settles T+%s  tickets %s-%s' % (
        p['name'], p['archetype'], p['settlementDays'],
        int(float(p['minTicket'])), int(float(p['maxTicket']))))
print()
print('  Note: costOfFunds, hurdleRate and riskAppetiteFloor are absent by design.')
print('  If the scorer could read what the bidder priced on, the market is circular.')
"

rule; printf "\n${b}3. The thesis — clearing a live auction${n}\n"
for INV in INV-2026-0801 INV-2026-0803; do
  OID=$(curl -s "$B/api/opportunities?status=AUCTION_LIVE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=[o['id'] for o in d['opportunities'] if o['invoice']['invoiceNumber']=='$INV']
print(m[0] if m else '')")
  [ -z "$OID" ] && continue
  curl -s -X POST "$B/api/match" -H 'content-type: application/json' \
    -d "{\"opportunityId\":\"$OID\"}" | python3 -c "
import json,sys
d=json.load(sys.stdin); u=d['utility']
rup=lambda p: '%0.2f' % (p/100)
print()
print('  \033[1m$INV\033[0m  ->  \033[1m%s\033[0m' % d['status'])
print('  Supplier needs Rs %s by %s' % (rup(u['sufficiencyFloorPaise']), u['timingDeadline']))
print('  Derived from: %s' % u['drivingObligation'])
print('  \033[2m(not asked for — read off dated cash obligations)\033[0m')
print()
print('    %-22s %12s  %-6s %-8s %s' % ('PROVIDER','NET CASH','SETTLE','EFF COST','OUTCOME'))
for s in sorted(d['scoredOffers'], key=lambda x: -x['netCashPaise']):
    ga=s['gates']; ok=ga['sufficiency']['passed'] and ga['timing']['passed']
    why='\033[32mWINS\033[0m' if ok else '\033[33mgated out\033[0m'
    print('    %-22s %12s  T+%-4s %-8s %s' % (
        s['providerName'], rup(s['netCashPaise']), s['offer']['settlementDays'],
        '%0.2f%%' % (s['effectiveCostBps']/100), why))
if d['status']=='NO_ACCEPTABLE_OFFER':
    print()
    print('  \033[1mNothing cleared the floor.\033[0m %s' % d.get('reason',''))
    print('  \033[2mThe correct answer is do-not-finance, not least-bad-option.\033[0m')
else:
    o=sorted(d['scoredOffers'], key=lambda x: x['effectiveCostBps'])[0]
    ga=o['gates']
    if not (ga['sufficiency']['passed'] and ga['timing']['passed']):
        print()
        print('  \033[1mNote:\033[0m %s is the CHEAPEST offer (%0.2f%%) and it loses.' % (
            o['providerName'], o['effectiveCostBps']/100))
        print('  \033[2m%s\033[0m' % (ga['sufficiency']['reason'] if not ga['sufficiency']['passed'] else ga['timing']['reason']))
        print('  \033[2mA weighted score ranks it first. A gate says it does not solve the problem.\033[0m')
"
done

rule; printf "\n${b}4. The Stitch ledger — does it balance?${n}\n\n"
curl -s "$B/api/ledger/trial-balance" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('  Debits   Rs %s' % d['debits'])
print('  Credits  Rs %s' % d['credits'])
print('  %s' % ('\033[32m  BALANCED\033[0m' if d['balanced'] else '\033[31m  OUT OF BALANCE\033[0m'))
print()
print('  Accounts with activity:')
for a in d['accounts']:
    if a['postingCount']: print('    %-46s %14s' % (a['code'], a['balance']))
"

rule; printf "\n${b}5. One deal's full audit trail${n}  ${d}(Day 0 -> Day 90)${n}\n\n"
curl -s "$B/api/ledger/entries?limit=20" | python3 -c "
import json,sys
for e in reversed(json.load(sys.stdin)['entries']):
    if e['eventType']=='OPENING_BALANCE': continue
    t=e['totals']
    print('  %-16s %s' % (e['eventType'], e['description'][:52]))
    for p in e['postings']:
        print('      %-6s %-44s %14s' % (p['direction'], p['account']['code'], p['amount']))
    print('      %s Dr %s = Cr %s' % ('\033[32mbalanced\033[0m' if t['balanced'] else '\033[31mUNBALANCED\033[0m', t['debits'], t['credits']))
    print()
"
rule
printf "\n${b}Every figure above was computed, not stored.${n}\n"
printf "${d}Change a bid's rate and all of it moves. No LLM produced any of it.${n}\n\n"
