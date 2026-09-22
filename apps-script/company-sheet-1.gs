const CONFIG = {
  spreadsheetId: '1utH1iEiYiGOCZjAQ4_z3Mb3KdJcSDUHDyMVMnbNbTSA',
  employeeDataSpreadsheetId: '195-mJN-MRhswL6DQl3nIeXfYxmEAi7ufQd1ebrIXbII',
  employeeDataSheetId: 1807874829,
  referralSheet: 'Referrals',
  employeeSheet: '201 Files',
  hrAccountsSheet: 'HR Accounts',
  referralFolderId: '1kL5CK1-ZEY51BZo6_BQjY8MSSfoEzcBl',
  employeeFolderId: '1wroebNAIgVf6oMVa1EMm6gZ_-f6dCotL'
};

const REFERRAL_FIELDS = [
  ['id', 'ID', ['id']], ['timestamp', 'Timestamp', ['timestamp', 'date']],
  ['referrerName', 'Referrer Name', ['referrer name', 'referrername']],
  ['referrerEmail', 'Referrer Email', ['referrer email', 'referreremail']],
  ['department', 'Department', ['department', 'referrer department']],
  ['candidateName', 'Candidate Name', ['candidate name', 'candidatename']],
  ['candidateEmail', 'Candidate Email', ['candidate email', 'candidateemail']],
  ['phone', 'Phone', ['phone', 'candidate phone']],
  ['portfolio', 'Portfolio', ['portfolio', 'candidate portfolio']],
  ['targetRole', 'Target Role', ['target role', 'position']],
  ['relationship', 'Relationship', ['relationship']],
  ['notes', 'HR Notes', ['hr notes', 'notes']],
  ['resumeLink', 'Resume Link', ['resume link', 'resumelink']],
  ['createdAt', 'Created At', ['created at', 'createdat']]
];

const EMPLOYEE_FIELDS = [
  ['id', 'ID', ['id']], ['surname', 'Surname', ['surname', 'last name']],
  ['firstName', 'First Name', ['first name', 'firstname', 'given name']],
  ['middleInitial', 'Middle Initial', ['middle initial', 'middleinitial', 'mi']],
  ['suffix', 'Suffix', ['suffix']], ['dateHired', 'Date Hired', ['date hired', 'datehired']],
  ['directLink', '201 File', ['201 file', 'direct link', 'directlink', 'file link']],
  ['driveFileId', 'Drive File ID', ['drive file id', 'drivefileid']]
];

const HR_ACCOUNT_FIELDS = [
  ['id', 'ID', ['id']], ['fullName', 'Full Name', ['full name', 'fullname']],
  ['email', 'Email', ['email', 'email address']], ['department', 'Department', ['department']],
  ['role', 'Role', ['role']], ['username', 'Username', ['username', 'user name']],
  ['password', 'Password', ['password']], ['status', 'Status', ['status']],
  ['createdAt', 'Created At', ['created at', 'createdat']], ['updatedAt', 'Updated At', ['updated at', 'updatedat']]
];

const DEFAULT_HR_ACCOUNTS = [
  { fullName: 'Cardinal Admin', email: 'cardinal@starkson.com', department: 'People & Culture', role: 'cardinal', username: 'cardinal', password: 'Cardinal123!', status: 'Active' },
  { fullName: 'Master Admin', email: 'master@starkson.com', department: 'People & Culture', role: 'master', username: 'master', password: 'Master123!', status: 'Active' },
  { fullName: 'HR Staff', email: 'hr@starkson.com', department: 'People & Culture', role: 'hr', username: 'hr', password: 'Hr123!', status: 'Active' }
];

function ensureHrAccountsSheet() {
  const sheet = getSheet(CONFIG.hrAccountsSheet, HR_ACCOUNT_FIELDS);
  const map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HR_ACCOUNT_FIELDS.length).getValues() : [];
  if (!rows.length) {
    DEFAULT_HR_ACCOUNTS.forEach((account, index) => {
      const record = {
        id: String(index + 1).padStart(5, '0'),
        fullName: account.fullName,
        email: account.email,
        department: account.department,
        role: normalizeHrRole(account.role),
        username: account.username,
        password: account.password,
        status: account.status || 'Active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      appendRecord(sheet, HR_ACCOUNT_FIELDS, record);
    });
    return getSheet(CONFIG.hrAccountsSheet, HR_ACCOUNT_FIELDS);
  }
  return sheet;
}

function normalizeHrRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ['cardinal', 'master', 'hr'].includes(role) ? role : 'hr';
}

function readHrAccountRecords() {
  const sheet = ensureHrAccountsSheet();
  const map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(row => row[map.id - 1]).map((row) => {
    const record = {};
    HR_ACCOUNT_FIELDS.forEach(field => {
      record[field[0]] = row[map[field[0]] - 1] == null ? '' : row[map[field[0]] - 1];
    });
    if (record.password) record.password = '';
    return record;
  });
}

function authenticateHrAccount(input) {
  const username = String(input && input.username || '').trim().toLowerCase();
  const password = String(input && input.password || '').trim();
  if (!username || !password) return null;

  const sheet = ensureHrAccountsSheet();
  const map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    const record = {};
    HR_ACCOUNT_FIELDS.forEach(field => {
      record[field[0]] = row[map[field[0]] - 1] == null ? '' : row[map[field[0]] - 1];
    });
    const sameUsername = String(record.username || '').trim().toLowerCase() === username;
    const samePassword = String(record.password || '').trim() === password;
    const active = String(record.status || 'Active').toLowerCase() !== 'inactive';
    if (sameUsername && samePassword && active) {
      const safeRecord = { ...record, password: '' };
      return safeRecord;
    }
  }
  return null;
}

function saveHrAccountRecord(input) {
  const sheet = ensureHrAccountsSheet();
  const map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  const trimmedUsername = String(input && input.username || '').trim();
  const trimmedPassword = String(input && input.password || '').trim();
  if (!trimmedUsername || !trimmedPassword) {
    throw new Error('Username and password are required.');
  }

  const role = normalizeHrRole(input && input.role);
  const existing = findHrAccountByUsername(trimmedUsername, input && input.id);
  if (existing && existing.id !== String(input && input.id || '')) {
    throw new Error('An HR account with that username already exists.');
  }

  const id = String(input && input.id || '').trim() || nextId(sheet, map.id);
  const record = {
    id: id,
    fullName: String(input && input.fullName || '').trim() || 'HR Staff',
    email: String(input && input.email || '').trim(),
    department: String(input && input.department || '').trim() || 'People & Culture',
    role: role,
    username: trimmedUsername,
    password: trimmedPassword,
    status: String(input && input.status || 'Active').trim() || 'Active',
    createdAt: input && input.createdAt ? Number(input.createdAt) : Date.now(),
    updatedAt: Date.now()
  };

  const rowIndex = findRow(sheet, map.id, id);
  if (rowIndex) {
    const updateRange = sheet.getRange(rowIndex, 1, 1, HR_ACCOUNT_FIELDS.length);
    updateRange.setValues([HR_ACCOUNT_FIELDS.map(field => record[field[0]] == null ? '' : record[field[0]])]);
  } else {
    appendRecord(sheet, HR_ACCOUNT_FIELDS, record);
  }

  const saved = { ...record, password: '' };
  return saved;
}

function deleteHrAccountRecord(id) {
  const sheet = ensureHrAccountsSheet();
  const map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  const rowIndex = findRow(sheet, map.id, String(id || '').trim());
  if (rowIndex) {
    sheet.deleteRow(rowIndex);
  }
}

function findHrAccountByUsername(username, excludeId) {
  const sheet = ensureHrAccountsSheet();
  const map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    const currentId = String(row[map.id - 1] || '').trim();
    if (excludeId && currentId === String(excludeId).trim()) continue;
    if (String(row[map.username - 1] || '').trim().toLowerCase() === String(username || '').trim().toLowerCase()) {
      const record = {};
      HR_ACCOUNT_FIELDS.forEach(field => {
        record[field[0]] = row[map[field[0]] - 1] == null ? '' : row[map[field[0]] - 1];
      });
      return record;
    }
  }
  return null;
}

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action || 'referrals-list';
    if (action === '201-list') { syncEmployeeFiles(); return json({ ok: true, records: readRecords(CONFIG.employeeSheet, EMPLOYEE_FIELDS, true) }); }
    if (action === 'list' || action === 'referrals-list') return json({ ok: true, records: readRecords(CONFIG.referralSheet, REFERRAL_FIELDS, false) });
    if (action === 'hr-accounts-list') return json({ ok: true, records: readHrAccountRecords() });
    if (action === 'hr-login') {
      const username = e && e.parameter && e.parameter.username || '';
      const password = e && e.parameter && e.parameter.password || '';
      const account = authenticateHrAccount({ username, password });
      if (!account) return json({ ok: false, error: 'Invalid HR username or password.' });
      return json({ ok: true, account: account });
    }
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) { return json({ ok: false, error: error.message }); }
}

function onOpen() {
  applyDepartmentValidation();
}

function doPost(e) {
  try {
    const body = parseBody(e);
    if (!body.action || body.action === 'referral-save') return json({ ok: true, record: saveReferral(body) });
    if (body.action === 'hr-account-login' || body.action === 'hr-login') {
      const account = authenticateHrAccount(body.account || body || {});
      if (!account) return json({ ok: false, error: 'Invalid HR username or password.' });
      return json({ ok: true, account: account });
    }
    if (body.action === 'hr-account-save' || body.action === 'hr-save') return json({ ok: true, record: saveHrAccountRecord(body.record || body || {}) });
    if (body.action === 'hr-account-delete' || body.action === 'hr-delete') {
      deleteHrAccountRecord(body.id || body.record && body.record.id);
      return json({ ok: true });
    }
    if (body.action === 'hr-accounts-list') return json({ ok: true, records: readHrAccountRecords() });
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) { return json({ ok: false, error: error.message }); }
}

function saveReferral(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.referralSheet, REFERRAL_FIELDS);
    const map = ensureSchema(sheet, REFERRAL_FIELDS);
    const id = nextId(sheet, map.id);
    const fileUrl = saveUpload(input.fileData, input.fileName, input.mimeType, CONFIG.referralFolderId, 'REFERRAL_' + id);
    const record = {
      id: id, timestamp: new Date(), referrerName: clean(input.referrerName), referrerEmail: clean(input.referrerEmail),
      department: clean(input.referrerDepartment), candidateName: clean(input.candidateName), candidateEmail: clean(input.candidateEmail),
      phone: clean(input.candidatePhone), portfolio: clean(input.candidatePortfolio || 'N/A'), targetRole: clean(input.targetRole),
      relationship: clean(input.relationship), notes: clean(input.notes || 'None provided'), resumeLink: fileUrl || 'No Resume Uploaded', createdAt: Date.now()
    };
    appendRecord(sheet, REFERRAL_FIELDS, record);
    if (fileUrl) setShortLink(sheet, sheet.getLastRow(), map.resumeLink, fileUrl, 'Open Resume');
    applyDepartmentValidation();
    formatSheet(sheet, REFERRAL_FIELDS.length);
    return record;
  } finally { lock.releaseLock(); }
}

function getEmployeeDepartmentOptions() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.employeeDataSpreadsheetId);
  const sheet = spreadsheet.getSheets().find(item => item.getSheetId() === CONFIG.employeeDataSheetId)
    || spreadsheet.getSheetByName('Employee Data');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(normalizeHeader);
  const departmentIndex = headers.findIndex(header => /department|dept/.test(header));
  if (departmentIndex < 0) return [];
  return [...new Set(values.slice(1).map(row => String(row[departmentIndex] || '').trim()).filter(Boolean))];
}

function applyDepartmentValidation() {
  const sheet = getSheet(CONFIG.referralSheet, REFERRAL_FIELDS);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
}

function syncEmployeeFiles() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = getSheet(CONFIG.employeeSheet, EMPLOYEE_FIELDS);
    const map = ensureSchema(sheet, EMPLOYEE_FIELDS);
    const known = {};
    if (sheet.getLastRow() > 1) sheet.getRange(2, map.driveFileId, sheet.getLastRow() - 1, 1).getValues().forEach(row => { if (row[0]) known[String(row[0])] = true; });
    const files = DriveApp.getFolderById(CONFIG.employeeFolderId).getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const identity = file.getId();
      const name = normalizeEmployeeFile(file);
      if (known[identity]) continue;
      const id = nextId(sheet, map.id);
      appendRecord(sheet, EMPLOYEE_FIELDS, { id: id, surname: name.surname, firstName: name.firstName, middleInitial: '', suffix: '', dateHired: '', directLink: file.getUrl(), driveFileId: identity });
      setShortLink(sheet, sheet.getLastRow(), map.directLink, file.getUrl(), 'Open 201 File');
      known[identity] = true;
    }
    formatSheet(sheet, EMPLOYEE_FIELDS.length);
  } finally { lock.releaseLock(); }
}

function readRecords(name, fields, employeeMode) {
  const sheet = getSheet(name, fields); const map = ensureSchema(sheet, fields); const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(row => row[map.id - 1]).map((row, index) => {
    const record = {}; fields.forEach(field => { record[field[0]] = row[map[field[0]] - 1] == null ? '' : row[map[field[0]] - 1]; });
    if (map.directLink) record.directLink = getLink(sheet, index + 2, map.directLink) || record.directLink;
    if (map.resumeLink) record.resumeLink = getLink(sheet, index + 2, map.resumeLink) || record.resumeLink;
    if (employeeMode) { record.middleInitial = ''; record.suffix = ''; }
    return record;
  });
}

function getSheet(name, fields) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(name); if (!sheet) sheet = spreadsheet.insertSheet(name);
  ensureSchema(sheet, fields); return sheet;
}

function ensureSchema(sheet, fields) {
  const labels = fields.map(field => field[1]);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
  const columnCount = Math.max(sheet.getLastColumn(), labels.length);
  const oldHeaders = sheet.getRange(1, 1, 1, columnCount).getValues()[0];
  const sourceMap = {}; oldHeaders.forEach((header, index) => { sourceMap[normalizeHeader(header)] = index; });
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  const oldRows = rowCount ? sheet.getRange(2, 1, rowCount, columnCount).getValues() : [];
  const oldRichRows = rowCount ? sheet.getRange(2, 1, rowCount, columnCount).getRichTextValues() : [];
  const rows = oldRows.map((row, rowIndex) => fields.map(field => {
    const source = [field[1]].concat(field[2]).map(normalizeHeader).find(key => sourceMap[key] !== undefined);
    if (field[0] === 'resumeLink' || field[0] === 'directLink') {
      const sourceIndex = sourceMap[source];
      const rich = oldRichRows[rowIndex] && oldRichRows[rowIndex][sourceIndex];
      const link = rich && rich.getLinkUrl ? rich.getLinkUrl() : '';
      if (link) return link;
    }
    return source === undefined ? '' : row[sourceMap[source]];
  }));
  repairIds(rows, fields);
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), labels.length).clearContent();
  sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
  if (rows.length) sheet.getRange(2, 1, rows.length, labels.length).setValues(rows);
  formatSheet(sheet, labels.length);
  restoreFileLinks(sheet, fields);
  return fieldMap(fields);
}

function repairIds(rows, fields) {
  const idIndex = fields.findIndex(field => field[0] === 'id'); if (idIndex < 0) return;
  let highest = rows.reduce((max, row) => Math.max(max, parseInt(String(row[idIndex]).replace(/\D/g, ''), 10) || 0), 0);
  const used = {}; rows.forEach(row => { const value = String(row[idIndex] || '').replace(/\D/g, ''); if (value) used[Number(value)] = true; });
  rows.forEach(row => { const number = parseInt(String(row[idIndex] || '').replace(/\D/g, ''), 10); if (!number || String(row[idIndex]).length !== 5) { do { highest += 1; } while (used[highest]); row[idIndex] = String(highest).padStart(5, '0'); used[highest] = true; } else row[idIndex] = String(number).padStart(5, '0'); });
}

function appendRecord(sheet, fields, record) { const values = fields.map(field => record[field[0]] == null ? '' : record[field[0]]); sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]); }
function fieldMap(fields) { const map = {}; fields.forEach((field, index) => map[field[0]] = index + 1); return map; }
function nextId(sheet, idColumn) { if (sheet.getLastRow() < 2) return '00001'; const values = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues(); const highest = values.reduce((max, row) => Math.max(max, parseInt(String(row[0]).replace(/\D/g, ''), 10) || 0), 0); return String(highest + 1).padStart(5, '0'); }
function saveUpload(data, name, mimeType, folderId, prefix) { if (!data) return ''; const bytes = Utilities.base64Decode(String(data).split(',').pop()); const blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', prefix + '_' + (name || 'upload')); return DriveApp.getFolderById(folderId).createFile(blob).getUrl(); }
function normalizeEmployeeFile(file) { const original = file.getName(); const extension = (original.match(/\.[^.]+$/) || [''])[0].toUpperCase(); const base = original.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(); const parts = base.split(','); const surname = clean(parts[0].trim().split(/\s+/).slice(0, parts.length > 1 ? 99 : 1).join(' ')); const firstName = clean((parts.length > 1 ? parts[1] : base.split(/\s+/)[1] || '').trim().split(/\s+/)[0]); const target = [surname, firstName].filter(Boolean).join(', ') + extension; if (target !== original) file.setName(target); return { surname: surname, firstName: firstName }; }
function setShortLink(sheet, row, column, url, label) { sheet.getRange(row, column).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(label).setLinkUrl(url).build()); }
function getLink(sheet, row, column) { const rich = sheet.getRange(row, column).getRichTextValue(); return rich && rich.getLinkUrl ? rich.getLinkUrl() : ''; }
function restoreFileLinks(sheet, fields) {
  const labels = { resumeLink: 'Open Resume', directLink: 'Open 201 File' };
  const fieldMapByName = fieldMap(fields);
  Object.keys(labels).forEach(key => {
    const column = fieldMapByName[key];
    if (!column || sheet.getLastRow() < 2) return;
    const values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getDisplayValues();
    values.forEach((row, index) => {
      const url = String(row[0] || '').trim();
      if (/^https?:\/\//i.test(url)) setShortLink(sheet, index + 2, column, url, labels[key]);
    });
  });
}
function formatSheet(sheet, count) { sheet.getRange(1, 1, 1, count).setFontFamily('Arial').setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center'); if (sheet.getMaxRows() > 1) sheet.getRange(2, 1, sheet.getMaxRows() - 1, count).setFontFamily('Arial').setFontSize(9); normalizeIdColumn(sheet); sheet.setFrozenRows(1); }
function normalizeIdColumn(sheet) { if (sheet.getMaxRows() < 2) return; const range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1); const values = range.getValues().map(row => { const digits = String(row[0] == null ? '' : row[0]).replace(/\D/g, ''); return [digits ? digits.padStart(5, '0') : '']; }); range.setNumberFormat('@').setValues(values); }
function normalizeHeader(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function clean(value) { return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toUpperCase(); }
function parseBody(e) { return JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
