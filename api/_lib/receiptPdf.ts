import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type ReceiptData = {
  receiptNumber: string;
  issuedOn: string; // yyyy-mm-dd
  company: { name: string; address: string; email: string };
  clientName: string;
  invoiceNumber: string;
  invoiceTitle: string;
  paymentDate: string; // yyyy-mm-dd
  method: string;
  reference: string;
  amountZmw: number;
  invoiceTotalZmw: number;
  paidToDateZmw: number;
  balanceZmw: number;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function prettyDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

export const zmw = (n: number) =>
  `ZMW ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`;

/** Standard PDF fonts only cover WinAnsi; swap anything else for "?" instead of throwing. */
const safe = (s: string) =>
  s
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of safe(text).split(" ")) {
    const attempt = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) <= maxWidth) line = attempt;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Payment receipt ${d.receiptNumber}`);
  pdf.setAuthor(d.company.name);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.07, 0.09, 0.13);
  const muted = rgb(0.4, 0.44, 0.5);
  const accent = rgb(0.07, 0.45, 0.85);
  const line = rgb(0.85, 0.87, 0.9);
  const margin = 48;
  const right = width - margin;

  const text = (
    s: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      align?: "left" | "right";
    } = {},
  ) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    const t = safe(s);
    const w = font.widthOfTextAtSize(t, size);
    page.drawText(t, {
      x: opts.align === "right" ? x - w : x,
      y,
      size,
      font,
      color: opts.color ?? ink,
    });
  };

  // Header: logo (optional) + company, receipt title on the right.
  let y = height - margin;
  let headerBottom = y;
  try {
    const logo = await pdf.embedPng(
      readFileSync(join(process.cwd(), "apps/web/public/logo.png")),
    );
    const h = 40;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: margin, y: y - h, width: w, height: h });
    headerBottom = y - h;
  } catch {
    text(d.company.name, margin, y - 22, {
      size: 20,
      font: bold,
      color: accent,
    });
    headerBottom = y - 30;
  }
  text("PAYMENT RECEIPT", right, y - 14, {
    size: 18,
    font: bold,
    align: "right",
  });
  text(d.receiptNumber, right, y - 32, {
    size: 11,
    color: muted,
    align: "right",
  });

  y = headerBottom - 18;
  text(d.company.name, margin, y, { font: bold });
  if (d.company.address) {
    for (const l of wrap(d.company.address, regular, 9, 260)) {
      y -= 13;
      text(l, margin, y, { size: 9, color: muted });
    }
  }
  if (d.company.email) {
    y -= 13;
    text(d.company.email, margin, y, { size: 9, color: muted });
  }
  text(`Issued ${prettyDate(d.issuedOn)}`, right, headerBottom - 18, {
    size: 9,
    color: muted,
    align: "right",
  });

  y -= 22;
  page.drawLine({
    start: { x: margin, y },
    end: { x: right, y },
    thickness: 1,
    color: line,
  });

  // Received from / invoice
  y -= 28;
  text("RECEIVED FROM", margin, y, { size: 8, font: bold, color: muted });
  text("FOR INVOICE", width / 2 + 10, y, { size: 8, font: bold, color: muted });
  y -= 16;
  const clientLines = wrap(d.clientName, bold, 12, width / 2 - margin - 20);
  clientLines.forEach((l, i) =>
    text(l, margin, y - i * 15, { size: 12, font: bold }),
  );
  text(d.invoiceNumber, width / 2 + 10, y, { size: 12, font: bold });
  const titleLines = wrap(d.invoiceTitle, regular, 10, right - width / 2 - 10);
  titleLines
    .slice(0, 3)
    .forEach((l, i) =>
      text(l, width / 2 + 10, y - 15 - i * 13, { size: 10, color: muted }),
    );
  y -=
    Math.max(
      clientLines.length * 15,
      15 + Math.min(titleLines.length, 3) * 13,
    ) + 22;

  // Amount box
  page.drawRectangle({
    x: margin,
    y: y - 64,
    width: right - margin,
    height: 64,
    color: rgb(0.94, 0.97, 1),
    borderColor: rgb(0.78, 0.88, 0.98),
    borderWidth: 1,
  });
  text("AMOUNT RECEIVED", margin + 18, y - 24, {
    size: 8,
    font: bold,
    color: muted,
  });
  text(zmw(d.amountZmw), margin + 18, y - 49, {
    size: 22,
    font: bold,
    color: accent,
  });
  y -= 64 + 28;

  // Payment details
  const rows: [string, string][] = [
    ["Payment date", prettyDate(d.paymentDate)],
    ["Payment method", d.method],
    ["Payment reference", d.reference || "-"],
  ];
  for (const [k, v] of rows) {
    text(k, margin, y, { size: 10, color: muted });
    text(v, right, y, { size: 10, align: "right" });
    y -= 22;
    page.drawLine({
      start: { x: margin, y: y + 14 },
      end: { x: right, y: y + 14 },
      thickness: 0.5,
      color: line,
    });
  }

  // Invoice position
  y -= 14;
  text("INVOICE POSITION", margin, y, { size: 8, font: bold, color: muted });
  y -= 22;
  const pos: [string, string, boolean][] = [
    ["Invoice total", zmw(d.invoiceTotalZmw), false],
    [
      "Total paid to date (including this payment)",
      zmw(d.paidToDateZmw),
      false,
    ],
    ["Balance outstanding", zmw(d.balanceZmw), true],
  ];
  for (const [k, v, strong] of pos) {
    text(k, margin, y, {
      size: 10,
      font: strong ? bold : regular,
      color: strong ? ink : muted,
    });
    text(v, right, y, {
      size: 10,
      font: strong ? bold : regular,
      align: "right",
    });
    y -= 22;
  }
  text(d.balanceZmw <= 0.005 ? "PAID IN FULL" : "PART PAYMENT", margin, y - 4, {
    size: 9,
    font: bold,
    color: d.balanceZmw <= 0.005 ? rgb(0.05, 0.55, 0.3) : rgb(0.75, 0.45, 0.05),
  });

  // Footer
  const note =
    "This receipt acknowledges a payment received against the invoice above. It is not a tax invoice. " +
    "Please keep it for your records and contact us if any detail is incorrect.";
  wrap(note, regular, 8.5, right - margin).forEach((l, i) =>
    text(l, margin, 70 - i * 12, { size: 8.5, color: muted }),
  );

  return pdf.save();
}
