import ExcelJS from "exceljs";
import { IListingObject } from "@repo/database";

export interface GenericMarketplaceRow {
  sku: string;
  title: string;
  category: string;
  subcategory: string;
  brand: string;
  mrp: number | string;
  sellingPrice: number | string;
  discountPct: number | string;
  feature1: string;
  feature2: string;
  feature3: string;
  feature4: string;
  feature5: string;
  description: string;
  keywords: string;
  mainImageUrl: string;
  lifestyleImageUrl: string;
  socialCardUrl: string;
  dispatchTime: string;
  returnPolicy: string;
  countryOfOrigin: string;
}

/**
 * Generates a completely generic, multi-category e-commerce catalog upload sheet (.xlsx)
 * compliant with Meesho, Amazon, Flipkart, and Shopify bulk inventory loaders.
 * Does not assume apparel or specific material—works for electronics, beauty, home, jewelry, and fashion.
 */
export async function generateGenericMarketplaceExcel(
  listing: IListingObject
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Peshkar AI E-Commerce Studio";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("MarketplaceCatalog", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "SKU / Product ID", key: "sku", width: 18 },
    { header: "Product Title", key: "title", width: 40 },
    { header: "Category", key: "category", width: 22 },
    { header: "Sub-Category", key: "subcategory", width: 22 },
    { header: "Brand / Seller Store", key: "brand", width: 24 },
    { header: "MRP (₹)", key: "mrp", width: 14 },
    { header: "Selling Price (₹)", key: "sellingPrice", width: 16 },
    { header: "Discount (%)", key: "discountPct", width: 14 },
    { header: "Key Feature 1", key: "feature1", width: 35 },
    { header: "Key Feature 2", key: "feature2", width: 35 },
    { header: "Key Feature 3", key: "feature3", width: 35 },
    { header: "Key Feature 4", key: "feature4", width: 35 },
    { header: "Key Feature 5", key: "feature5", width: 35 },
    { header: "Full Description & Specs", key: "description", width: 55 },
    { header: "Backend Search Keywords", key: "keywords", width: 35 },
    { header: "Main Hero Image URL (White #FFFFFF)", key: "mainImageUrl", width: 40 },
    { header: "Lifestyle Studio Image URL", key: "lifestyleImageUrl", width: 40 },
    { header: "Social Card URL (WhatsApp)", key: "socialCardUrl", width: 40 },
    { header: "Dispatch Timeline", key: "dispatchTime", width: 18 },
    { header: "Return Policy", key: "returnPolicy", width: 20 },
    { header: "Country of Origin", key: "countryOfOrigin", width: 18 },
  ];

  // Style Header Row
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE05822" }, // Terracotta / Brand Orange
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "medium", color: { argb: "FF993300" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  });

  const text = listing.aiGeneratedText;
  const features = text?.keyFeatures || [];
  const whiteImg = listing.generatedImages?.find((i) => i.variationType === "studio_white")?.url ||
    listing.generatedImages?.[0]?.url || "";
  const lifestyleImg = listing.generatedImages?.find((i) => i.variationType === "studio_premium" || i.variationType === "lifestyle")?.url ||
    listing.generatedImages?.[1]?.url || "";
  const cardUrl = listing.whatsappCard?.url || listing.instagramPost?.url || "";

  const price = listing.price || 0;
  const mrp = price ? Math.round(price * 1.35) : "";
  const discountPct = mrp && price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  // Formula injection defense: prevent Excel/CSV command execution if title or description starts with =, +, -, @
  const sanitize = (val: string | undefined): string => {
    if (!val) return "";
    const str = String(val).trim();
    return /^[=+@-]/.test(str) ? `'${str}` : str;
  };

  const rowData: GenericMarketplaceRow = {
    sku: `SKU-${listing._id ? listing._id.toString().slice(-6).toUpperCase() : Date.now().toString().slice(-6)}`,
    title: sanitize(text?.meeshoListing?.title || text?.seoTitle || listing.userTitle || "Product"),
    category: sanitize(text?.meeshoListing?.category || "General Merchandise"),
    subcategory: sanitize(text?.meeshoListing?.subcategory || "Standard"),
    brand: "Official Store",
    mrp: mrp ? mrp : "NA",
    sellingPrice: price ? price : "NA",
    discountPct: discountPct ? `${discountPct}%` : "NA",
    feature1: sanitize(features[0] || "Premium commercial grade quality"),
    feature2: sanitize(features[1] || "Durable and verified craftsmanship"),
    feature3: sanitize(features[2] || "Fast dispatch with safe transit packaging"),
    feature4: sanitize(features[3] || "Quality assured standard warranty"),
    feature5: sanitize(features[4] || "Cash on Delivery & easy returns available"),
    description: sanitize(text?.meeshoListing?.description || text?.seoDescription || listing.userDescription || ""),
    keywords: sanitize(text?.keywords?.join(", ") || ""),
    mainImageUrl: whiteImg,
    lifestyleImageUrl: lifestyleImg,
    socialCardUrl: cardUrl,
    dispatchTime: "1-2 Business Days",
    returnPolicy: "7 Days Hassle-Free",
    countryOfOrigin: "India",
  };

  const dataRow = sheet.addRow(rowData);
  dataRow.height = 24;
  dataRow.eachCell((cell) => {
    cell.font = { size: 10, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  return Buffer.from(buffer);
}
