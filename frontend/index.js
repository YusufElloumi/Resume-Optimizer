const API_BASE = "https://resume-optimizer-hfgk.onrender.com";

document.getElementById("findKeywordsBtn").addEventListener("click", async () => {
    const jobUrl = document.getElementById("jobUrlInput").value.trim();
    const statusMessage = document.getElementById("statusMessage");
    const keywordInput = document.getElementById("keywordsInput");

    if (!jobUrl) {
        alert("Please enter a job application URL!");
        return;
    }

    statusMessage.innerText = "⏳ Finding keywords...";

    try {
        const response = await fetch(`${API_BASE}/find-keywords`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ jobUrl })
        });

        console.log("🔹 Raw response:", response);

        if (!response.ok) {
            const errorData = await response.json();
            console.log("❌ Backend error:", errorData);
            throw new Error(errorData.error || "Failed to extract keywords");
        }

        const data = await response.json();
        console.log("✅ Full response data:", data);
        console.log("✅ Extracted keywords:", data.keywords);

        if (Array.isArray(data.keywords) && data.keywords.length > 0) {
            keywordInput.value = data.keywords.join(", ");
        } else {
            keywordInput.value = "";
            console.warn("⚠️ No keywords extracted.");
        }

        statusMessage.innerText = "✅ Keywords extracted! You can edit or add more.";
    } catch (error) {
        console.error("❌ Error fetching keywords:", error);
        statusMessage.innerText = "❌ Failed to find keywords.";
    }
});

document.getElementById("keywordsInput").addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
});

document.getElementById("optimizeBtn").addEventListener("click", async () => {
    const resumeFile = document.getElementById("resumeInput").files[0];
    const keywords = document.getElementById("keywordsInput").value.trim();
    const statusMessage = document.getElementById("statusMessage");

    if (!keywords) {
        alert("Keyword input field is empty! Please enter or find keywords.");
        return;
    }

    if (!resumeFile) {
        alert("Please upload your resume (PDF format)!");
        return;
    }

    const formData = new FormData();
    formData.append("resume", resumeFile);
    formData.append("keywords", keywords);

    statusMessage.innerHTML = "⏳ Optimizing resume...";

    try {
        const response = await fetch(`${API_BASE}/optimize`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Failed to optimize resume");

        const blob = await response.blob();
        const fileUrl = URL.createObjectURL(blob);
        window.open(fileUrl, "_blank");

        statusMessage.innerHTML = "✅ Resume optimized and ready to preview!";
    } catch (error) {
        console.error("Error:", error);
        statusMessage.innerHTML = "❌ Failed to optimize resume.";
    }
});
