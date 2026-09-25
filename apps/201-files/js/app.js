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
const CACHE_KEY = 'employee-directory';
const CACHE_TTL_MS = window.HR_PORTAL_CACHE?.DEFAULT_TTL_MS || 5 * 60 * 1000;
const syncStatusEl = document.getElementById('syncStatus');
const syncNowBtn = document.getElementById('syncNowBtn');
let currentPage = 1;
let pagination = { page: 1, limit: PAGE_SIZE, totalCount: 0, totalPages: 1, hasNext: false, hasPrev: false };
let pollingTimer = null;

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeExternalLink(value) {
  const candidate = cleanText(value);
  if (!candidate) return '';
  if (/^(https?:\/\/|mailto:)/i.test(candidate)) return candidate;
  return '';
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

  const safeLink = normalizeExternalLink(record?.directLink);
  if (safeLink) {
    directLink.href = safeLink;
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
  const totalPages = Math.max(1, pagination.totalPages || 1);
  currentPage = Math.min(currentPage, totalPages);

  if (prevPageBtn) prevPageBtn.disabled = !pagination.hasPrev;
  if (nextPageBtn) nextPageBtn.disabled = !pagination.hasNext;
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
  const view = updatePagination(filtered);

  tableBody.replaceChildren();
  recordCount.textContent = `${pagination.totalCount || filtered.length} ${((pagination.totalCount || filtered.length) === 1 ? 'record' : 'records')}`;
  emptyState.classList.toggle('hidden', filtered.length > 0);

  if (filtered.length === 0) {
    if (pageInfo) pageInfo.textContent = 'Page 1 of 1';
    return;
  }

  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${view.totalPages}`;
  renderPageChunk(filtered, 0);
}

function setSyncStatus(message, tone = 'neutral') {
  if (window.HR_PORTAL_SYNC && typeof window.HR_PORTAL_SYNC.setStoreState === 'function') {
    const stateMap = {
      neutral: 'idle',
      success: 'synced',
      error: 'failed',
      busy: 'pending'
    };
    window.HR_PORTAL_SYNC.setStoreState(CACHE_KEY, stateMap[tone] || 'idle', message, 'session');
  }

  if (!syncStatusEl) return;
  const tones = {
    neutral: 'color: #51606c',
    success: 'color: #0f7a5d',
    error: 'color: #b42318',
    busy: 'color: #a16207'
  };
  syncStatusEl.textContent = message;
  syncStatusEl.style.color = tones[tone] || tones.neutral;
}

function normalizeEmployeeRecords(items) {
  return (Array.isArray(items) ? items : []).map(record => ({
    ...record,
    directLink: normalizeExternalLink(record?.directLink)
  }));
}

async function fetchEmployeeDirectory({ forceRefresh = false, page = 1, limit = PAGE_SIZE } = {}) {
  const cache = window.HR_PORTAL_CACHE;

  if (!forceRefresh && cache && typeof cache.readCached === 'function') {
    const cachedPayload = cache.readCached(CACHE_KEY, CACHE_TTL_MS, 'session');
    if (cachedPayload && Array.isArray(cachedPayload.records) && cachedPayload.records.length) {
      return cachedPayload;
    }
  }

  const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet1;
  if (!apiUrl) throw new Error('The employee directory connection is not configured.');

  const result = await window.HR_PORTAL_SHEETS.request(`${apiUrl}?action=201-list&page=${page}&limit=${limit}`);
  if (!result || result.ok === false) {
    throw new Error(result && result.error ? result.error : 'The employee file list could not be loaded.');
  }

  const payload = {
    records: normalizeEmployeeRecords(result.records),
    pagination: result.pagination || {
      page,
      limit,
      totalCount: normalizeEmployeeRecords(result.records).length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    }
  };

  if (cache && typeof cache.writeCache === 'function') {
    cache.writeCache(CACHE_KEY, payload, 'session');
    cache.setSyncState(CACHE_KEY, { status: 'ready', updatedAt: Date.now() }, 'session');
  }

  return payload;
}

async function refreshDirectory(options = {}) {
  const { background = false, silent = false } = options;
  if (!silent) setSyncStatus(background ? 'Syncing employee directory...' : 'Loading employee directory...', 'busy');

  try {
    const payload = await fetchEmployeeDirectory({
      forceRefresh: true,
      page: currentPage,
      limit: PAGE_SIZE
    });

    records = payload.records || [];
    pagination = payload.pagination || { ...pagination, page: currentPage, limit: PAGE_SIZE };
    currentPage = Math.max(1, Math.min(currentPage, pagination.totalPages || 1));
    render();

    if (!silent) {
      setSyncStatus(`Updated ${pagination.totalCount || records.length} employee records.`, 'success');
    }
  } catch (error) {
    console.error('201 Files refresh failed:', error);
    setSyncStatus('Background sync failed — retrying later.', 'error');
    if (!background) {
      recordCount.textContent = 'Unavailable';
      const title = emptyState.querySelector('h2');
      const description = emptyState.querySelector('p');
      if (title) title.textContent = 'Employee files are unavailable';
      if (description) description.textContent = error.message || 'Could not connect to Google Sheets.';
      emptyState.classList.remove('hidden');
    }
  }
}

async function initialize() {
  if (!recordCount || !emptyState) return;

  const cache = window.HR_PORTAL_CACHE;
  if (cache && typeof cache.readCached === 'function') {
    const cachedPayload = cache.readCached(CACHE_KEY, CACHE_TTL_MS, 'session');
    if (cachedPayload && Array.isArray(cachedPayload.records) && cachedPayload.records.length) {
      records = cachedPayload.records;
      pagination = cachedPayload.pagination || { ...pagination, page: currentPage, limit: PAGE_SIZE };
      currentPage = Math.max(1, Math.min(currentPage, pagination.totalPages || 1));
      recordCount.textContent = `${pagination.totalCount || records.length} records`;
      render();
    }
  }

  recordCount.textContent = 'Loading...';
  setSyncStatus('Loading employee directory...', 'busy');

  try {
    const payload = await fetchEmployeeDirectory({ forceRefresh: false, page: currentPage, limit: PAGE_SIZE });
    records = payload.records || [];
    pagination = payload.pagination || { ...pagination, page: currentPage, limit: PAGE_SIZE };
    currentPage = Math.max(1, Math.min(currentPage, pagination.totalPages || 1));
    render();
    setSyncStatus(`Loaded ${pagination.totalCount || records.length} employee records.`, 'success');
  } catch (error) {
    console.error('201 Files load failed:', error);
    recordCount.textContent = 'Unavailable';
    const title = emptyState.querySelector('h2');
    const description = emptyState.querySelector('p');
    if (title) title.textContent = 'Employee files are unavailable';
    if (description) description.textContent = error.message || 'Could not connect to Google Sheets.';
    emptyState.classList.remove('hidden');
    setSyncStatus('Unable to load employee directory.', 'error');
  }
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    currentPage = 1;
    render();
  });
}

if (prevPageBtn) {
  prevPageBtn.addEventListener('click', async () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    setSyncStatus('Loading previous page...', 'busy');
    try {
      const payload = await fetchEmployeeDirectory({ forceRefresh: true, page: currentPage, limit: PAGE_SIZE });
      records = payload.records || [];
      pagination = payload.pagination || { ...pagination, page: currentPage, limit: PAGE_SIZE };
      render();
      setSyncStatus('Previous page loaded.', 'success');
    } catch (error) {
      console.error('Previous page load failed:', error);
      setSyncStatus('Unable to load previous page.', 'error');
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener('click', async () => {
    if (!pagination.hasNext) return;
    currentPage += 1;
    setSyncStatus('Loading next page...', 'busy');
    try {
      const payload = await fetchEmployeeDirectory({ forceRefresh: true, page: currentPage, limit: PAGE_SIZE });
      records = payload.records || [];
      pagination = payload.pagination || { ...pagination, page: currentPage, limit: PAGE_SIZE };
      render();
      setSyncStatus('Next page loaded.', 'success');
    } catch (error) {
      console.error('Next page load failed:', error);
      setSyncStatus('Unable to load next page.', 'error');
    }
  });
}

if (syncNowBtn) {
  syncNowBtn.addEventListener('click', () => refreshDirectory({ background: false, silent: false }));
}

function startBackgroundPolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = window.setInterval(() => {
    refreshDirectory({ background: true, silent: true });
  }, 45000);
}

initialize();
startBackgroundPolling();
