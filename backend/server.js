// server.js (FULL FILE)

import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import multer from "multer";
import extractText from "pdf-text-extract";
import fs from "fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import fontkit from '@pdf-lib/fontkit';

dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../frontend")));

async function scrapeJobDescription(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const jobDescription = await page.evaluate(() => document.body.innerText);
    return jobDescription;
  } catch (error) {
    console.error("❌ Error scraping the job description:", error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

async function extractKeywords(text) {
  const prompt = `Act like a professional resume parser and talent acquisition analyst. You have 15 years of experience working with HR systems, parsing job descriptions, and identifying skills, qualifications, and role-specific keywords for applicant tracking systems (ATS). You are exceptionally skilled at filtering out fluff and isolating only the essential terms used by hiring managers to describe desired competencies.

                  Your task is to extract and list only the most essential job-related keywords (limited to one or two words each) from the job description provided. These keywords must represent skills, tools, certifications, qualifications, or specific job functions.

                  Please follow these precise steps:

                  Scan the input text for phrases like “required skills,” “responsibilities,” “qualifications,” “requirements,” “must have,” “desired,” “experience in,” and other similar cues commonly used in job listings.

                  Extract nouns or short noun phrases (one or two words max) that represent:

                  Technical or soft skills

                  Certifications or credentials

                  Software or tools

                  Industry-specific terminology

                  Job functions or role-based actions

                  Exclude generic words such as “team player,” “motivated,” “fast learner,” “communication,” or vague terms not specific to the role.

                  Ensure that keywords are non-redundant, unique, and not repeated with synonyms.

                  Output a clean, lowercase, comma-separated list of these keywords.

                  Do not explain, add bullet points, or include extra text—only provide the keyword list in the specified format.Job Description:\n${text}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  const output = response.choices[0].message.content.trim();
  return output.split(",").map((kw) => kw.trim()).filter(Boolean);
}

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

const upload = multer({ dest: "uploads/" });

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

app.post("/optimize", upload.single("resume"), async (req, res) => {
  try {
    const { keywords } = req.body;

    const resumeText = await new Promise((resolve, reject) => {
      extractText(req.file.path, { splitPages: false }, (err, text) => {
        if (err) return reject(err);
        resolve(text);
      });
    });

    const prompt = `You are a professional resume editor. Carefully revise the resume text below to maximize the natural usage and integration of the following job-specific keywords: ${keywords}.

                    Ensure that:

                    The majority of keywords are incorporated organically and contextually within relevant sections.

                    Use each keyword exactly as provided — do not rephrase, modify, or substitute synonyms (e.g., if the keyword is "Communication Skills", it must appear verbatim).

                    Language must remain professional, concise, and ATS-optimized.

                    Preserve the original structure, formatting, and section layout of the resume.

                    Output only the revised resume content — no extra characters, no markdown/code blocks, and no commentary of any kind.

                    Resume:
                    ${resumeText}`;


    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const optimizedText = response.choices[0].message.content;
    

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(__dirname, "fonts/dejavu-fonts-ttf-2.37/ttf", "DejaVuSans.ttf");
    const customFontBytes = fs.readFileSync(fontPath);
    const font = await pdfDoc.embedFont(customFontBytes);

    const fontSize = 12;
    const margin = 40;

    let page = pdfDoc.addPage();
    let y = page.getHeight() - margin;
    const maxWidth = page.getWidth() - 2 * margin;

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

    const pdfBytes = await pdfDoc.save();
    const downloadName = `optimized_${uuidv4().slice(0, 8)}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));

    fs.unlinkSync(req.file.path);
  } catch (err) {
    console.error("❌ Resume optimization failed:", err);
    res.status(500).json({ error: "Resume optimization failed." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});