// Render widgets functions
function renderMetricWidget(widget, container) {
  const card = document.createElement('div');
  card.className = 'widget-metric';
  let val = getTableRecords(widget.targetTable).length;
  card.innerHTML = `
    <div class="metric-info">
      <h4>${widget.title}</h4>
      <div class="metric-value">${val}</div>
    </div>`;
  container.appendChild(card);
}

function renderTableWidget(widget, container) {
  const card = document.createElement('div');
  card.className = 'widget-table';
  const records = getTableRecords(widget.targetTable);
  card.innerHTML = `<h4>${widget.title}</h4>`;
  
  if (records.length === 0) {
    card.innerHTML += "<p>No data</p>";
    container.appendChild(card);
    return;
  }
  const table = document.createElement('table');
  const headers = Object.keys(records[0]);
  let headerHtml = "<tr>" + headers.map(h => `<th>${h}</th>`).join('') + "</tr>";
  table.innerHTML += headerHtml;
  records.forEach(row => {
    table.innerHTML += "<tr>" + headers.map(h => `<td>${row[h]}</td>`).join('') + "</tr>";
  });
  card.appendChild(table);
  container.appendChild(card);
}