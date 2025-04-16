// ==== IMPORTS ==== //
import express from "express";           // Web framework for handling HTTP requests
import cors from "cors";                 // Enables Cross-Origin Resource Sharing
import puppeteer from "puppeteer";       // Headless browser for scraping web content
import dotenv from "dotenv";             // Loads environment variables from .env file
import path from "path";                 // Node.js path utilities
import { fileURLToPath } from "url";     // Converts module URL to file path
import OpenAI from "openai";             // OpenAI SDK for interacting with language models
import multer from "multer";             // Middleware for handling file uploads
import extractText from "pdf-text-extract"; // Extracts raw text from PDF files
import fs from "fs";                     // File system access
import { PDFDocument } from "pdf-lib";   // PDF creation and editing
import { v4 as uuidv4 } from "uuid";     // Unique ID generator
import fontkit from '@pdf-lib/fontkit';  // Allows custom fonts with pdf-lib

// ==== CONFIGURATION ==== //
dotenv.config({ path: "../.env" });      // Load env vars from parent .env

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(express.json());
app.use(cors());

// OpenAI API setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// ==== SCRAPER FUNCTION ==== //
async function scrapeJobDescription(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Extract visible text from the job page
    const jobDescription = await page.evaluate(() => document.body.innerText);
    return jobDescription;
  } catch (error) {
    console.error("❌ Error scraping the job description:", error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

// ==== KEYWORD EXTRACTOR ==== //
async function extractKeywords(text) {
  const prompt = `Act like a professional resume parser... Job Description:\n${text}`;

  // Send prompt to OpenAI to extract keywords
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  // Return keywords as an array
  const output = response.choices[0].message.content.trim();
  return output.split(",").map((kw) => kw.trim()).filter(Boolean);
}

// ==== ENDPOINT: FIND KEYWORDS FROM JOB POSTING ==== //
app.post("/find-keywords", async (req, res) => {
  try {
    const { jobUrl } = req.body;
    if (!jobUrl) return res.status(400).json({ error: "Job URL is required." });

    console.log("🔹 Scraping job description from:", jobUrl);
    const jobDescription = await scrapeJobDescription(jobUrl);
    const keywords = await extractKeywords(jobDescription);
    console.log("✅ Extracted Keywords:", keywords);

    res.json({ keywords, jobDescription });
  } catch (error) {
    console.error("❌ Error extracting keywords:", error);
    res.status(500).json({ error: "Failed to extract keywords." });
  }
});

// Multer config for file uploads
const upload = multer({ dest: "uploads/" });

// ==== TEXT WRAPPING FUNCTION FOR PDF OUTPUT ==== //
function wrapText(text, font, size, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, size);

    if (width < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ==== ENDPOINT: OPTIMIZE RESUME BASED ON KEYWORDS ==== //
app.post("/optimize", upload.single("resume"), async (req, res) => {
  try {
    const { keywords } = req.body;

    // Extract raw text from uploaded PDF resume
    const resumeText = await new Promise((resolve, reject) => {
      extractText(req.file.path, { splitPages: false }, (err, text) => {
        if (err) return reject(err);
        resolve(text);
      });
    });

    // Prompt GPT to optimize the resume text using provided keywords
    const prompt = `You are a professional resume editor... Resume:\n${resumeText}`;
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const optimizedText = response.choices[0].message.content;

    // Create new PDF document and register font
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(__dirname, "fonts/dejavu-fonts-ttf-2.37/ttf", "DejaVuSans.ttf");
    const customFontBytes = fs.readFileSync(fontPath);
    const font = await pdfDoc.embedFont(customFontBytes);

    // Set layout settings
    const fontSize = 12;
    const margin = 40;
    let page = pdfDoc.addPage();
    let y = page.getHeight() - margin;
    const maxWidth = page.getWidth() - 2 * margin;

    // Draw each line of the optimized text into the PDF
    const lines = optimizedText.split("\n").filter(Boolean);
    for (const line of lines) {
      const wrappedLines = wrapText(line, font, fontSize, maxWidth);
      for (const wrap of wrappedLines) {
        page.drawText(wrap, { x: margin, y, size: fontSize, font });
        y -= 20;
        if (y < margin) {
          page = pdfDoc.addPage();
          y = page.getHeight() - margin;
        }
      }
    }

    // Convert PDF to byte stream and send as downloadable file
    const pdfBytes = await pdfDoc.save();
    const downloadName = `optimized_${uuidv4().slice(0, 8)}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error("❌ Resume optimization failed:", err);
    res.status(500).json({ error: "Resume optimization failed." });
  }
});

// ==== SERVE FRONTEND FOR ALL OTHER ROUTES ==== //
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ==== START SERVER ==== //
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
