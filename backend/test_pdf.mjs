import { generatePdf } from "./src/utils/simple-pdf.js";
import fs from "node:fs";
const content = "# 销售报价单\n\n**报价单号:** QT-2026-0715-001\n**客户:** Global Buyer Co.\n**日期:** 2026-07-15\n\n## 产品明细\n| No. | Product | Spec | Qty | Unit Price | Amount |\n|----|----|----|----|----|----|\n| 1 | Glass Cup | 350ml clear | 1000 | USD 2.50 | USD 2,500 |\n| 2 | Ceramic Mug | 400ml white | 500 | USD 3.20 | USD 1,600 |\n\n## Terms\n- FOB Shanghai\n- Payment: 30% T/T in advance\n- Delivery: 25 days after deposit\n";
try {
  const buf = generatePdf({ title: "报价单", content });
  console.log("PDF size:", buf.length);
  fs.writeFileSync("/tmp/testpdf.pdf", buf);
  console.log("written OK");
} catch(e) { console.error("ERR:", e.message, e.stack); }
