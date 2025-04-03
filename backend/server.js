import express from "express";
import cors from "cors";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin()); // Helps bypass bot detection

const CHROME_PATH = "C:\\Users\\yello\\.cache\\puppeteer\\chrome\\win64-134.0.6998.165\\chrome-win64\\chrome.exe";


const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

console.log(`✅ Server starting on port ${PORT}...`);

/**
 * Scrapes the job description from the given URL.
 */
async function scrapeJobDescription(url) {
    console.log("🔹 Launching Puppeteer browser...");
    let browser;
    
    try {
        browser = await puppeteer.launch({
            headless: true, // Ensure headless mode is enabled
            executablePath: CHROME_PATH, // Use the correct Chrome path
            args: ["--no-sandbox", "--disable-setuid-sandbox"], // Required for some environments
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded" });

        const jobDescription = await page.evaluate(() => document.body.innerText);

        console.log("✅ Job description scraped successfully.");
        return jobDescription;
    } catch (error) {
        console.error("❌ Puppeteer failed to launch:", error);
        throw new Error("Puppeteer launch error");
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Handles the keyword extraction request.
 */
app.post("/find-keywords", async (req, res) => {
    try {
        const { jobUrl } = req.body;
        console.log("🔹 Received find-keywords request:", req.body);

        if (!jobUrl) {
            return res.status(400).json({ error: "Job URL is required." });
        }

        console.log("🔹 Scraping job description from:", jobUrl);
        const jobDescription = await scrapeJobDescription(jobUrl);

        // Simple keyword extraction (Replace with actual logic)
        const keywords = ["JavaScript", "React", "Node.js", "API"];

        res.json({ keywords, jobDescription });
    } catch (error) {
        console.error("❌ Error extracting keywords:", error);
        res.status(500).json({ error: "Failed to extract keywords." });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
