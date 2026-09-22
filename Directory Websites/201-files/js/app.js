let records = [];
const tableBody = document.getElementById('employeeRows');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const recordCount = document.getElementById('recordCount');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const canEditHireDate = false;
const PAGE_SIZE = 25;
let currentPage = 1;

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function formatEmployeeName(record) {
  const surname = cleanText(record?.surname).toUpperCase();
  const suffix = cleanText(record?.suffix).toUpperCase();
  const firstName = cleanText(record?.firstName).toUpperCase();
  const nameParts = [surname];
  if (suffix) nameParts.push(suffix);
  if (firstName) nameParts.push(firstName);
  return nameParts.filter(Boolean).join(' ');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return cleanText(value);
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function createDateCell(record) {
  const dateInput = document.createElement('input');
  dateInput.className = 'date-input';
  dateInput.type = 'date';
  dateInput.value = cleanText(record?.dateHired);
  dateInput.disabled = !canEditHireDate;
  dateInput.setAttribute('aria-label', `Date hired for ${formatEmployeeName(record)}`);
  return dateInput;
}

function createLinkCell(record) {
  const directLink = document.createElement('a');
  directLink.className = 'direct-link';
  directLink.textContent = '201 Direct Link';
  directLink.target = '_blank';
  directLink.rel = 'noopener noreferrer';

  if (record?.directLink) {
    directLink.href = record.directLink;
    directLink.innerHTML = '201 Direct Link <span aria-hidden="true">↗</span>';
  } else {
    directLink.classList.add('disabled');
    directLink.setAttribute('aria-disabled', 'true');
    directLink.tabIndex = -1;
    directLink.innerHTML = '201 Direct Link <span aria-hidden="true">—</span>';
  }

  return directLink;
}

function updatePagination(filtered) {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);

  if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  return { totalPages, currentPage };
}

function renderPageChunk(items, startIndex) {
  const fragment = document.createDocumentFragment();
  const endIndex = Math.min(startIndex + 25, items.length);

  for (let index = startIndex; index < endIndex; index += 1) {
    const record = items[index];
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    const dateCell = document.createElement('td');
    const linkCell = document.createElement('td');

    nameCell.className = 'employee-name';
    nameCell.textContent = formatEmployeeName(record);
    dateCell.className = 'hired-date';
    dateCell.appendChild(createDateCell(record));
    linkCell.appendChild(createLinkCell(record));

    row.append(nameCell, dateCell, linkCell);
    fragment.appendChild(row);
  }

  tableBody.appendChild(fragment);

  if (endIndex < items.length) {
    requestAnimationFrame(() => renderPageChunk(items, endIndex));
  }
}

function render() {
  if (!tableBody || !searchInput || !recordCount || !emptyState) return;

  const query = cleanText(searchInput.value).toUpperCase();
  const filtered = records.filter(record => formatEmployeeName(record).includes(query));
  const pagination = updatePagination(filtered);

  const totalPages = pagination.totalPages;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  tableBody.replaceChildren();
  recordCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`;
  emptyState.classList.toggle('hidden', filtered.length > 0);

  if (filtered.length === 0) {
    if (pageInfo) pageInfo.textContent = 'Page 1 of 1';
    return;
  }

  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  renderPageChunk(pageItems, 0);
}

async function initialize() {
  if (!recordCount || !emptyState) return;
  recordCount.textContent = 'Loading...';

  try {
    const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet1;
    if (!apiUrl) throw new Error('The employee directory connection is not configured.');
    const result = await window.HR_PORTAL_SHEETS.request(`${apiUrl}?action=201-list`);
    records = Array.isArray(result.records) ? result.records : [];
    currentPage = 1;
    render();
  } catch (error) {
    recordCount.textContent = 'Unavailable';
    const title = emptyState.querySelector('h2');
    const description = emptyState.querySelector('p');
    if (title) title.textContent = 'Employee files are unavailable';
    if (description) description.textContent = error.message || 'Could not connect to Google Sheets.';
    emptyState.classList.remove('hidden');
  }
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    currentPage = 1;
    render();
  });
}

if (prevPageBtn) {
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      render();
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener('click', () => {
    const filtered = records.filter(record => formatEmployeeName(record).includes(cleanText(searchInput?.value || '').toUpperCase()));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage < totalPages) {
      currentPage += 1;
      render();
    }
  });
}

initialize();
