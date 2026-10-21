import fs from "node:fs";
import autocannon from "autocannon";

const cookieFile = "/tmp/admin_cookie.txt";
const rawCookie = fs.readFileSync(cookieFile, "utf-8");
const match = rawCookie.match(/byteinn_session\s+([^\s]+)/);
if (!match) {
  console.error("Could not find byteinn_session in cookie file!");
  process.exit(1);
}
const cookieHeader = `byteinn_session=${match[1]}`;

const ENDPOINTS = [
  { name: "/api/reservations", path: "/api/reservations?limit=100" },
  { name: "/api/invoices", path: "/api/invoices?limit=100" },
  { name: "/api/customers", path: "/api/customers?limit=100" },
  { name: "/api/users", path: "/api/users?limit=100" },
  { name: "/api/rooms", path: "/api/rooms?limit=100" },
];

const CONCURRENCIES = [1, 10, 25];

async function runBenchmark(endpoint, connections) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url: `http://localhost:3000${endpoint.path}`,
        connections,
        duration: 5,
        headers: {
          cookie: cookieHeader,
        },
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          reqSec: result.requests.average,
          p50: result.latency.p50,
          p90: result.latency.p90,
          p99: result.latency.p99,
          errors: result.errors,
          non2xx: result.non2xx,
        });
      }
    );
  });
}

async function main() {
  console.log("Starting Autocannon Benchmark Suite (Task C4)...");
  console.log("Endpoint list at limit=100 across concurrency c=1, 10, 25 (duration: 5s each):\n");

  const results = {};

  for (const ep of ENDPOINTS) {
    results[ep.name] = {};
    for (const c of CONCURRENCIES) {
      process.stdout.write(`Benchmarking ${ep.name} (c=${c})... `);
      const res = await runBenchmark(ep, c);
      results[ep.name][`c=${c}`] = res;
      console.log(
        `${res.reqSec.toFixed(1)} req/s | p50: ${res.p50} ms | p99: ${res.p99} ms | non2xx: ${res.non2xx}`
      );
    }
  }

  console.log("\n==========================================");
  console.log("SUMMARY TABLE");
  console.log("==========================================");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
