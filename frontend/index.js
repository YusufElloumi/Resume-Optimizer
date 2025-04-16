// Base URL of the backend API
const API_BASE = "https://resume-optimizer-hfgk.onrender.com";

// Event listener for the "Find Keywords" button
document.getElementById("findKeywordsBtn").addEventListener("click", async () => {
    // Get the job posting URL entered by the user
    const jobUrl = document.getElementById("jobUrlInput").value.trim();
    const statusMessage = document.getElementById("statusMessage");
    const keywordInput = document.getElementById("keywordsInput");

    // If no URL is entered, alert the user and stop the function
    if (!jobUrl) {
        alert("Please enter a job application URL!");
        return;
    }

    // Show status message while processing
    statusMessage.innerText = "⏳ Finding keywords...";

    try {
        // Send POST request to backend to extract keywords from the job URL
        const response = await fetch(`${API_BASE}/find-keywords`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ jobUrl }) // send job URL in the body
        });

        // Log raw response for debugging
        console.log("🔹 Raw response:", response);

        // If the response is not OK, handle and log the error
        if (!response.ok) {
            const errorData = await response.json();
            console.log("❌ Backend error:", errorData);
            throw new Error(errorData.error || "Failed to extract keywords");
        }

        // Parse response JSON to get extracted keywords
        const data = await response.json();
        console.log("✅ Full response data:", data);
        console.log("✅ Extracted keywords:", data.keywords);

        // If keywords were found, display them in the input field
        if (Array.isArray(data.keywords) && data.keywords.length > 0) {
            keywordInput.value = data.keywords.join(", ");
        } else {
            keywordInput.value = ""; // Clear input if no keywords found
            console.warn("⚠️ No keywords extracted.");
        }

        // Update the status to reflect successful keyword extraction
        statusMessage.innerText = "✅ Keywords extracted! You can edit or add more.";
    } catch (error) {
        // Catch and show any errors that occur
        console.error("❌ Error fetching keywords:", error);
        statusMessage.innerText = "❌ Failed to find keywords.";
    }
});

// Auto-resize the keyword input field as the user types
document.getElementById("keywordsInput").addEventListener("input", function () {
    this.style.height = "auto"; // Reset height to auto
    this.style.height = (this.scrollHeight) + "px"; // Adjust height to fit content
});

// Event listener for the "Optimize" button
document.getElementById("optimizeBtn").addEventListener("click", async () => {
    // Get the resume file and keywords entered by the user
    const resumeFile = document.getElementById("resumeInput").files[0];
    const keywords = document.getElementById("keywordsInput").value.trim();
    const statusMessage = document.getElementById("statusMessage");

    // Alert the user if the keyword field is empty
    if (!keywords) {
        alert("Keyword input field is empty! Please enter or find keywords.");
        return;
    }

    // Alert the user if no resume is uploaded
    if (!resumeFile) {
        alert("Please upload your resume (PDF format)!");
        return;
    }

    // Prepare form data to send to the backend
    const formData = new FormData();
    formData.append("resume", resumeFile);
    formData.append("keywords", keywords);

    // Update the status while resume is being optimized
    statusMessage.innerHTML = "⏳ Optimizing resume...";

    try {
        // Send resume and keywords to backend for optimization
        const response = await fetch(`${API_BASE}/optimize`, {
            method: "POST",
            body: formData
        });

        // Handle failure to optimize
        if (!response.ok) throw new Error("Failed to optimize resume");

        // Convert the optimized resume blob to a URL and open it in a new tab
        const blob = await response.blob();
        const fileUrl = URL.createObjectURL(blob);
        window.open(fileUrl, "_blank");

        // Success message
        statusMessage.innerHTML = "✅ Resume optimized and ready to preview!";
    } catch (error) {
        // Handle and show any errors that occur
        console.error("Error:", error);
        statusMessage.innerHTML = "❌ Failed to optimize resume.";
    }
});
