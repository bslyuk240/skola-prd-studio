import "dotenv/config";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const url = process.argv[2] ?? "https://www.facebook.com/share/v/18x4J25z3u/";

const res = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml",
  },
  redirect: "follow",
});

console.log("status:", res.status, "final:", res.url);
const html = await res.text();
console.log("html length:", html.length);

const patterns = [
  ["og:video", /property="og:video"\s+content="([^"]+)"/i],
  ["og:video:url", /property="og:video:url"\s+content="([^"]+)"/i],
  ["browser_native_hd_url", /"browser_native_hd_url":"([^"]+)"/],
  ["playable_url", /"playable_url":"([^"]+)"/],
  ["hd_src", /"hd_src":"([^"]+)"/],
];

for (const [name, re] of patterns) {
  const match = html.match(re);
  console.log(name + ":", match ? match[1].slice(0, 160) : "NOT FOUND");
}
