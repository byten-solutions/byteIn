#!/usr/bin/env bash
set -e

COOKIE=$(grep "byteinn_session" /tmp/admin_cookie.txt | awk '{print "byteinn_session=" $7}')

ENDPOINTS=(
  "/api/reservations?limit=100"
  "/api/invoices?limit=100"
  "/api/customers?limit=100"
  "/api/users?limit=100"
  "/api/rooms?limit=100"
)

CONCURRENCIES=(1 10 25)

echo "=========================================================================="
echo "Autocannon Benchmark Suite: 5 Endpoints @ limit=100 (c=1, 10, 25)"
echo "=========================================================================="

printf "%-25s | %-5s | %-10s | %-8s | %-8s | %-8s\n" "Endpoint" "Conn" "Req/Sec" "p50 (ms)" "p99 (ms)" "Non-2xx"
echo "--------------------------------------------------------------------------"

for ep in "${ENDPOINTS[@]}"; do
  for c in "${CONCURRENCIES[@]}"; do
    OUT=$(npx autocannon -j -c "$c" -d 4 -H "Cookie: $COOKIE" "http://localhost:3000$ep")
    REQ_SEC=$(echo "$OUT" | jq '.requests.average')
    P50=$(echo "$OUT" | jq '.latency.p50')
    P99=$(echo "$OUT" | jq '.latency.p99')
    NON2XX=$(echo "$OUT" | jq '.non2xx')
    printf "%-25s | c=%-3s | %-10.1f | %-8d | %-8d | %-8d\n" "$ep" "$c" "$REQ_SEC" "$P50" "$P99" "$NON2XX"
  done
  echo "--------------------------------------------------------------------------"
done
