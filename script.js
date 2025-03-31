document.addEventListener("DOMContentLoaded", function () {
  const shiftTimes = {
    1: { start: "09:45", end: "19:00", name: "Morning Shift" },
    2: { start: "14:00", end: "23:00", name: "Afternoon Shift" },
    5: { start: "11:30", end: "20:30", name: "Mid Shift" },
    folga: { name: "Day Off" },
    ferias: { name: "Vacation" },
  };

  let selectedYear = new Date().getFullYear();
  let selectedMonth = new Date().getMonth();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;

      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      tabContents.forEach((content) => content.classList.remove("active"));
      document.getElementById(`${tabName}-tab`).classList.add("active");
    });
  });

  document.getElementById("current-year").textContent = selectedYear;
  document.getElementById("prev-year").addEventListener("click", () => {
    selectedYear--;
    document.getElementById("current-year").textContent = selectedYear;
    updateMonthButtons();
  });
  document.getElementById("next-year").addEventListener("click", () => {
    selectedYear++;
    document.getElementById("current-year").textContent = selectedYear;
    updateMonthButtons();
  });

  function generateMonthButtons() {
    const monthSelector = document.getElementById("month-selector");
    monthSelector.innerHTML = "";

    monthNames.forEach((month, index) => {
      const btn = document.createElement("div");
      btn.className = "month-btn";
      btn.textContent = month;
      btn.dataset.month = index;

      if (index === selectedMonth) {
        btn.classList.add("selected");
      }

      btn.addEventListener("click", () => {
        document.querySelectorAll(".month-btn").forEach((b) => {
          b.classList.remove("selected");
        });
        btn.classList.add("selected");
        selectedMonth = index;
        generateDayInputs();
      });

      monthSelector.appendChild(btn);
    });
  }

  function updateMonthButtons() {
    document.querySelectorAll(".month-btn").forEach((btn, index) => {
      if (index === selectedMonth) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    });
    generateDayInputs();
  }

  function generateDayInputs() {
    const scheduleGrid = document.getElementById("schedule-grid");
    scheduleGrid.innerHTML = "";

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayInput = document.createElement("div");
      dayInput.className = "day-input";

      const date = new Date(selectedYear, selectedMonth, day);
      const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });

      const label = document.createElement("label");
      label.textContent = `${day} (${dayOfWeek})`;
      dayInput.appendChild(label);

      const select = document.createElement("select");
      select.id = `day-${day}`;
      select.name = `day-${day}`;

      const options = ["", "1", "2", "5", "folga", "ferias"];
      options.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option === "" ? "Select" : option;
        select.appendChild(opt);
      });

      dayInput.appendChild(select);
      scheduleGrid.appendChild(dayInput);
    }
  }

  document
    .getElementById("generate")
    .addEventListener("click", generateCalendar);

  function generateCalendar() {
    const resultDiv = document.getElementById("result");
    const schedule = {};

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const shiftCode = document.getElementById(`day-${day}`).value;
      if (shiftCode) {
        schedule[day] = shiftCode;
      }
    }

    if (Object.keys(schedule).length === 0) {
      resultDiv.innerHTML =
        "<p style='color: red;'>Please select at least one shift</p>";
      return;
    }

    try {
      const icsContent = generateICS(
        schedule,
        selectedYear,
        selectedMonth,
        shiftTimes
      );

      const blob = new Blob([icsContent], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const monthName = monthNames[selectedMonth];

      resultDiv.innerHTML = `
        <p>Calendar generated successfully!</p>
        <p><a href="${url}" download="work_schedule_${monthName}_${selectedYear}.ics" class="download-link">
          Download ${monthName} ${selectedYear} Schedule
        </a></p>
      `;
    } catch (error) {
      resultDiv.innerHTML = `<p style='color: red;'>Error: ${error.message}</p>`;
    }
  }

  const csvFileInput = document.getElementById("csv-file");

  document
    .getElementById("generate-from-csv")
    .addEventListener("click", generateFromCSV);

  csvFileInput.addEventListener("change", handleCSVFileUpload);

  function handleCSVFileUpload(event) {
    const file = event.target.files[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = function (e) {
        const csvData = e.target.result;
        document.getElementById("csv-data").value = csvData; // Populate textarea
      };

      reader.onerror = function () {
        alert("Error reading the CSV file.");
      };

      reader.readAsText(file);
    }
  }

  function generateFromCSV() {
    const csvData = document.getElementById("csv-data").value;
    const personName = document.getElementById("person-name").value.trim();
    const yearInput = document.getElementById("year-input").value;
    const resultDiv = document.getElementById("csv-result");

    if (!csvData) {
      resultDiv.innerHTML =
        "<p style='color: red;'>Please paste CSV data or upload a CSV file</p>";
      return;
    }

    if (!personName) {
      resultDiv.innerHTML =
        "<p style='color: red;'>Please enter a person name</p>";
      return;
    }

    try {
      const schedule = parseCSVSchedule(csvData, personName, yearInput);

      if (Object.keys(schedule).length === 0) {
        resultDiv.innerHTML = `<p style='color: red;'>Could not find schedule for "${personName}" or no shifts were assigned</p>`;
        return;
      }

      const previewHTML = generateSchedulePreview(schedule);

      const icsContent = generateICSFromCSV(schedule, shiftTimes);

      const blob = new Blob([icsContent], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);

      resultDiv.innerHTML = `
        <div class="schedule-preview">
          <h3>Schedule Preview for ${personName}</h3>
          ${previewHTML}
        </div>
        <p>Calendar generated successfully!</p>
        <p><a href="${url}" download="work_schedule_${personName}.ics" class="download-link">
          Download ${personName}'s Schedule
        </a></p>
      `;
    } catch (error) {
      resultDiv.innerHTML = `<p style='color: red;'>Error: ${error.message}</p>`;
      console.error(error);
    }
  }

  function parseCSVSchedule(csvData, personName, defaultYear) {
    const schedule = {};
    const lines = csvData.split("\n");

    let currentWeek = null;
    let currentYear = defaultYear || new Date().getFullYear();
    let weekDates = [];
    let foundPerson = false;
    let dayHeaders = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      const weekMatch = line.match(
        /SEMANA\s+Nº\s+(\d+).*?(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/
      );
      if (weekMatch) {
        currentWeek = weekMatch[1];

        const startDateStr = weekMatch[2];
        const endDateStr = weekMatch[3];

        const startDateParts = startDateStr.split("/");
        const endDateParts = endDateStr.split("/");

        if (startDateParts.length === 3 && endDateParts.length === 3) {
          const startDay = parseInt(startDateParts[0]);
          const startMonth = parseInt(startDateParts[1]) - 1;
          const startYear = parseInt(startDateParts[2]);

          const endDay = parseInt(endDateParts[0]);
          const endMonth = parseInt(endDateParts[1]) - 1;
          const endYear = parseInt(endDateParts[2]);

          currentYear = startYear;

          weekDates = [];
          const startDate = new Date(startYear, startMonth, startDay);
          const endDate = new Date(endYear, endMonth, endDay);

          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            weekDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }

        foundPerson = false;
        continue;
      }

      const dayHeadersLine = line.match(
        /SEGUNDA\s+(\d+).*TERÇA\s+(\d+).*QUARTA\s+(\d+).*QUINTA\s+(\d+).*SEXTA\s+(\d+).*SABADO\s+(\d+).*DOMINGO\s+(\d+)/i
      );
      if (dayHeadersLine) {
        dayHeaders = [
          parseInt(dayHeadersLine[1]),
          parseInt(dayHeadersLine[2]),
          parseInt(dayHeadersLine[3]),
          parseInt(dayHeadersLine[4]),
          parseInt(dayHeadersLine[5]),
          parseInt(dayHeadersLine[6]),
          parseInt(dayHeadersLine[7]),
        ];
        continue;
      }

      const personMatch = line.match(new RegExp(`${personName}`, "i"));
      if (personMatch && weekDates.length > 0) {
        foundPerson = true;

        const parts = line.split(",");

        let startIndex = -1;
        for (let j = 0; j < parts.length; j++) {
          if (parts[j].trim().toLowerCase() === personName.toLowerCase()) {
            startIndex = j + 1;
            break;
          }
        }

        if (startIndex > 0) {
          for (let day = 0; day < 7; day++) {
            const firstShiftIndex = startIndex + day * 2;
            if (firstShiftIndex < parts.length) {
              let shiftValue = parts[firstShiftIndex].trim().toLowerCase();

              if (!shiftValue || shiftValue === "" || /^\s*$/.test(shiftValue))
                continue;

              if (
                shiftValue === "" ||
                shiftValue === " " ||
                shiftValue === "," ||
                shiftValue === "."
              )
                continue;

              let shiftCode;

              if (shiftValue.includes("folga")) {
                shiftCode = "folga";
              } else if (shiftValue.includes("ferias")) {
                shiftCode = "ferias";
              } else if (["1", "2", "5"].includes(shiftValue)) {
                shiftCode = shiftValue;
              } else {
                continue;
              }

              if (day < weekDates.length) {
                const date = weekDates[day];
                if (date) {
                  const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1)
                    .toString()
                    .padStart(2, "0")}-${date
                    .getDate()
                    .toString()
                    .padStart(2, "0")}`;
                  schedule[dateKey] = shiftCode;
                }
              }
            }
          }
        }
      }
    }

    if (Object.keys(schedule).length > 0) {
      const sortedDates = Object.keys(schedule).sort();
      if (sortedDates.length > 0) {
        delete schedule[sortedDates[0]];
      }
    }

    return schedule;
  }

  function generateSchedulePreview(schedule) {
    // Sort dates
    const sortedDates = Object.keys(schedule).sort();

    if (sortedDates.length === 0) {
      return "<p>No schedule data found.</p>";
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Shift</th>
          </tr>
        </thead>
        <tbody>
    `;

    sortedDates.forEach((dateStr) => {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
      const formattedDate = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const shiftCode = schedule[dateStr];
      let shiftDescription;

      switch (shiftCode) {
        case "1":
          shiftDescription = "Morning Shift (09:45 - 19:00)";
          break;
        case "2":
          shiftDescription = "Afternoon Shift (14:00 - 23:00)";
          break;
        case "5":
          shiftDescription = "Mid Shift (11:30 - 20:30)";
          break;
        case "folga":
          shiftDescription = "Day Off";
          break;
        case "ferias":
          shiftDescription = "Vacation";
          break;
        default:
          shiftDescription = shiftCode;
      }

      html += `
        <tr>
          <td>${formattedDate}</td>
          <td>${dayOfWeek}</td>
          <td>${shiftDescription}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    return html;
  }

  function generateICSFromCSV(schedule, shiftTimes) {
    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Work Schedule Calendar Generator//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const dateStr in schedule) {
      const shiftCode = schedule[dateStr];
      if (!shiftCode) continue;

      const shift = shiftTimes[shiftCode];
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const dateString = formatDate(date);

      icsContent.push("BEGIN:VEVENT");
      icsContent.push(`UID:${dateString}-${shiftCode}@workschedule`);
      icsContent.push(`DTSTAMP:${formatDateTime(new Date())}`);

      if (shiftCode === "folga" || shiftCode === "ferias") {
        icsContent.push(`DTSTART;VALUE=DATE:${dateString}`);
        icsContent.push(
          `DTEND;VALUE=DATE:${formatDate(new Date(year, month - 1, day + 1))}`
        );
        icsContent.push(`SUMMARY:${shift.name}`);
      } else {
        const startDateTime = new Date(
          year,
          month - 1,
          day,
          ...shift.start.split(":").map(Number)
        );
        const endDateTime = new Date(
          year,
          month - 1,
          day,
          ...shift.end.split(":").map(Number)
        );

        icsContent.push(`DTSTART:${formatDateTime(startDateTime)}`);
        icsContent.push(`DTEND:${formatDateTime(endDateTime)}`);
        icsContent.push(
          `SUMMARY:${shift.name} (${shift.start} - ${shift.end})`
        );
      }

      icsContent.push("END:VEVENT");
    }

    icsContent.push("END:VCALENDAR");
    return icsContent.join("\r\n");
  }

  function generateICS(schedule, year, month, shiftTimes) {
    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Work Schedule Calendar Generator//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const shiftCode = schedule[day];
      if (!shiftCode) continue;

      const shift = shiftTimes[shiftCode];
      const date = new Date(year, month, day);
      const dateString = formatDate(date);

      icsContent.push("BEGIN:VEVENT");
      icsContent.push(`UID:${dateString}-${shiftCode}@workschedule`);
      icsContent.push(`DTSTAMP:${formatDateTime(new Date())}`);

      if (shiftCode === "folga" || shiftCode === "ferias") {
        icsContent.push(`DTSTART;VALUE=DATE:${dateString}`);
        icsContent.push(
          `DTEND;VALUE=DATE:${formatDate(new Date(year, month, day + 1))}`
        );
        icsContent.push(`SUMMARY:${shift.name}`);
      } else {
        const startDateTime = new Date(
          year,
          month,
          day,
          ...shift.start.split(":").map(Number)
        );
        const endDateTime = new Date(
          year,
          month,
          day,
          ...shift.end.split(":").map(Number)
        );

        icsContent.push(`DTSTART:${formatDateTime(startDateTime)}`);
        icsContent.push(`DTEND:${formatDateTime(endDateTime)}`);
        icsContent.push(
          `SUMMARY:${shift.name} (${shift.start} - ${shift.end})`
        );
      }

      icsContent.push("END:VEVENT");
    }

    icsContent.push("END:VCALENDAR");
    return icsContent.join("\r\n");
  }

  function formatDate(date) {
    return date.toISOString().replace(/[-:]/g, "").split("T")[0];
  }

  function formatDateTime(date) {
    return date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  }

  generateMonthButtons();
  generateDayInputs();
});
