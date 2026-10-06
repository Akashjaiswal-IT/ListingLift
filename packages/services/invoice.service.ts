import PDFDocument from "pdfkit";

export interface ReceiptPaymentInput {
  receiptNumber: string;
  date: Date;
  razorpayPaymentId?: string;
  razorpayOrderId: string;
  packId: string;
  creditsPurchased: number;
  amountPaise: number;
  currency: string;
}

export interface ReceiptBuyerInput {
  name?: string;
  email?: string;
}

const rupees = (paise: number) => (paise / 100).toFixed(2);

// Brand shown at the top of the receipt. No company/legal details or GST are
// involved — this is a simple proof-of-payment, not a tax invoice. Optionally
// overridable via env, but it works with no configuration at all.
const BRAND_NAME = process.env.RECEIPT_BRAND_NAME || "Peshkar AI";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "";

/**
 * Render a simple PAYMENT RECEIPT PDF for a captured credit purchase and return
 * it as a Buffer. Deliberately contains no GST breakdown and no company legal
 * details — just who paid, for what, how much, and the payment reference. Uses
 * pdfkit's built-in Helvetica font, so there are no font files to bundle.
 */
export function generateReceiptPdf(
  payment: ReceiptPaymentInput,
  buyer: ReceiptBuyerInput
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const brand = "#E05822";

      // Header
      doc.fillColor(brand).fontSize(22).font("Helvetica-Bold").text(BRAND_NAME, 50, 50);
      if (SUPPORT_EMAIL) {
        doc.fillColor("#666666").fontSize(10).font("Helvetica").text(SUPPORT_EMAIL, 50, 78);
      }

      doc.fillColor("#111111").fontSize(18).font("Helvetica-Bold").text("PAYMENT RECEIPT", 350, 50, {
        width: 195,
        align: "right",
      });
      doc.fontSize(10).font("Helvetica").fillColor("#111111");
      doc.text(`Receipt No: ${payment.receiptNumber}`, 350, 80, { width: 195, align: "right" });
      doc.text(`Date: ${payment.date.toLocaleDateString("en-IN")}`, 350, 94, {
        width: 195,
        align: "right",
      });

      // Divider
      doc.moveTo(50, 125).lineTo(545, 125).strokeColor("#DDDDDD").stroke();

      // Paid by
      doc.fillColor("#666666").fontSize(9).font("Helvetica-Bold").text("PAID BY", 50, 140);
      doc.fillColor("#111111").fontSize(11).font("Helvetica");
      doc.text(buyer.name || "Customer", 50, 155);
      if (buyer.email) doc.text(buyer.email, 50, 170);

      // Payment reference
      doc.fillColor("#666666").fontSize(9).font("Helvetica-Bold").text("PAYMENT REFERENCE", 350, 140, {
        width: 195,
        align: "right",
      });
      doc.fillColor("#111111").fontSize(9).font("Helvetica");
      doc.text(`Order: ${payment.razorpayOrderId}`, 350, 155, { width: 195, align: "right" });
      if (payment.razorpayPaymentId) {
        doc.text(`Payment: ${payment.razorpayPaymentId}`, 350, 168, { width: 195, align: "right" });
      }

      // Table header
      const tableTop = 210;
      doc.rect(50, tableTop, 495, 22).fill("#F3ECE2");
      doc.fillColor("#111111").fontSize(10).font("Helvetica-Bold");
      doc.text("Description", 60, tableTop + 6);
      doc.text("Qty", 330, tableTop + 6, { width: 50, align: "right" });
      doc.text("Amount", 440, tableTop + 6, { width: 95, align: "right" });

      // Line item
      const rowY = tableTop + 30;
      doc.font("Helvetica").fontSize(10);
      doc.text(
        `${payment.packId.toUpperCase()} credit pack — ${payment.creditsPurchased} credits`,
        60,
        rowY,
        { width: 260 }
      );
      doc.text(String(payment.creditsPurchased), 330, rowY, { width: 50, align: "right" });
      doc.text(`${payment.currency} ${rupees(payment.amountPaise)}`, 440, rowY, {
        width: 95,
        align: "right",
      });

      // Total
      let ty = rowY + 40;
      doc.moveTo(330, ty).lineTo(545, ty).strokeColor("#DDDDDD").stroke();
      ty += 8;
      doc.font("Helvetica-Bold").fontSize(12);
      doc.text("Total paid", 330, ty, { width: 110, align: "right" });
      doc.text(`${payment.currency} ${rupees(payment.amountPaise)}`, 440, ty, {
        width: 95,
        align: "right",
      });

      // Footer
      doc.fillColor("#999999").fontSize(8).font("Helvetica");
      doc.text(
        "This is a computer-generated payment receipt and does not require a signature.",
        50,
        760,
        { width: 495, align: "center" }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
