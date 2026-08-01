const { SocksProxyAgent } = require("socks-proxy-agent");
const https = require("https");
const agent = new SocksProxyAgent("socks5://127.0.0.1:1080");

const url = "https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent("Huawei Technologies");
https.get(url, { agent, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }, (res) => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    console.log("HTML length:", data.length);
    // Find all links
    const linkRegex = /href="(https?:\/\/[^"]+)"/gi;
    const links = [];
    let m;
    while ((m = linkRegex.exec(data)) !== null) {
      if (!m[1].includes("duckduckgo.com")) links.push(m[1]);
    }
    console.log("External links found:", links.length);
    links.slice(0, 5).forEach(l => console.log(" -", l));
    
    // Check for result snippets
    const snippetRegex = /class="result__snippet"[^>]*>(.*?)<\/(?:td|span|div)>/gi;
    const snippets = [];
    while ((m = snippetRegex.exec(data)) !== null) snippets.push(m[1]);
    console.log("Snippets found:", snippets.length);
    
    if (links.length === 0) {
      // Show some of the body
      const bodyStart = data.indexOf("<body>");
      if (bodyStart > -1) console.log("Body sample:", data.substring(bodyStart, bodyStart + 2000));
    }
  });
}).on("error", e => console.error("Error:", e.message));
