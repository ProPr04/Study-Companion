import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"; // ✅ correct

export const extractTextFromPDF = async (filePath) => {
  try {
    const fullPath = path.resolve(filePath);

    console.log("Reading file from:", fullPath);

    const data = new Uint8Array(fs.readFileSync(fullPath));

    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const strings = content.items.map(item => item.str);
      text += strings.join(" ") + "\n";
    }

    return text;
  } catch (error) {
    console.error("PDF parsing error FULL:", error);
    throw new Error("Failed to extract PDF text");
  }
};