import { generatePdf } from "./src/utils/simple-pdf.js";
import fs from "node:fs";
// Simulate calling parse by calling generatePdf then check; also test simpler content
const simpleContent = "Hello World\n\nThis is a test paragraph.\n\n## Section 1\n\nSome content here.\n\n| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n";
const buf = generatePdf({ title: "Test", content: simpleContent });
console.log("simple PDF size:", buf.length);
fs.writeFileSync("/tmp/test_simple.pdf", buf);

const cnContent = "# 销售报价单\n\n报价单号: QT-001\n客户: Test Co\n\n## 产品明细\n| No | Product | Qty |\n|----|----|----|\n| 1 | Cup | 1000 |\n\n## 条款\n- FOB Shanghai\n- Payment T/T\n";
const buf2 = generatePdf({ title: "报价单", content: cnContent });
console.log("cn PDF size:", buf2.length);
fs.writeFileSync("/tmp/test_cn.pdf", buf2);
