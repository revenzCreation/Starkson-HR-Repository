const CONFIG = {
  spreadsheetId: '1utH1iEiYiGOCZjAQ4_z3Mb3KdJcSDUHDyMVMnbNbTSA',
  employeeDataSpreadsheetId: '195-mJN-MRhswL6DQl3nIeXfYxmEAi7ufQd1ebrIXbII',
  employeeDataSheetId: 1807874829,
  referralSheet: 'Referrals',
  employeeSheet: '201 Files',
  hrAccountsSheet: 'HR Accounts',
  jobSheet: 'Job Openings',
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
  ['relationship', 'Relationship', ['relationship']], ['notes', 'HR Notes', ['hr notes', 'notes']],
  ['resumeLink', 'Resume Link', ['resume link', 'resumelink']], ['createdAt', 'Created At', ['created at', 'createdat']]
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
  ['role', 'Account Level', ['account level', 'accountlevel', 'role']], ['username', 'Username', ['username', 'user name']],
  ['password', 'Password', ['password']], ['status', 'Status', ['status']],
  ['createdAt', 'Created At', ['created at', 'createdat']], ['updatedAt', 'Updated At', ['updated at', 'updatedat']]
];

const JOB_FIELDS = [
  ['id', 'ID', ['id']], ['title', 'Job Title', ['job title', 'title']],
  ['type', 'Employment Type', ['employment type', 'type']], ['location', 'Location', ['location']],
  ['salary', 'Monthly Salary', ['monthly salary', 'salary']], ['summary', 'Role Summary', ['role summary', 'summary']],
  ['status', 'Status', ['status']], ['createdAt', 'Created At', ['created at', 'createdat']],
  ['updatedAt', 'Updated At', ['updated at', 'updatedat']]
];

const DEFAULT_HR_ACCOUNTS = [
  { fullName: 'Cardinal Account', email: 'Unknown@gmail.com', department: 'Unknown', role: 'cardinal', username: 'cardinalAccount', password: 'cardinalAccount_011', status: 'Active' },
];

function doGet(e) {
  try {
    var action = parameter(e, 'action', 'referrals-list');
    if (action === '201-list') return json(listEmployees(e));
    if (action === 'list' || action === 'referrals-list') return json({ ok: true, records: readRecords(CONFIG.referralSheet, REFERRAL_FIELDS, false) });
    if (action === 'job-list' || action === 'jobs-list') return json({ ok: true, records: listOpenJobs() });
    if (action === 'hr-accounts-list') return json({ ok: true, records: readHrAccountRecords() });
    if (action === 'hr-login') {
      var account = authenticateHrAccount({ username: parameter(e, 'username', ''), password: parameter(e, 'password', '') });
      return account ? json({ ok: true, account: account }) : json({ ok: false, error: 'Invalid HR username or password.' });
    }
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error) });
  }
}

function doPost(e) {
  try {
    var body = parseBody(e);
    var action = String(body.action || 'referral-save');
    if (action === 'referral-save') return json({ ok: true, record: saveReferral(body) });
    if (action === 'hr-account-login' || action === 'hr-login') {
      var account = authenticateHrAccount(body.account || body);
      return account ? json({ ok: true, account: account }) : json({ ok: false, error: 'Invalid HR username or password.' });
    }
    if (action === 'hr-account-recover') return json({ ok: true, account: recoverHrAccount(body) });
    if (action === 'hr-account-save' || action === 'hr-save') return json({ ok: true, record: saveHrAccountRecord(body.record || body) });
    if (action === 'hr-account-delete' || action === 'hr-delete') {
      deleteHrAccountRecord(body.id || body.record && body.record.id);
      return json({ ok: true });
    }
    if (action === 'hr-accounts-list') return json({ ok: true, records: readHrAccountRecords() });
    if (action === 'job-save' || action === 'save-job') return json({ ok: true, record: saveJob(body.record || body) });
    if (action === 'job-delete' || action === 'delete-job') {
      deleteJob(body.id || body.record && body.record.id);
      return json({ ok: true });
    }
    return json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error) });
  }
}

function onOpen() { applyDepartmentValidation(); }

function saveReferral(input) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet(CONFIG.referralSheet, REFERRAL_FIELDS);
    var map = ensureSchema(sheet, REFERRAL_FIELDS);
    var id = nextId(sheet, map.id);
    var fileUrl = saveUpload(input.fileData, input.fileName, input.mimeType, CONFIG.referralFolderId, 'REFERRAL_' + id);
    var record = {
      id: id, timestamp: new Date(), referrerName: clean(input.referrerName), referrerEmail: clean(input.referrerEmail),
      department: clean(input.referrerDepartment), candidateName: clean(input.candidateName), candidateEmail: clean(input.candidateEmail),
      phone: clean(input.candidatePhone), portfolio: clean(input.candidatePortfolio || 'N/A'), targetRole: clean(input.targetRole),
      relationship: clean(input.relationship), notes: clean(input.notes || 'None provided'), resumeLink: fileUrl || 'No Resume Uploaded', createdAt: Date.now()
    };
    appendRecord(sheet, REFERRAL_FIELDS, record);
    applyDepartmentValidation();
    formatSheet(sheet, REFERRAL_FIELDS.length);
    return record;
  } finally { lock.releaseLock(); }
}

function saveJob(input) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet(CONFIG.jobSheet, JOB_FIELDS);
    var map = ensureSchema(sheet, JOB_FIELDS);
    var id = text(input.id) || nextId(sheet, map.id);
    var now = Date.now();
    var record = {
      id: id, title: text(input.title), type: text(input.type) || 'Full-time', location: text(input.location),
      salary: text(input.salary), summary: text(input.summary), status: text(input.status) || 'Open',
      createdAt: input.createdAt || now, updatedAt: now
    };
    if (!record.title || !record.location || !record.salary || !record.summary) throw new Error('Job title, location, salary, and summary are required.');
    upsertRecord(sheet, JOB_FIELDS, map, record);
    formatSheet(sheet, JOB_FIELDS.length);
    return record;
  } finally { lock.releaseLock(); }
}

function deleteJob(id) {
  var sheet = getSheet(CONFIG.jobSheet, JOB_FIELDS);
  var map = ensureSchema(sheet, JOB_FIELDS);
  var row = findRow(sheet, map.id, id);
  if (row) sheet.deleteRow(row);
}

function listOpenJobs() {
  return readRecords(CONFIG.jobSheet, JOB_FIELDS, false).filter(function(record) {
    return String(record.status || 'Open').toLowerCase() === 'open';
  });
}

function ensureHrAccountsSheet() {
  var sheet = getSheet(CONFIG.hrAccountsSheet, HR_ACCOUNT_FIELDS);
  if (sheet.getLastRow() <= 1) DEFAULT_HR_ACCOUNTS.forEach(function(account, index) {
    appendRecord(sheet, HR_ACCOUNT_FIELDS, {
      id: padId(index + 1), fullName: account.fullName, email: account.email, department: account.department,
      role: normalizeAccountLevel(account.role), username: account.username, password: account.password, status: normalizeAccountStatus(account.status),
      createdAt: Date.now(), updatedAt: Date.now()
    });
  });
  ensureReservedCardinalAccount(sheet);
  applyHrAccountValidation(sheet);
  return sheet;
}

function ensureReservedCardinalAccount(sheet) {
  var account = DEFAULT_HR_ACCOUNTS[0];
  if (!account || !account.username) return;
  var map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  var values = sheet.getDataRange().getValues();
  var exists = values.slice(1).some(function(row) {
    return text(row[map.username - 1]) === account.username;
  });
  if (exists) return;
  appendRecord(sheet, HR_ACCOUNT_FIELDS, {
    id: nextId(sheet, map.id), fullName: account.fullName, email: account.email, department: account.department,
    role: 'cardinal', username: account.username, password: account.password, status: 'Active',
    createdAt: Date.now(), updatedAt: Date.now()
  });
}

function authenticateHrAccount(input) {
  var username = text(input && input.username);
  var password = text(input && input.password);
  if (!username || !password) return null;
  var sheet = ensureHrAccountsSheet();
  var map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    var record = rowToRecord(values[i], HR_ACCOUNT_FIELDS, map);
    if (text(record.username) === username && text(record.password) === password && normalizeAccountStatus(record.status) === 'Active') {
      record.password = '';
      return record;
    }
  }
  return null;
}

function saveHrAccountRecord(input) {
  var sheet = ensureHrAccountsSheet();
  var map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  var username = text(input && input.username);
  var password = text(input && input.password);
  if (!username || !password) throw new Error('Username and password are required.');
  var id = text(input && input.id) || nextId(sheet, map.id);
  var accountLevel = normalizeAccountLevel(input.accountLevel || input.role);
  if (accountLevel === 'cardinal') throw new Error('Cardinal Account is reserved and cannot be assigned.');
  if (findHrAccountByUsername(username, id)) throw new Error('An HR account with that username already exists.');
  var record = {
    id: id, fullName: text(input.fullName) || 'HR Staff', email: text(input.email), department: text(input.department) || 'People & Culture',
    role: accountLevel, username: username, password: password, status: normalizeAccountStatus(input.status),
    createdAt: input.createdAt || Date.now(), updatedAt: Date.now()
  };
  upsertRecord(sheet, HR_ACCOUNT_FIELDS, map, record);
  record.password = '';
  return record;
}

function deleteHrAccountRecord(id) {
  var sheet = ensureHrAccountsSheet();
  var map = ensureSchema(sheet, HR_ACCOUNT_FIELDS);
  var row = findRow(sheet, map.id, id);
  if (row) sheet.deleteRow(row);
}

function recoverHrAccount(input) {
  var id = text(input && input.id), username = text(input && input.username), password = text(input && input.password);
  if (!/^\d{5}$/.test(id)) throw new Error('Enter the exact five-digit account ID.');
  if (!username || password.length < 8) throw new Error('Choose a username and a password of at least 8 characters.');
  if (findHrAccountByUsername(username, id)) throw new Error('An HR account with that username already exists.');
  var sheet = ensureHrAccountsSheet(), map = ensureSchema(sheet, HR_ACCOUNT_FIELDS), row = findRow(sheet, map.id, id);
  if (!row) throw new Error('No HR account matches that account ID.');
  sheet.getRange(row, map.username).setValue(username);
  sheet.getRange(row, map.password).setValue(password);
  sheet.getRange(row, map.updatedAt).setValue(Date.now());
  var account = rowToRecord(sheet.getRange(row, 1, 1, HR_ACCOUNT_FIELDS.length).getValues()[0], HR_ACCOUNT_FIELDS, map);
  account.password = '';
  return account;
}

function findHrAccountByUsername(username, excludeId) {
  var sheet = ensureHrAccountsSheet(), map = ensureSchema(sheet, HR_ACCOUNT_FIELDS), values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    var record = rowToRecord(values[i], HR_ACCOUNT_FIELDS, map);
    if (excludeId && normalizeId(record.id) === normalizeId(excludeId)) continue;
    if (text(record.username) === text(username)) return record;
  }
  return null;
}

function readHrAccountRecords() {
  return readRecords(CONFIG.hrAccountsSheet, HR_ACCOUNT_FIELDS, false).map(function(record) {
    record.password = '';
    return record;
  });
}

function listEmployees(e) {
  syncEmployeeFiles();
  var records = readRecords(CONFIG.employeeSheet, EMPLOYEE_FIELDS, true);
  var keyword = text(parameter(e, 'search', '')).toLowerCase();
  if (keyword) records = records.filter(function(record) {
    return [record.surname, record.firstName, record.middleInitial, record.suffix, record.dateHired, record.driveFileId].join(' ').toLowerCase().indexOf(keyword) !== -1;
  });
  var page = Math.max(1, parseInt(parameter(e, 'page', '1'), 10) || 1);
  var limit = Math.max(1, Math.min(100, parseInt(parameter(e, 'limit', '25'), 10) || 25));
  var totalPages = Math.max(1, Math.ceil(records.length / limit));
  page = Math.min(page, totalPages);
  var start = (page - 1) * limit;
  return { ok: true, records: records.slice(start, start + limit), pagination: { page: page, limit: limit, totalCount: records.length, totalPages: totalPages, hasNext: page < totalPages, hasPrev: page > 1 } };
}

function syncEmployeeFiles() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var folder = DriveApp.getFolderById(CONFIG.employeeFolderId);
    var sheet = getSheet(CONFIG.employeeSheet, EMPLOYEE_FIELDS), map = ensureSchema(sheet, EMPLOYEE_FIELDS), known = {};
    if (sheet.getLastRow() > 1) sheet.getRange(2, map.driveFileId, sheet.getLastRow() - 1, 1).getValues().forEach(function(row) { if (row[0]) known[String(row[0])] = true; });
    var files = folder.getFiles(), importedCount = 0;
    while (files.hasNext()) {
      var file = files.next(), fileId = file.getId();
      if (known[fileId]) continue;
      var name = normalizeEmployeeFile(file);
      appendRecord(sheet, EMPLOYEE_FIELDS, { id: nextId(sheet, map.id), surname: name.surname, firstName: name.firstName, middleInitial: '', suffix: '', dateHired: '', directLink: file.getUrl(), driveFileId: fileId });
      known[fileId] = true;
      importedCount += 1;
    }
    formatSheet(sheet, EMPLOYEE_FIELDS.length);
    return { importedCount: importedCount };
  } finally { lock.releaseLock(); }
}

function rebuildEmployeeFilesSheet() {
  var spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = spreadsheet.getSheetByName(CONFIG.employeeSheet) || spreadsheet.insertSheet(CONFIG.employeeSheet);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), EMPLOYEE_FIELDS.length)).clearContent();
  ensureSchema(sheet, EMPLOYEE_FIELDS);
  return syncEmployeeFiles();
}

function clearEmployeeFilesSheet() {
  var spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId), sheet = spreadsheet.getSheetByName(CONFIG.employeeSheet);
  if (!sheet) return 0;
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), EMPLOYEE_FIELDS.length)).clearContent();
  return 1;
}

function getEmployeeDepartmentOptions() {
  var spreadsheet = SpreadsheetApp.openById(CONFIG.employeeDataSpreadsheetId), sheet = null;
  spreadsheet.getSheets().some(function(candidate) {
    if (candidate.getSheetId() === CONFIG.employeeDataSheetId) { sheet = candidate; return true; }
    return false;
  });
  if (!sheet) sheet = spreadsheet.getSheetByName('Employee Data');
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getDisplayValues(), headers = values[0].map(normalizeHeader);
  var index = headers.findIndex(function(header) { return /department|dept/.test(header); });
  if (index < 0) return [];
  var seen = {}, departments = [];
  values.slice(1).forEach(function(row) { var value = text(row[index]); if (value && !seen[value]) { seen[value] = true; departments.push(value); } });
  return departments;
}

function applyDepartmentValidation() {
  var sheet = getSheet(CONFIG.referralSheet, REFERRAL_FIELDS), map = ensureSchema(sheet, REFERRAL_FIELDS);
  var range = sheet.getRange(2, map.department, Math.max(1, sheet.getMaxRows() - 1), 1), departments = getEmployeeDepartmentOptions();
  if (!departments.length) { range.clearDataValidations(); return; }
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(departments, true).setAllowInvalid(false).build());
}

function applyHrAccountValidation(sheet) {
  var map = fieldMap(HR_ACCOUNT_FIELDS);
  var rowCount = Math.max(1, sheet.getMaxRows() - 1);
  var levelRule = SpreadsheetApp.newDataValidation().requireValueInList(['Admin Account', 'Head Account', 'HR Staff'], true).setAllowInvalid(false).build();
  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(['Active', 'Inactive'], true).setAllowInvalid(false).build();
  sheet.getRange(2, map.role, rowCount, 1).setDataValidation(levelRule);
  sheet.getRange(2, map.status, rowCount, 1).setDataValidation(statusRule);
}

function getSheet(name, fields) {
  var spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId), sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  ensureSchema(sheet, fields);
  return sheet;
}

function ensureSchema(sheet, fields) {
  var labels = fields.map(function(field) { return field[1]; });
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
  var columnCount = Math.max(labels.length, sheet.getLastColumn()), oldHeaders = sheet.getRange(1, 1, 1, columnCount).getValues()[0], sourceMap = {};
  oldHeaders.forEach(function(header, index) { sourceMap[normalizeHeader(header)] = index; });
  var rowCount = Math.max(0, sheet.getLastRow() - 1), oldRows = rowCount ? sheet.getRange(2, 1, rowCount, columnCount).getValues() : [], richRows = rowCount ? sheet.getRange(2, 1, rowCount, columnCount).getRichTextValues() : [];
  var rows = oldRows.map(function(row, rowIndex) { return fields.map(function(field) {
    var source = [field[1]].concat(field[2]).map(normalizeHeader).find(function(alias) { return sourceMap[alias] !== undefined; });
    if (source === undefined) return '';
    var sourceIndex = sourceMap[source];
    if (field[0] === 'resumeLink' || field[0] === 'directLink') {
      var rich = richRows[rowIndex] && richRows[rowIndex][sourceIndex];
      if (rich && rich.getLinkUrl && rich.getLinkUrl()) return rich.getLinkUrl();
    }
    return row[sourceIndex];
  }); });
  repairIds(rows, fields);
  sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), labels.length).clearContent();
  sheet.getRange(1, 1, 1, labels.length).setValues([labels]);
  if (rows.length) sheet.getRange(2, 1, rows.length, labels.length).setValues(rows);
  formatSheet(sheet, labels.length);
  restoreFileLinks(sheet, fields);
  return fieldMap(fields);
}

function readRecords(name, fields, employeeMode) { return readRecordsFromSheet(getSheet(name, fields), fields, employeeMode); }

function readRecordsFromSheet(sheet, fields, employeeMode) {
  var map = ensureSchema(sheet, fields), values = sheet.getDataRange().getValues(), records = [];
  for (var i = 1; i < values.length; i += 1) {
    if (!values[i][map.id - 1]) continue;
    var record = rowToRecord(values[i], fields, map);
    if (map.directLink) record.directLink = normalizeAbsoluteUrl(getLink(sheet, i + 1, map.directLink) || record.directLink);
    if (map.resumeLink) record.resumeLink = normalizeAbsoluteUrl(getLink(sheet, i + 1, map.resumeLink) || record.resumeLink);
    if (employeeMode) { record.middleInitial = ''; record.suffix = ''; }
    records.push(record);
  }
  return records;
}

function rowToRecord(row, fields, map) {
  var record = {};
  fields.forEach(function(field) { record[field[0]] = row[map[field[0]] - 1] == null ? '' : row[map[field[0]] - 1]; });
  return record;
}

function upsertRecord(sheet, fields, map, record) {
  var row = findRow(sheet, map.id, record.id), values = [fields.map(function(field) { return record[field[0]] == null ? '' : record[field[0]]; })];
  if (row) sheet.getRange(row, 1, 1, fields.length).setValues(values);
  else sheet.getRange(sheet.getLastRow() + 1, 1, 1, fields.length).setValues(values);
}

function appendRecord(sheet, fields, record) {
  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, fields.length).setValues([fields.map(function(field) { return record[field[0]] == null ? '' : record[field[0]]; })]);
  fields.forEach(function(field, index) {
    var value = text(record[field[0]]);
    if ((field[0] === 'directLink' || field[0] === 'resumeLink') && /^https?:\/\//i.test(value)) setShortLink(sheet, row, index + 1, value, field[0] === 'directLink' ? 'Open 201 File' : 'Open Resume');
  });
}

function repairIds(rows, fields) {
  var index = fields.findIndex(function(field) { return field[0] === 'id'; });
  if (index < 0) return;
  var highest = 0, used = {};
  rows.forEach(function(row) { var number = parseInt(String(row[index] || '').replace(/\D/g, ''), 10) || 0; if (number > highest) highest = number; if (number) used[number] = true; });
  rows.forEach(function(row) {
    var value = String(row[index] || ''), number = parseInt(value.replace(/\D/g, ''), 10) || 0;
    if (!number || value.length !== 5) { do { highest += 1; } while (used[highest]); number = highest; used[number] = true; }
    row[index] = padId(number);
  });
}

function findRow(sheet, idColumn, id) {
  if (sheet.getLastRow() < 2) return 0;
  var target = normalizeId(id), values = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i += 1) if (normalizeId(values[i][0]) === target) return i + 2;
  return 0;
}

function nextId(sheet, idColumn) {
  var highest = 0;
  if (sheet.getLastRow() > 1) sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues().forEach(function(row) { highest = Math.max(highest, parseInt(String(row[0] || '').replace(/\D/g, ''), 10) || 0); });
  return padId(highest + 1);
}

function normalizeEmployeeFile(file) {
  var original = file.getName(), extensionMatch = original.match(/\.[^.]+$/), extension = extensionMatch ? extensionMatch[0].toUpperCase() : '';
  var base = original.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(), parts = base.split(','), surname = clean(parts[0].trim());
  var firstName = clean((parts.length > 1 ? parts[1] : (base.split(/\s+/)[1] || '')).trim().split(/\s+/)[0]);
  var target = [surname, firstName].filter(function(value) { return value; }).join(', ') + extension;
  if (target && target !== original) file.setName(target);
  return { surname: surname, firstName: firstName };
}

function saveUpload(data, name, mimeType, folderId, prefix) {
  if (!data) return '';
  var bytes = Utilities.base64Decode(String(data).split(',').pop()), blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', prefix + '_' + (name || 'upload'));
  return DriveApp.getFolderById(folderId).createFile(blob).getUrl();
}

function setShortLink(sheet, row, column, url, label) {
  var value = normalizeAbsoluteUrl(url);
  if (!value) return;
  sheet.getRange(row, column).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(label).setLinkUrl(value).build());
}

function getLink(sheet, row, column) { var rich = sheet.getRange(row, column).getRichTextValue(); return rich && rich.getLinkUrl ? rich.getLinkUrl() : ''; }

function restoreFileLinks(sheet, fields) {
  var labels = { resumeLink: 'Open Resume', directLink: 'Open 201 File' }, map = fieldMap(fields);
  Object.keys(labels).forEach(function(key) {
    var column = map[key];
    if (!column || sheet.getLastRow() < 2) return;
    sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getDisplayValues().forEach(function(row, index) {
      if (/^https?:\/\//i.test(String(row[0] || '').trim())) setShortLink(sheet, index + 2, column, row[0], labels[key]);
    });
  });
}

function formatSheet(sheet, count) {
  sheet.getRange(1, 1, 1, count).setFontFamily('Arial').setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  if (sheet.getMaxRows() > 1) sheet.getRange(2, 1, sheet.getMaxRows() - 1, count).setFontFamily('Arial').setFontSize(9);
  normalizeIdColumn(sheet);
  sheet.setFrozenRows(1);
}

function normalizeIdColumn(sheet) {
  if (sheet.getMaxRows() < 2) return;
  var range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1);
  range.setNumberFormat('@').setValues(range.getValues().map(function(row) { return [row[0] ? padId(parseInt(String(row[0]).replace(/\D/g, ''), 10) || 0) : '']; }));
}

function fieldMap(fields) { var map = {}; fields.forEach(function(field, index) { map[field[0]] = index + 1; }); return map; }
function normalizeAccountLevel(value) {
  var level = text(value).toLowerCase().replace(/[_-]+/g, ' ');
  if (level === 'admin account' || level === 'admin' || level === 'master' || level === 'master admin') return 'admin';
  if (level === 'head account' || level === 'head') return 'head';
  if (level === 'cardinal' || level === 'cardinal admin') return 'cardinal';
  return 'hr';
}
function normalizeAccountStatus(value) { return text(value).toLowerCase() === 'inactive' ? 'Inactive' : 'Active'; }
function normalizeId(value) { return String(value == null ? '' : value).replace(/^0+(?=\d)/, ''); }
function padId(value) { var result = String(value == null ? '' : value); while (result.length < 5) result = '0' + result; return result; }
function normalizeHeader(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function normalizeAbsoluteUrl(value) { var result = text(value); return /^https?:\/\//i.test(result) ? result : ''; }
function clean(value) { return text(value).replace(/\s+/g, ' ').toUpperCase(); }
function text(value) { return String(value == null ? '' : value).trim(); }
function errorMessage(error) { return error && error.message ? error.message : String(error || 'Unknown error'); }
function parameter(e, name, fallback) { return e && e.parameter && e.parameter[name] != null ? e.parameter[name] : fallback; }
function parseBody(e) { return JSON.parse(e && e.postData && e.postData.contents || '{}'); }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }