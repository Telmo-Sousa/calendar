/* ============================================================
   SHARED STATE & HELPERS
   ============================================================ */

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

const DOW_PT = [
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
  "Dom"
];


function defaultCodes() {
  return [
    {
      code: "1",
      name: "Turno 1",
      p1s: "09:45",
      p1e: "19:00",
      p2s: "",
      p2e: ""
    },
    {
      code: "2",
      name: "Turno 2",
      p1s: "13:45",
      p1e: "23:00",
      p2s: "",
      p2e: ""
    },
    {
      code: "3",
      name: "Turno 3",
      p1s: "15:00",
      p1e: "24:00",
      p2s: "",
      p2e: ""
    },
    {
      code: "5",
      name: "Turno 5",
      p1s: "11:15",
      p1e: "20:30",
      p2s: "",
      p2e: ""
    },
    {
      code: "folga",
      name: "Folga",
      p1s: "",
      p1e: "",
      p2s: "",
      p2e: "",
      special: "off"
    },
    {
      code: "ferias",
      name: "Férias",
      p1s: "",
      p1e: "",
      p2s: "",
      p2e: "",
      special: "vacation"
    }
  ];
}


let shiftCodes = defaultCodes();


function pad2(n) {
  return String(n).padStart(2, "0");
}


function escapeICS(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}


function uid() {
  return (
    "ev-" +
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2, 10) +
    "@horario-calendario.local"
  );
}


function dtstamp() {
  const d = new Date();

  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}


/*
  dateStr: YYYY-MM-DD
  timeStr: HH:MM
  Allows 24:00 meaning midnight next day.
*/

function floatingDateTime(dateStr, timeStr) {
  let [y, m, d] = dateStr.split("-").map(Number);
  let [hh, mm] = timeStr.split(":").map(Number);

  if (hh >= 24) {
    hh -= 24;

    const dt = new Date(y, m - 1, d + 1);

    y = dt.getFullYear();
    m = dt.getMonth() + 1;
    d = dt.getDate();
  }

  return (
    `${y}` +
    `${pad2(m)}` +
    `${pad2(d)}` +
    "T" +
    `${pad2(hh)}` +
    `${pad2(mm)}` +
    "00"
  );
}


function dateOnly(dateStr) {
  return dateStr.replace(/-/g, "");
}


function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);

  const dt = new Date(y, m - 1, d + n);

  return (
    `${dt.getFullYear()}-` +
    `${pad2(dt.getMonth() + 1)}-` +
    `${pad2(dt.getDate())}`
  );
}


/* ============================================================
   ICS
   ============================================================ */

function buildICS(events, calName) {
  const lines = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//horario-calendario//PT");
  lines.push("CALSCALE:GREGORIAN");
  lines.push(
    "X-WR-CALNAME:" +
    escapeICS(calName || "Horário de Trabalho")
  );

  events.forEach(ev => {

    if (
      ev.kind === "work" &&
      ev.periods &&
      ev.periods.length
    ) {

      ev.periods.forEach((p, i) => {

        lines.push("BEGIN:VEVENT");
        lines.push("UID:" + uid());
        lines.push("DTSTAMP:" + dtstamp());

        lines.push(
          "DTSTART:" +
          floatingDateTime(ev.date, p.start)
        );

        lines.push(
          "DTEND:" +
          floatingDateTime(ev.date, p.end)
        );

        const suffix =
          ev.periods.length > 1
            ? i === 0
              ? " (1/2)"
              : " (2/2)"
            : "";

        lines.push(
          "SUMMARY:" +
          escapeICS(
            (ev.label || "Trabalho") +
            " " +
            p.start +
            "–" +
            p.end +
            suffix
          )
        );

        lines.push("TRANSP:OPAQUE");
        lines.push("END:VEVENT");
      });

    } else {

      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + uid());
      lines.push("DTSTAMP:" + dtstamp());

      lines.push(
        "DTSTART;VALUE=DATE:" +
        dateOnly(ev.date)
      );

      lines.push(
        "DTEND;VALUE=DATE:" +
        dateOnly(addDaysStr(ev.date, 1))
      );

      lines.push(
        "SUMMARY:" +
        escapeICS(ev.label || "Dia inteiro")
      );

      lines.push("TRANSP:TRANSPARENT");
      lines.push("END:VEVENT");
    }
  });

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}


function downloadFile(filename, content, mime) {
  const blob = new Blob(
    [content],
    {
      type: mime || "text/plain"
    }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 4000);
}


/* ============================================================
   SHIFT CODE HELPERS
   ============================================================ */

function codeToPeriods(codeObj) {
  const periods = [];

  if (codeObj.p1s && codeObj.p1e) {
    periods.push({
      start: codeObj.p1s,
      end: codeObj.p1e
    });
  }

  if (codeObj.p2s && codeObj.p2e) {
    periods.push({
      start: codeObj.p2s,
      end: codeObj.p2e
    });
  }

  return periods;
}


function findCode(codeStr) {
  const c = String(codeStr)
    .trim()
    .toLowerCase();

  return shiftCodes.find(
    sc =>
      String(sc.code).toLowerCase() === c
  );
}


/* ============================================================
   TABS
   ============================================================ */

document.querySelectorAll(".tab-btn").forEach(btn => {

  btn.addEventListener("click", () => {

    document
      .querySelectorAll(".tab-btn")
      .forEach(b => b.classList.remove("active"));

    document
      .querySelectorAll(".panel")
      .forEach(p => p.classList.remove("active"));

    btn.classList.add("active");

    document
      .getElementById("panel-" + btn.dataset.tab)
      .classList.add("active");
  });

});


/* ============================================================
   SHIFT CODE TABLE
   ============================================================ */

function renderCodesTable() {

  const body = document.getElementById("codesBody");

  body.innerHTML = "";

  shiftCodes.forEach((c, idx) => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td data-label="Código">
        <input
          type="text"
          class="mono"
          data-i="${idx}"
          data-f="code"
          value="${escapeHtml(c.code)}"
          style="width:70px"
        >
      </td>

      <td data-label="Nome">
        <input
          type="text"
          data-i="${idx}"
          data-f="name"
          value="${escapeHtml(c.name)}"
        >
      </td>

      <td data-label="Início 1">
        <input
          type="text"
          class="mono"
          placeholder="HH:MM"
          data-i="${idx}"
          data-f="p1s"
          value="${escapeHtml(c.p1s)}"
        >
      </td>

      <td data-label="Fim 1">
        <input
          type="text"
          class="mono"
          placeholder="HH:MM"
          data-i="${idx}"
          data-f="p1e"
          value="${escapeHtml(c.p1e)}"
        >
      </td>

      <td data-label="Início 2">
        <input
          type="text"
          class="mono"
          placeholder="HH:MM"
          data-i="${idx}"
          data-f="p2s"
          value="${escapeHtml(c.p2s)}"
        >
      </td>

      <td data-label="Fim 2">
        <input
          type="text"
          class="mono"
          placeholder="HH:MM"
          data-i="${idx}"
          data-f="p2e"
          value="${escapeHtml(c.p2e)}"
        >
      </td>

      <td data-label="" class="remove-cell">
        <button
          class="btn remove-btn"
          data-i="${idx}"
          type="button"
        >
          Remover
        </button>
      </td>
    `;

    body.appendChild(tr);
  });


  body.querySelectorAll("input").forEach(inp => {

    inp.addEventListener("input", e => {

      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;

      shiftCodes[i][f] = e.target.value;

      syncCodesTable2();
      populateCodeSelectsInGrid();
    });


    inp.addEventListener("blur", e => {

      if (!isTimeField(e.target.dataset.f)) {
        return;
      }

      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;

      const norm =
        normalizeTimeInput(e.target.value);

      e.target.value = norm;

      shiftCodes[i][f] = norm;

      syncCodesTable2();
    });
  });


  /*
    IMPORTANT:
    The HTML uses .remove-btn.
    This must match the selector here.
  */

  body
    .querySelectorAll(".remove-btn")
    .forEach(button => {

      button.addEventListener("click", e => {

        const index =
          Number(e.currentTarget.dataset.i);

        removeShiftCode(index);
      });

    });
}


function removeShiftCode(index) {

  if (
    Number.isNaN(index) ||
    index < 0 ||
    index >= shiftCodes.length
  ) {
    return;
  }

  shiftCodes.splice(index, 1);

  renderCodesTable();
  syncCodesTable2();
  populateCodeSelectsInGrid();
}


function isTimeField(f) {
  return (
    f === "p1s" ||
    f === "p1e" ||
    f === "p2s" ||
    f === "p2e"
  );
}


/*
  Accepts:
  9:45
  0945
  24:00
  9h45
*/

function normalizeTimeInput(raw) {

  raw = String(raw || "").trim();

  if (!raw) {
    return "";
  }

  const m =
    raw.match(/^(\d{1,2})[:h.]?(\d{2})$/i);

  if (!m) {
    return raw;
  }

  const h = Number(m[1]);
  const mi = Number(m[2]);

  if (h > 24 || mi > 59) {
    return raw;
  }

  if (h === 24 && mi > 0) {
    return raw;
  }

  return pad2(h) + ":" + pad2(mi);
}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* ============================================================
   SECOND SHIFT CODE TABLE
   ============================================================ */

function syncCodesTable2() {

  const el =
    document.getElementById("codesTable2");

  let html = `
    <thead>
      <tr>
        <th style="width:14%">Código</th>
        <th style="width:20%">Nome</th>
        <th>Início 1</th>
        <th>Fim 1</th>
        <th>Início 2</th>
        <th>Fim 2</th>
        <th class="remove-column"></th>
      </tr>
    </thead>

    <tbody>
  `;


  shiftCodes.forEach((c, idx) => {

    html += `
      <tr>

        <td data-label="Código">
          <input
            type="text"
            class="mono"
            data-i="${idx}"
            data-f="code"
            value="${escapeHtml(c.code)}"
            style="width:70px"
          >
        </td>

        <td data-label="Nome">
          <input
            type="text"
            data-i="${idx}"
            data-f="name"
            value="${escapeHtml(c.name)}"
          >
        </td>

        <td data-label="Início 1">
          <input
            type="text"
            class="mono"
            placeholder="HH:MM"
            data-i="${idx}"
            data-f="p1s"
            value="${escapeHtml(c.p1s)}"
          >
        </td>

        <td data-label="Fim 1">
          <input
            type="text"
            class="mono"
            placeholder="HH:MM"
            data-i="${idx}"
            data-f="p1e"
            value="${escapeHtml(c.p1e)}"
          >
        </td>

        <td data-label="Início 2">
          <input
            type="text"
            class="mono"
            placeholder="HH:MM"
            data-i="${idx}"
            data-f="p2s"
            value="${escapeHtml(c.p2s)}"
          >
        </td>

        <td data-label="Fim 2">
          <input
            type="text"
            class="mono"
            placeholder="HH:MM"
            data-i="${idx}"
            data-f="p2e"
            value="${escapeHtml(c.p2e)}"
          >
        </td>

        <td data-label="" class="remove-cell">
          <button
            class="btn remove-btn"
            data-i="${idx}"
            type="button"
          >
            Remover
          </button>
        </td>

      </tr>
    `;
  });


  html += `
    </tbody>
  `;


  el.innerHTML = html;


  el.querySelectorAll("input").forEach(inp => {

    inp.addEventListener("input", e => {

      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;

      shiftCodes[i][f] = e.target.value;

      renderCodesTable();
    });


    inp.addEventListener("blur", e => {

      if (!isTimeField(e.target.dataset.f)) {
        return;
      }

      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;

      const norm =
        normalizeTimeInput(e.target.value);

      e.target.value = norm;

      shiftCodes[i][f] = norm;

      renderCodesTable();
    });

  });


  el
    .querySelectorAll(".remove-btn")
    .forEach(button => {

      button.addEventListener("click", e => {

        const index =
          Number(e.currentTarget.dataset.i);

        removeShiftCode(index);
      });

    });
}


/* ============================================================
   ADD SHIFT CODE
   ============================================================ */

document
  .getElementById("addCodeBtn")
  .addEventListener("click", () => {

    shiftCodes.push({
      code: String(shiftCodes.length + 1),
      name: "Novo turno",
      p1s: "",
      p1e: "",
      p2s: "",
      p2e: ""
    });

    renderCodesTable();
    syncCodesTable2();
    populateCodeSelectsInGrid();
  });


document
  .getElementById("addCodeBtn2")
  .addEventListener("click", () => {

    shiftCodes.push({
      code: String(shiftCodes.length + 1),
      name: "Novo turno",
      p1s: "",
      p1e: "",
      p2s: "",
      p2e: ""
    });

    renderCodesTable();
    syncCodesTable2();
    populateCodeSelectsInGrid();
  });


/* ============================================================
   TAB 1 — MANUAL ENTRY
   ============================================================ */

const manMonth =
  document.getElementById("manMonth");


MONTHS_PT.forEach((m, i) => {

  const opt =
    document.createElement("option");

  opt.value = i;
  opt.textContent = m;

  manMonth.appendChild(opt);
});


manMonth.value =
  new Date().getMonth();


const calDow =
  document.getElementById("calDow");


DOW_PT.forEach(d => {

  const el =
    document.createElement("div");

  el.className = "cal-dow";
  el.textContent = d;

  calDow.appendChild(el);
});


let calDaysMeta = [];


function populateCodeSelectsInGrid() {

  document
    .querySelectorAll(".cal-cell select")
    .forEach(sel => {

      const current = sel.value;

      sel.innerHTML =
        `<option value="">—</option>` +
        shiftCodes
          .map(
            c =>
              `<option value="${escapeHtml(c.code)}">
                ${escapeHtml(c.code)} · ${escapeHtml(c.name)}
              </option>`
          )
          .join("");

      if (
        shiftCodes.some(
          c => String(c.code) === String(current)
        )
      ) {
        sel.value = current;
      }
    });
}


function buildCalendarGrid() {

  const year =
    Number(
      document.getElementById("manYear").value
    );

  const month =
    Number(manMonth.value);

  const grid =
    document.getElementById("calGrid");

  grid.innerHTML = "";

  calDaysMeta = [];


  const firstDay =
    new Date(year, month, 1);


  const startOffset =
    (firstDay.getDay() + 6) % 7;


  const daysInMonth =
    new Date(year, month + 1, 0).getDate();


  for (
    let i = 0;
    i < startOffset;
    i++
  ) {

    const empty =
      document.createElement("div");

    empty.className =
      "cal-cell empty";

    grid.appendChild(empty);
  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const dateStr =
      `${year}-${pad2(month + 1)}-${pad2(day)}`;


    const cell =
      document.createElement("div");

    cell.className =
      "cal-cell";


    const num =
      document.createElement("div");

    num.className =
      "daynum";

    num.textContent =
      pad2(day);


    const sel =
      document.createElement("select");

    sel.dataset.date =
      dateStr;


    cell.appendChild(num);
    cell.appendChild(sel);

    grid.appendChild(cell);


    calDaysMeta.push({
      dateStr,
      sel
    });
  }


  populateCodeSelectsInGrid();
}


document
  .getElementById("buildCalBtn")
  .addEventListener(
    "click",
    buildCalendarGrid
  );


document
  .getElementById("fillAllBtn")
  .addEventListener(
    "click",
    () => {

      if (!shiftCodes.length) {
        return;
      }


      const codeStr =
        prompt(
          "Código a aplicar a Seg–Sex (deixa os fins de semana como estão):",
          shiftCodes[0].code
        );


      if (codeStr === null) {
        return;
      }


      calDaysMeta.forEach(
        ({ dateStr, sel }) => {

          const d =
            new Date(
              dateStr + "T00:00:00"
            );

          const dow =
            d.getDay();


          if (
            dow !== 0 &&
            dow !== 6
          ) {
            sel.value = codeStr;
          }
        }
      );
    }
  );


document
  .getElementById("genManualBtn")
  .addEventListener(
    "click",
    () => {

      const statusEl =
        document.getElementById(
          "manualStatus"
        );


      if (!calDaysMeta.length) {

        statusEl.className =
          "status err";

        statusEl.textContent =
          "Gera primeiro a grelha do mês.";

        return;
      }


      const events = [];


      calDaysMeta.forEach(
        ({ dateStr, sel }) => {

          const val = sel.value;

          if (!val) {
            return;
          }


          const codeObj =
            findCode(val);

          if (!codeObj) {
            return;
          }


          if (
            codeObj.special === "off"
          ) {

            events.push({
              date: dateStr,
              kind: "off",
              label: "Folga"
            });

          } else if (
            codeObj.special === "vacation"
          ) {

            events.push({
              date: dateStr,
              kind: "vacation",
              label: "Férias"
            });

          } else {

            const periods =
              codeToPeriods(codeObj);


            if (periods.length) {

              events.push({
                date: dateStr,
                kind: "work",
                label: codeObj.name,
                periods
              });

            } else {

              events.push({
                date: dateStr,
                kind: "label",
                label: codeObj.name
              });
            }
          }
        }
      );


      if (!events.length) {

        statusEl.className =
          "status err";

        statusEl.textContent =
          "Não atribuíste nenhum código a nenhum dia.";

        return;
      }


      const monthName =
        MONTHS_PT[
          Number(manMonth.value)
        ];


      const year =
        document.getElementById(
          "manYear"
        ).value;


      const ics =
        buildICS(
          events,
          `Horário — ${monthName} ${year}`
        );


      downloadFile(
        `horario-${monthName.toLowerCase()}-${year}.ics`,
        ics,
        "text/calendar"
      );


      statusEl.className =
        "status ok";

      statusEl.textContent =
        `Calendário gerado com ${events.length} dia(s). Ficheiro descarregado.`;
    }
  );


/* ============================================================
   CSV PARSER
   ============================================================ */

function parseCSV(text) {

  const rows = [];

  let row = [];
  let field = "";
  let inQuotes = false;


  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const c = text[i];


    if (inQuotes) {

      if (c === '"') {

        if (text[i + 1] === '"') {

          field += '"';
          i++;

        } else {

          inQuotes = false;
        }

      } else {

        field += c;
      }

    } else {

      if (c === '"') {

        inQuotes = true;

      } else if (c === ",") {

        row.push(field);
        field = "";

      } else if (c === "\n") {

        row.push(field);

        rows.push(row);

        row = [];
        field = "";

      } else {

        field += c;
      }
    }
  }


  if (
    field.length ||
    row.length
  ) {

    row.push(field);
    rows.push(row);
  }


  return rows.filter(
    r =>
      r.some(
        c => c.trim() !== ""
      )
  );
}


function guessColumn(
  headers,
  patterns
) {

  for (
    let i = 0;
    i < headers.length;
    i++
  ) {

    const h =
      headers[i]
        .toLowerCase()
        .trim();


    if (
      patterns.some(
        p => p.test(h)
      )
    ) {
      return i;
    }
  }


  return -1;
}


function resolveCellValue(raw) {

  if (
    raw === undefined ||
    raw === null
  ) {
    return null;
  }


  raw = String(raw).trim();


  if (!raw) {
    return null;
  }


  if (/f[ée]rias/i.test(raw)) {

    return {
      type: "vacation",
      label: "Férias"
    };
  }


  if (/folga/i.test(raw)) {

    return {
      type: "off",
      label: "Folga"
    };
  }


  if (raw.includes("|")) {

    const [s, e] =
      raw
        .split("|")
        .map(x => x.trim());


    if (
      /^\d{1,2}:\d{2}$/.test(s) &&
      /^\d{1,2}:\d{2}$/.test(e)
    ) {

      return {
        type: "time",
        start: s,
        end: e
      };
    }
  }


  if (
    /^\d{1,2}:\d{2}$/.test(raw)
  ) {

    return {
      type: "time-single",
      value: raw
    };
  }


  if (
    /^\d+(\.\d+)?$/.test(raw)
  ) {

    const codeObj =
      findCode(raw);


    if (codeObj) {

      if (
        codeObj.special === "off"
      ) {

        return {
          type: "off",
          label: "Folga"
        };
      }


      if (
        codeObj.special === "vacation"
      ) {

        return {
          type: "vacation",
          label: "Férias"
        };
      }


      const periods =
        codeToPeriods(codeObj);


      if (periods.length) {

        return {
          type: "work",
          label: codeObj.name,
          periods
        };
      }
    }


    return {
      type: "unknown",
      label: "Código " + raw
    };
  }


  return {
    type: "label",
    label: raw
  };
}


let csvRows = [];

let csvHeaderMode = "full";


function handleCsvParse(text) {

  const rows =
    parseCSV(text);


  const statusEl =
    document.getElementById(
      "csvStatus"
    );


  if (!rows.length) {

    statusEl.className =
      "status err";

    statusEl.textContent =
      "CSV vazio ou ilegível.";

    return;
  }


  const headers =
    rows[0].map(
      h => h.trim()
    );


  const dataRows =
    rows.slice(1);


  const dateCol =
    guessColumn(
      headers,
      [/data/i, /date/i]
    );


  const nameCol =
    guessColumn(
      headers,
      [/nome/i, /name/i, /funcion/i]
    );


  const p1Col =
    guessColumn(
      headers,
      [
        /periodo ?1/i,
        /period ?1/i,
        /1.?p/i,
        /turno ?1/i,
        /c[oó]digo/i,
        /code/i,
        /turno$/i,
        /shift/i
      ]
    );


  const p2Col =
    guessColumn(
      headers,
      [
        /periodo ?2/i,
        /period ?2/i,
        /2.?p/i,
        /turno ?2/i
      ]
    );


  csvRows = [];


  if (dateCol === -1) {

    statusEl.className =
      "status err";

    statusEl.textContent =
      "Não encontrei uma coluna de Data. Confirma o cabeçalho (ex: Data,Nome,Periodo1,Periodo2).";

    return;
  }


  dataRows.forEach(r => {

    const dateRaw =
      (r[dateCol] || "").trim();


    if (!dateRaw) {
      return;
    }


    const date =
      normalizeDateStr(dateRaw);


    if (!date) {
      return;
    }


    const name =
      nameCol !== -1
        ? (r[nameCol] || "").trim()
        : "";


    const p1 =
      p1Col !== -1
        ? (r[p1Col] || "").trim()
        : "";


    const p2 =
      p2Col !== -1
        ? (r[p2Col] || "").trim()
        : "";


    csvRows.push({
      date,
      name,
      p1,
      p2
    });
  });


  csvHeaderMode =
    nameCol !== -1
      ? "full"
      : "simple";


  if (!csvRows.length) {

    statusEl.className =
      "status err";

    statusEl.textContent =
      "Não consegui interpretar nenhuma linha do CSV.";

    return;
  }


  const nameRow =
    document.getElementById(
      "csvNameRow"
    );


  const nameSel =
    document.getElementById(
      "csvNameSelect"
    );


  if (
    csvHeaderMode === "full"
  ) {

    const names = [
      ...new Set(
        csvRows
          .map(r => r.name)
          .filter(Boolean)
      )
    ];


    nameSel.innerHTML =
      names
        .map(
          n =>
            `<option value="${escapeHtml(n)}">
              ${escapeHtml(n)}
            </option>`
        )
        .join("");


    nameRow.style.display =
      names.length > 1
        ? "flex"
        : "none";

  } else {

    nameRow.style.display =
      "none";
  }


  renderCsvPreview();


  document.getElementById(
    "genCsvBtn"
  ).disabled = false;


  statusEl.className =
    "status ok";

  statusEl.textContent =
    `${csvRows.length} linha(s) lida(s).`;
}


function normalizeDateStr(raw) {

  raw = raw.trim();

  let m;


  if (
    (m =
      raw.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/
      ))
  ) {

    return (
      `${m[1]}-` +
      `${pad2(m[2])}-` +
      `${pad2(m[3])}`
    );
  }


  if (
    (m =
      raw.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      ))
  ) {

    return (
      `${m[3]}-` +
      `${pad2(m[2])}-` +
      `${pad2(m[1])}`
    );
  }


  if (
    (m =
      raw.match(
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/
      ))
  ) {

    return (
      `${m[3]}-` +
      `${pad2(m[2])}-` +
      `${pad2(m[1])}`
    );
  }


  return null;
}


function renderCsvPreview() {

  const rows =
    currentCsvSelection();


  const wrap =
    document.getElementById(
      "csvPreviewWrap"
    );


  const table =
    document.getElementById(
      "csvPreviewTable"
    );


  wrap.style.display =
    "block";


  let html = `
    <thead>
      <tr>
        <th>Data</th>
        ${
          csvHeaderMode === "full"
            ? "<th>Nome</th>"
            : ""
        }
        <th>Período 1</th>
        <th>Período 2</th>
        <th>Interpretação</th>
      </tr>
    </thead>
    <tbody>
  `;


  rows
    .slice(0, 300)
    .forEach(r => {

      const interp =
        interpretRow(r);


      html += `
        <tr>
          <td class="mono">
            ${escapeHtml(r.date)}
          </td>

          ${
            csvHeaderMode === "full"
              ? `<td>${escapeHtml(r.name)}</td>`
              : ""
          }

          <td>${escapeHtml(r.p1 || "")}</td>

          <td>${escapeHtml(r.p2 || "")}</td>

          <td>${pillFor(interp)}</td>
        </tr>
      `;
    });


  html += `
    </tbody>
  `;


  table.innerHTML =
    html;
}


function pillFor(interp) {

  if (!interp) {

    return `
      <span class="pill unknown">
        ignorado
      </span>
    `;
  }


  if (
    interp.kind === "work"
  ) {

    return `
      <span class="pill work">
        ${escapeHtml(interp.label)}
      </span>
    `;
  }


  if (
    interp.kind === "off"
  ) {

    return `
      <span class="pill off">
        Folga
      </span>
    `;
  }


  if (
    interp.kind === "vacation"
  ) {

    return `
      <span class="pill vacation">
        Férias
      </span>
    `;
  }


  return `
    <span class="pill unknown">
      ${escapeHtml(interp.label)}
    </span>
  `;
}


function currentCsvSelection() {

  if (
    csvHeaderMode !== "full"
  ) {
    return csvRows;
  }


  const nameSel =
    document.getElementById(
      "csvNameSelect"
    );


  const nameRow =
    document.getElementById(
      "csvNameRow"
    );


  if (
    nameRow.style.display ===
    "none"
  ) {
    return csvRows;
  }


  return csvRows.filter(
    r =>
      r.name === nameSel.value
  );
}


function interpretRow(r) {

  const v1 =
    resolveCellValue(r.p1);


  const v2 =
    resolveCellValue(r.p2);


  if (!v1 && !v2) {
    return null;
  }


  if (
    v1 &&
    v1.type === "off"
  ) {

    return {
      kind: "off",
      label: "Folga"
    };
  }


  if (
    v1 &&
    v1.type === "vacation"
  ) {

    return {
      kind: "vacation",
      label: "Férias"
    };
  }


  if (
    v1 &&
    v1.type === "work"
  ) {

    return {
      kind: "work",
      label: v1.label,
      periods: v1.periods
    };
  }


  if (
    v1 &&
    v1.type === "time"
  ) {

    const periods = [
      {
        start: v1.start,
        end: v1.end
      }
    ];


    if (
      v2 &&
      v2.type === "time"
    ) {

      periods.push({
        start: v2.start,
        end: v2.end
      });
    }


    return {
      kind: "work",
      label: "Trabalho",
      periods
    };
  }


  if (
    v1 &&
    v1.type === "time-single" &&
    v2 &&
    v2.type === "time-single"
  ) {

    return {
      kind: "work",
      label: "Trabalho",
      periods: [
        {
          start: v1.value,
          end: v2.value
        }
      ]
    };
  }


  if (
    v1 &&
    v1.type === "unknown"
  ) {

    return {
      kind: "label",
      label: v1.label
    };
  }


  if (
    v1 &&
    v1.type === "label"
  ) {

    return {
      kind: "label",
      label: v1.label
    };
  }


  if (
    v2 &&
    v2.type === "off"
  ) {

    return {
      kind: "off",
      label: "Folga"
    };
  }


  if (
    v2 &&
    v2.type === "vacation"
  ) {

    return {
      kind: "vacation",
      label: "Férias"
    };
  }


  return null;
}


/* ============================================================
   CSV EVENTS
   ============================================================ */

document
  .getElementById("csvNameSelect")
  .addEventListener(
    "change",
    renderCsvPreview
  );


document
  .getElementById("parseCsvBtn")
  .addEventListener(
    "click",
    () => {

      const text =
        document.getElementById(
          "csvPaste"
        ).value;

      handleCsvParse(text);
    }
  );


document
  .getElementById("csvFile")
  .addEventListener(
    "change",
    e => {

      const f =
        e.target.files[0];

      if (!f) {
        return;
      }


      const reader =
        new FileReader();


      reader.onload =
        ev => {

          document.getElementById(
            "csvPaste"
          ).value =
            ev.target.result;

          handleCsvParse(
            ev.target.result
          );
        };


      reader.readAsText(
        f,
        "UTF-8"
      );
    }
  );


const csvDrop =
  document.getElementById(
    "csvDrop"
  );


csvDrop.addEventListener(
  "click",
  () =>
    document
      .getElementById("csvFile")
      .click()
);


["dragenter", "dragover"]
  .forEach(evt => {

    csvDrop.addEventListener(
      evt,
      e => {

        e.preventDefault();

        csvDrop.classList.add(
          "dragover"
        );
      }
    );
  });


["dragleave", "drop"]
  .forEach(evt => {

    csvDrop.addEventListener(
      evt,
      e => {

        e.preventDefault();

        csvDrop.classList.remove(
          "dragover"
        );
      }
    );
  });


csvDrop.addEventListener(
  "drop",
  e => {

    const f =
      e.dataTransfer.files[0];

    if (!f) {
      return;
    }


    const reader =
      new FileReader();


    reader.onload =
      ev => {

        document.getElementById(
          "csvPaste"
        ).value =
          ev.target.result;

        handleCsvParse(
          ev.target.result
        );
      };


    reader.readAsText(
      f,
      "UTF-8"
    );
  }
);


document
  .getElementById("genCsvBtn")
  .addEventListener(
    "click",
    () => {

      const statusEl =
        document.getElementById(
          "csvStatus"
        );


      const rows =
        currentCsvSelection();


      const events = [];


      rows.forEach(r => {

        const interp =
          interpretRow(r);


        if (!interp) {
          return;
        }


        events.push({
          date: r.date,
          kind: interp.kind,
          label: interp.label,
          periods: interp.periods
        });
      });


      if (!events.length) {

        statusEl.className =
          "status err";

        statusEl.textContent =
          "Nada para gerar — verifica os dados.";

        return;
      }


      const label =
        csvHeaderMode === "full" &&
        document.getElementById(
          "csvNameRow"
        ).style.display !== "none"
          ? document.getElementById(
              "csvNameSelect"
            ).value
          : "Horário";


      const ics =
        buildICS(
          events,
          `Horário — ${label}`
        );


      downloadFile(
        `horario-${label
          .toLowerCase()
          .replace(/\s+/g, "-")}.ics`,
        ics,
        "text/calendar"
      );


      statusEl.className =
        "status ok";

      statusEl.textContent =
        `Calendário gerado com ${events.length} evento(s). Ficheiro descarregado.`;
    }
  );


/* ============================================================
   TAB 3 — EXCEL → CSV
   ============================================================ */

let xlsxWorkbook = null;
let convertedCsv = "";


const xlsxDrop =
  document.getElementById(
    "xlsxDrop"
  );


xlsxDrop.addEventListener(
  "click",
  () =>
    document
      .getElementById("xlsxFile")
      .click()
);


["dragenter", "dragover"]
  .forEach(evt => {

    xlsxDrop.addEventListener(
      evt,
      e => {

        e.preventDefault();

        xlsxDrop.classList.add(
          "dragover"
        );
      }
    );
  });


["dragleave", "drop"]
  .forEach(evt => {

    xlsxDrop.addEventListener(
      evt,
      e => {

        e.preventDefault();

        xlsxDrop.classList.remove(
          "dragover"
        );
      }
    );
  });


xlsxDrop.addEventListener(
  "drop",
  e => {

    const f =
      e.dataTransfer.files[0];

    if (f) {
      loadXlsxFile(f);
    }
  }
);


document
  .getElementById("xlsxFile")
  .addEventListener(
    "change",
    e => {

      const f =
        e.target.files[0];

      if (f) {
        loadXlsxFile(f);
      }
    }
  );


function loadXlsxFile(file) {

  const statusEl =
    document.getElementById(
      "xlsxStatus"
    );


  statusEl.className =
    "status";

  statusEl.textContent =
    "A ler ficheiro…";


  const reader =
    new FileReader();


  reader.onload =
    e => {

      try {

        const data =
          new Uint8Array(
            e.target.result
          );


        xlsxWorkbook =
          XLSX.read(
            data,
            {
              type: "array"
            }
          );


        const sheetPicker =
          document.getElementById(
            "sheetPicker"
          );


        sheetPicker.innerHTML =
          xlsxWorkbook.SheetNames
            .map(
              n =>
                `<option value="${escapeHtml(n)}">
                  ${escapeHtml(n)}
                </option>`
            )
            .join("");


        document.getElementById(
          "sheetRow"
        ).style.display =
          xlsxWorkbook.SheetNames.length > 1
            ? "flex"
            : "none";


        convertSheet(
          xlsxWorkbook.SheetNames[0]
        );

      } catch (err) {

        statusEl.className =
          "status err";

        statusEl.textContent =
          "Erro a ler o Excel: " +
          err.message;
      }
    };


  reader.readAsArrayBuffer(
    file
  );
}


document
  .getElementById("sheetPicker")
  .addEventListener(
    "change",
    e =>
      convertSheet(
        e.target.value
      )
  );


function sheetToGrid(ws) {

  const grid =
    XLSX.utils.sheet_to_json(
      ws,
      {
        header: 1,
        raw: false,
        defval: ""
      }
    );


  if (ws["!merges"]) {

    ws["!merges"].forEach(
      rng => {

        const {
          s,
          e
        } = rng;


        const topVal =
          (grid[s.r] || [])[s.c];


        for (
          let r = s.r;
          r <= e.r;
          r++
        ) {

          if (!grid[r]) {
            grid[r] = [];
          }


          for (
            let c = s.c;
            c <= e.c;
            c++
          ) {

            if (
              grid[r][c] === undefined ||
              grid[r][c] === ""
            ) {

              grid[r][c] =
                topVal;
            }
          }
        }
      }
    );
  }


  return grid;
}


function parseWeekRangeStart(text) {

  const m =
    String(text).match(
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/
    );


  if (!m) {
    return null;
  }


  return {
    y: Number(m[3]),
    m: Number(m[2]),
    d: Number(m[1])
  };
}


function tryStructuredConvert(grid) {

  const out = [];


  for (
    let r = 0;
    r < grid.length;
    r++
  ) {

    const row =
      grid[r] || [];


    const label =
      String(
        row[2] || ""
      ).trim();


    if (
      !/^SEMANA/i.test(label)
    ) {
      continue;
    }


    const rangeCell =
      row
        .slice(3)
        .find(
          v =>
            /\d{1,2}\/\d{1,2}\/\d{4}\s*a\s*\d{1,2}\/\d{1,2}\/\d{4}/i.test(
              String(v || "")
            )
        );


    const startInfo =
      parseWeekRangeStart(
        rangeCell || ""
      );


    if (!startInfo) {
      continue;
    }


    const dayNameRow =
      grid[r + 1] || [];


    const subHeaderRow =
      grid[r + 2] || [];


    const dayCols = [];


    let cursorDate =
      `${startInfo.y}-${pad2(startInfo.m)}-${pad2(startInfo.d)}`;


    let lastDayNum = null;


    for (
      let c = 3;
      c < subHeaderRow.length;
      c++
    ) {

      const sh =
        String(
          subHeaderRow[c] || ""
        ).trim();


      if (
        /^1.?P/i.test(sh)
      ) {

        const dn =
          String(
            dayNameRow[c] || ""
          );


        const dm =
          dn.match(
            /(\d{1,2})\s*$/
          );


        if (!dm) {
          continue;
        }


        const dayNum =
          Number(dm[1]);


        if (
          lastDayNum !== null &&
          dayNum < lastDayNum
        ) {

          cursorDate =
            advanceToDay(
              cursorDate,
              dayNum,
              true
            );

        } else {

          cursorDate =
            advanceToDay(
              cursorDate,
              dayNum,
              false
            );
        }


        lastDayNum =
          dayNum;


        dayCols.push({
          col1: c,
          col2: c + 1,
          dateStr: cursorDate
        });
      }
    }


    if (!dayCols.length) {
      continue;
    }


    let rr = r + 3;


    while (
      rr < grid.length
    ) {

      const nrow =
        grid[rr] || [];


      const name =
        String(
          nrow[2] || ""
        ).trim();


      if (
        /^SEMANA/i.test(name)
      ) {
        break;
      }


      if (
        !name ||
        /^nome$/i.test(name)
      ) {
        break;
      }


      dayCols.forEach(dc => {

        const p1 =
          String(
            nrow[dc.col1] ?? ""
          ).trim();


        const p2 =
          String(
            nrow[dc.col2] ?? ""
          ).trim();


        if (p1 || p2) {

          out.push({
            date: dc.dateStr,
            name,
            p1: cellToToken(p1),
            p2: cellToToken(p2)
          });
        }
      });


      rr++;
    }
  }


  return out;
}


function advanceToDay(
  cursorDateStr,
  targetDay,
  forceMonthRoll
) {

  let [
    y,
    m,
    d
  ] =
    cursorDateStr
      .split("-")
      .map(Number);


  if (forceMonthRoll) {

    const dt =
      new Date(
        y,
        m - 1,
        1
      );


    dt.setMonth(
      dt.getMonth() + 1
    );


    dt.setDate(
      targetDay
    );


    return (
      `${dt.getFullYear()}-` +
      `${pad2(dt.getMonth() + 1)}-` +
      `${pad2(dt.getDate())}`
    );
  }


  const dt =
    new Date(
      y,
      m - 1,
      targetDay
    );


  return (
    `${dt.getFullYear()}-` +
    `${pad2(dt.getMonth() + 1)}-` +
    `${pad2(dt.getDate())}`
  );
}


function cellToToken(raw) {

  if (!raw) {
    return "";
  }


  const parts =
    raw
      .split(/\n+/)
      .map(s => s.trim())
      .filter(Boolean);


  if (
    parts.length === 2 &&
    /^\d{1,2}:\d{2}$/.test(parts[0]) &&
    /^\d{1,2}:\d{2}$/.test(parts[1])
  ) {

    return (
      parts[0] +
      "|" +
      parts[1]
    );
  }


  return parts.join(" ");
}


function fallbackConvert(grid) {

  const out = [];


  if (!grid.length) {
    return out;
  }


  const headers =
    grid[0];


  for (
    let r = 1;
    r < grid.length;
    r++
  ) {

    const row =
      grid[r];


    if (
      !row ||
      !row.length
    ) {
      continue;
    }


    const dateRaw =
      String(
        row[0] || ""
      ).trim();


    const norm =
      normalizeDateStr(
        dateRaw
      ) ||
      (
        /^\d{4}-\d{2}-\d{2}/.test(
          dateRaw
        )
          ? dateRaw.slice(0, 10)
          : null
      );


    if (!norm) {
      continue;
    }


    for (
      let c = 1;
      c < row.length;
      c++
    ) {

      const val =
        String(
          row[c] || ""
        ).trim();


      if (!val) {
        continue;
      }


      out.push({
        date: norm,
        name:
          String(
            headers[c] ||
            "Col" + c
          ).trim(),
        p1: cellToToken(val),
        p2: ""
      });
    }
  }


  return out;
}


function convertSheet(sheetName) {

  const statusEl =
    document.getElementById(
      "xlsxStatus"
    );


  const ws =
    xlsxWorkbook.Sheets[
      sheetName
    ];


  const grid =
    sheetToGrid(ws);


  let rows =
    tryStructuredConvert(
      grid
    );


  let mode =
    "estrutura semanal detetada";


  if (!rows.length) {

    rows =
      fallbackConvert(
        grid
      );

    mode =
      "conversão genérica linha-a-linha (fallback)";
  }


  if (!rows.length) {

    statusEl.className =
      "status err";

    statusEl.textContent =
      "Não consegui extrair linhas desta folha. Tenta escolher outra folha ou exporta as colunas manualmente.";


    document.getElementById(
      "xlsxToolbar"
    ).style.display =
      "none";


    document.getElementById(
      "xlsxPreviewWrap"
    ).style.display =
      "none";


    return;
  }


  const csvLines = [
    "Data,Nome,Periodo1,Periodo2"
  ];


  rows.forEach(r => {

    csvLines.push(
      [
        r.date,
        csvEscape(r.name),
        csvEscape(r.p1),
        csvEscape(r.p2)
      ].join(",")
    );
  });


  convertedCsv =
    csvLines.join("\n");


  statusEl.className =
    "status ok";


  statusEl.textContent =
    `${rows.length} linha(s) extraída(s) — ${mode}.`;


  const wrap =
    document.getElementById(
      "xlsxPreviewWrap"
    );


  const table =
    document.getElementById(
      "xlsxPreviewTable"
    );


  wrap.style.display =
    "block";


  let html = `
    <thead>
      <tr>
        <th>Data</th>
        <th>Nome</th>
        <th>Período 1</th>
        <th>Período 2</th>
      </tr>
    </thead>
    <tbody>
  `;


  rows
    .slice(0, 300)
    .forEach(r => {

      html += `
        <tr>
          <td class="mono">
            ${escapeHtml(r.date)}
          </td>

          <td>
            ${escapeHtml(r.name)}
          </td>

          <td>
            ${escapeHtml(r.p1)}
          </td>

          <td>
            ${escapeHtml(r.p2)}
          </td>
        </tr>
      `;
    });


  html += `
    </tbody>
  `;


  table.innerHTML =
    html;


  document.getElementById(
    "xlsxToolbar"
  ).style.display =
    "flex";
}


function csvEscape(v) {

  v = String(v ?? "");


  if (
    /[",\n]/.test(v)
  ) {

    return (
      '"' +
      v.replace(
        /"/g,
        '""'
      ) +
      '"'
    );
  }


  return v;
}


document
  .getElementById("downloadCsvBtn")
  .addEventListener(
    "click",
    () => {

      downloadFile(
        "horario.csv",
        convertedCsv,
        "text/csv"
      );
    }
  );


document
  .getElementById("useInCsvBtn")
  .addEventListener(
    "click",
    () => {

      document.getElementById(
        "csvPaste"
      ).value =
        convertedCsv;


      document
        .querySelector(
          '.tab-btn[data-tab="csv"]'
        )
        .click();


      handleCsvParse(
        convertedCsv
      );


      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  );


/* ============================================================
   THEME TOGGLE
   ============================================================ */

function initTheme() {

  const btn =
    document.getElementById(
      "themeToggle"
    );


  document.documentElement
    .setAttribute(
      "data-theme",
      "dark"
    );


  btn.textContent =
    "☾ Escuro";


  btn.addEventListener(
    "click",
    () => {

      const current =
        document.documentElement
          .getAttribute(
            "data-theme"
          );


      const next =
        current === "dark"
          ? "light"
          : "dark";


      document.documentElement
        .setAttribute(
          "data-theme",
          next
        );


      btn.textContent =
        next === "dark"
          ? "☾ Escuro"
          : "☀ Claro";
    }
  );
}


/* ============================================================
   INIT
   ============================================================ */

initTheme();
renderCodesTable();
syncCodesTable2();
buildCalendarGrid();

// Open Excel → CSV tab by default
document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("active"));

const xlsxTab = document.querySelector('.tab-btn[data-tab="xlsx"]');
const xlsxPanel = document.getElementById("panel-xlsx");

xlsxTab.classList.add("active");
xlsxPanel.classList.add("active");