document.addEventListener("DOMContentLoaded", function () {
    const excelFileInput = document.getElementById("excel-file");
    const sheetSelect = document.getElementById("sheet-select");
    const convertButton = document.getElementById("convert-excel");
    const csvOutput = document.getElementById("csv-output");
    const csvOutputContainer = document.getElementById("csv-output-container");
    const copyButton = document.getElementById("copy-csv");
    const useInCsvTabButton = document.getElementById("use-in-csv-tab");
    const excelResult = document.getElementById("excel-result");
  
    let workbook = null;
  
    excelFileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
  
      if (
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".xls") &&
        !file.type.includes("excel") &&
        !file.type.includes("spreadsheet")
      ) {
        excelResult.innerHTML =
          "<p style='color: red;'>Please upload a valid Excel file (.xlsx or .xls)</p>";
        return;
      }
  
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
            
          const data = new Uint8Array(e.target.result);
          workbook = XLSX.read(data, { type: "array" });
  
          sheetSelect.innerHTML = "";
          workbook.SheetNames.forEach((sheetName) => {
            const option = document.createElement("option");
            option.value = sheetName;
            option.textContent = sheetName;
            sheetSelect.appendChild(option);
          });
  
          sheetSelect.disabled = false;
          convertButton.disabled = false;
          excelResult.innerHTML =
            "<p style='color: green;'>Excel file loaded successfully. Select a sheet and click 'Convert to CSV'.</p>";
        } catch (error) {
          excelResult.innerHTML = `<p style='color: red;'>Error reading Excel file: ${error.message}</p>`;
          console.error(error);
        }
      };
  
      reader.onerror = function () {
        excelResult.innerHTML =
          "<p style='color: red;'>Error reading the file</p>";
      };
  
      reader.readAsArrayBuffer(file);
    });
  
    convertButton.addEventListener("click", function () {
      if (!workbook) {
        excelResult.innerHTML =
          "<p style='color: red;'>Please upload an Excel file first</p>";
        return;
      }
  
      const selectedSheet = sheetSelect.value;
      if (!selectedSheet) {
        excelResult.innerHTML =
          "<p style='color: red;'>Please select a sheet</p>";
        return;
      }
  
      try {

        const worksheet = workbook.Sheets[selectedSheet];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
  
        csvOutput.value = csvData;
        csvOutputContainer.style.display = "block";
        excelResult.innerHTML =
          "<p style='color: green;'>Conversion successful! You can now copy the CSV data.</p>";
      } catch (error) {
        excelResult.innerHTML = `<p style='color: red;'>Error converting to CSV: ${error.message}</p>`;
        console.error(error);
      }
    });
  
    copyButton.addEventListener("click", function () {
      csvOutput.select();
      document.execCommand("copy");
      excelResult.innerHTML =
        "<p style='color: green;'>CSV data copied to clipboard!</p>";
    });
  
    useInCsvTabButton.addEventListener("click", function () {
      const csvData = csvOutput.value;
      if (csvData) {
        document.getElementById("csv-data").value = csvData;
        
        const csvTabButton = document.querySelector('.tab-btn[data-tab="csv"]');
        csvTabButton.click();
        
        excelResult.innerHTML =
          "<p style='color: green;'>CSV data transferred to CSV Import tab!</p>";
      } else {
        excelResult.innerHTML =
          "<p style='color: red;'>No CSV data to transfer</p>";
      }
    });
  });
  