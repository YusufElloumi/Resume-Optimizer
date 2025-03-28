import express from "express";
import cors from "cors";
import multer from "multer";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDocument } from "pdfjs-dist";
import { readFile } from "fs/promises";
import fs from "fs";
import PDFDocument from "pdfkit";
import { chromium } from "playwright"; // ✅ Added Playwright for web scraping

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Missing OPENAI_API_KEY in .env");
    process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ dest: "uploads/" });

// ✅ Web scraping function to extract job descriptions
async function scrapeJobDescription(jobUrl) {
    console.log(`🔹 Scraping job description from: ${jobUrl}`);
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(jobUrl, { waitUntil: "domcontentloaded" });

    // Extract job text (Modify selector based on site structure)
    const jobDescription = await page.evaluate(() => {
        return document.body.innerText.slice(0, 5000); // Extract first 5000 characters
    });

    await browser.close();
    console.log("✅ Scraped job description:", jobDescription.slice(0, 200) + "..."); // Preview
    return jobDescription;
}

// ✅ Updated "Find Keywords" Route to Use Playwright
app.post("/find-keywords", async (req, res) => {
    try {
        console.log("🔹 Received find-keywords request:", req.body);
        const jobUrl = req.body.jobUrl;

        if (!jobUrl) {
            console.error("❌ No job URL provided!");
            return res.status(400).json({ error: "Job URL is required" });
        }

        // 🔹 Extract job description using Playwright
        const jobDescription = await scrapeJobDescription(jobUrl);

        // 🔹 Extract keywords using OpenAI
        const keywordExtraction = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Extract key skills and keywords from the job description." },
                { role: "user", content: `Extract keywords from this job description:\n${jobDescription}` }
            ],
            max_tokens: 200
        });

        const jobKeywords = keywordExtraction.choices[0].message.content;
        console.log("🔹 Extracted Job Keywords:", jobKeywords);

        res.json({ keywords: jobKeywords });

    } catch (error) {
        console.error("❌ Error extracting keywords:", error);
        res.status(500).json({ error: "Something went wrong with keyword extraction." });
    }
});

// ✅ Optimize Resume Route (No Changes)
app.post("/optimize-resume", upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No resume file uploaded" });
        }

        const keywords = req.body.keywords;
        if (!keywords) {
            return res.status(400).json({ error: "Keywords are required to optimize the resume" });
        }

        console.log("✅ Uploaded resume path:", req.file.path);
        console.log("🔹 Using Keywords for Optimization:", keywords);

        async function extractTextFromPDF(pdfPath) {
            const pdfData = new Uint8Array(await readFile(pdfPath));
            const pdf = await getDocument({ data: pdfData }).promise;
            let text = "";

            for (let i = 0; i < pdf.numPages; i++) {
                const page = await pdf.getPage(i + 1);
                const content = await page.getTextContent();
                text += content.items.map((item) => item.str).join(" ") + "\n";
            }

            return text;
        }

        const resumeText = await extractTextFromPDF(req.file.path);

        const optimizedResumeResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Modify the resume text to better match the job description by naturally inserting relevant keywords while keeping the resume structure intact." },
                { role: "user", content: `Original Resume:\n${resumeText}\n\nMatch it with these keywords:\n${keywords}` }
            ],
            max_tokens: 800
        });

        const optimizedResumeText = optimizedResumeResponse.choices[0].message.content;

        async function generatePDF(text, filePath) {
            return new Promise((resolve, reject) => {
                const doc = new PDFDocument();
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);
                doc.fontSize(12).text(text, { align: "left" });
                doc.end();
                stream.on("finish", resolve);
                stream.on("error", reject);
            });
        }

        const optimizedResumePath = path.join(__dirname, "uploads", "optimized_resume.pdf");
        await generatePDF(optimizedResumeText, optimizedResumePath);

        res.json({
            message: "Resume optimized successfully!",
            downloadUrl: `http://localhost:5000/uploads/optimized_resume.pdf`
        });

    } catch (error) {
        console.error("❌ Error optimizing resume:", error);
        res.status(500).json({ error: "Something went wrong" });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
