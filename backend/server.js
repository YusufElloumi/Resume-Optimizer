import express from "express";
import cors from "cors";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin()); // Anti-bot evasion

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

console.log(`✅ Server starting on port ${PORT}...`);

async function scrapeJobDescription(url) {
    console.log("🔹 Launching Puppeteer browser...");
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

        const jobDescription = await page.evaluate(() => document.body.innerText);

        await browser.close();
        console.log("✅ Job description scraped successfully.");
        return jobDescription;
    } catch (error) {
        console.error("❌ Puppeteer failed to launch:", error);
        throw new Error("Puppeteer launch error");
    }
}

app.post("/find-keywords", async (req, res) => {
    try {
        const { jobUrl } = req.body;
        console.log("🔹 Received find-keywords request:", req.body);

        if (!jobUrl) {
            return res.status(400).json({ error: "Job URL is required." });
        }

        console.log("🔹 Scraping job description from:", jobUrl);
        const jobDescription = await scrapeJobDescription(jobUrl);

        // Dummy placeholder – replace with real keyword extraction if needed
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
