document.getElementById("findKeywordsBtn").addEventListener("click", async () => {
    const jobUrl = document.getElementById("jobUrlInput").value.trim();

    if (!jobUrl) {
        alert("Please enter a job application URL!");
        return;
    }

    console.log("🔹 Sending job URL to backend:", jobUrl);

    const requestBody = JSON.stringify({ jobUrl: jobUrl });

    document.getElementById("statusMessage").innerText = "Finding keywords...";

    try {
        const response = await fetch("http://localhost:5000/find-keywords", {
            method: "POST",
            headers: {
                "Content-Type": "application/json" // ✅ Ensures JSON format
            },
            body: requestBody
        });

        console.log("🔹 Server response status:", response.status);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to extract keywords");
        }

        const data = await response.json();
        console.log("✅ Extracted Keywords:", data.keywords);

        // ✅ Fill the input field with the extracted keywords
        document.getElementById("keywordsInput").value = data.keywords;
        document.getElementById("statusMessage").innerText = "✅ Keywords extracted! You can edit or add more.";

    } catch (error) {
        console.error("❌ Error fetching keywords:", error);
        document.getElementById("statusMessage").innerText = "❌ Failed to find keywords.";
    }
});

document.getElementById("keywordsInput").addEventListener("input", function () {
    this.style.height = "auto"; // Reset height
    this.style.height = (this.scrollHeight) + "px"; // Expand based on content
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
        const response = await fetch("http://localhost:5000/optimize-resume", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Failed to optimize resume");

        const data = await response.json();
        const downloadLink = document.createElement("a");
        downloadLink.href = data.downloadUrl;
        downloadLink.target = "_blank";
        downloadLink.innerText = "📥 Download Optimized Resume";
        
        document.getElementById("downloadSection").innerHTML = "";
        document.getElementById("downloadSection").appendChild(downloadLink);
        statusMessage.innerHTML = "✅ Resume optimized!";
    } catch (error) {
        console.error("Error:", error);
        statusMessage.innerHTML = "❌ Failed to optimize resume.";
    }
});
