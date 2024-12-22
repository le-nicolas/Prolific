// app.js

document.addEventListener("DOMContentLoaded", () => {
    const currentDayDisplay = document.getElementById("day-display");
    const prevDayButton = document.getElementById("prev-day");
    const nextDayButton = document.getElementById("next-day");
    const refreshButton = document.getElementById("refresh");
    const blogInput = document.getElementById("blog-input");
    const saveBlogButton = document.getElementById("save-blog");
    const barcodeChartCtx = document.getElementById("barcode-chart").getContext("2d");
    const keystrokeChartCtx = document.getElementById("keystroke-chart").getContext("2d");

    let currentDate = new Date();

    // Function to format date as YYYY-MM-DD
    function formatDate(date) {
        return date.toISOString().split("T")[0];
    }

    // Update displayed day
    function updateDayDisplay() {
        currentDayDisplay.textContent = formatDate(currentDate);
        loadDataForDay(formatDate(currentDate));
    }

    // Load data for the selected day
    function loadDataForDay(date) {
        fetch(`/api/data?date=${date}`)
            .then(response => response.json())
            .then(data => {
                renderCharts(data);
                if (data.blog) {
                    blogInput.value = data.blog;
                } else {
                    blogInput.value = "";
                }
            })
            .catch(error => console.error("Error fetching data:", error));
    }

    // Save the blog for the day
    saveBlogButton.addEventListener("click", () => {
        const blogContent = blogInput.value;
        fetch(`/api/blog`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                date: formatDate(currentDate),
                blog: blogContent
            })
        })
            .then(response => {
                if (response.ok) {
                    alert("Blog saved successfully!");
                } else {
                    alert("Failed to save blog.");
                }
            })
            .catch(error => console.error("Error saving blog:", error));
    });

    // Render charts
    function renderCharts(data) {
        // Barcode chart
        new Chart(barcodeChartCtx, {
            type: "bar",
            data: {
                labels: data.barcode.labels,
                datasets: [{
                    label: "Time Spent (mins)",
                    data: data.barcode.values,
                    backgroundColor: "rgba(54, 162, 235, 0.5)",
                    borderColor: "rgba(54, 162, 235, 1)",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });

        // Keystroke chart
        new Chart(keystrokeChartCtx, {
            type: "line",
            data: {
                labels: data.keystrokes.labels,
                datasets: [{
                    label: "Keystrokes",
                    data: data.keystrokes.values,
                    backgroundColor: "rgba(255, 99, 132, 0.5)",
                    borderColor: "rgba(255, 99, 132, 1)",
                    borderWidth: 1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }

    // Event listeners for day navigation
    prevDayButton.addEventListener("click", () => {
        currentDate.setDate(currentDate.getDate() - 1);
        updateDayDisplay();
    });

    nextDayButton.addEventListener("click", () => {
        currentDate.setDate(currentDate.getDate() + 1);
        updateDayDisplay();
    });

    refreshButton.addEventListener("click", () => {
        updateDayDisplay();
    });

    // Initialize the app
    updateDayDisplay();
});
