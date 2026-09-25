function getSheet2Url() {
  const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet2;
  if (!apiUrl) throw new Error('The applicant connection is not configured.');
  return apiUrl;
}

function getSheet1Url() {
  const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet1;
  if (!apiUrl) throw new Error('The job openings connection is not configured.');
  return apiUrl;
}

const form = document.getElementById('applicantForm');
const statusBox = document.getElementById('statusBox');
const applicantList = document.getElementById('applicantList');
const currentJobsList = document.getElementById('currentJobsList');
const resumeUploadBox = document.getElementById('resumeUploadBox');
const resumeInput = document.getElementById('resumeInput');
const resumePreview = document.getElementById('resumePreview');
const resumeName = document.getElementById('resumeName');
const departmentSelect = document.getElementById('department');
const JOB_STORAGE_KEY = 'starkson_current_jobs';
const defaultJobs = [];
const legacyJobTitles = new Set([
  'Production Operator',
  'Quality Inspector',
  'Warehouse Associate',
  'Production Supervisor'
]);
let applicantOptionsLoaded = false;
let applicantOptionsRequest = null;
let uploadedResume = null;
let isSubmitting = false;

function getFormRecord() {
  const fullName = [
    document.getElementById('firstName')?.value.trim(),
    document.getElementById('middleInitial')?.value.trim(),
    document.getElementById('lastName')?.value.trim()
  ].filter(Boolean).join(' ');

  const selectedPosition = document.getElementById('positionApplied')?.value.trim() || '';

  return {
    id: '',
    fullName,
    firstName: document.getElementById('firstName')?.value.trim() || '',
    middleInitial: document.getElementById('middleInitial')?.value.trim() || '',
    lastName: document.getElementById('lastName')?.value.trim() || '',
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    gender: document.getElementById('gender')?.value || '',
    age: document.getElementById('age')?.value || '',
    positionApplied: selectedPosition,
    positionLevel: '',
    mrfTransfer: '',
    source: 'Applicant Form',
    availabilityDate: '',
    status: 'Applied',
    remarks: [
      `Gender: ${document.getElementById('gender')?.value || ''}`,
      `Age: ${document.getElementById('age')?.value || ''}`,
      document.getElementById('remarks')?.value.trim() || ''
    ].filter(Boolean).join(' | '),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    resumeData: uploadedResume ? uploadedResume.dataUrl : '',
    resumeFileName: uploadedResume ? uploadedResume.name : '',
    resumeMimeType: uploadedResume ? uploadedResume.mimeType : '',
    resumeLink: ''
  };
}

function validateForm(record) {
  if (!record.email || !record.phone || !record.fullName || !record.positionApplied || !record.remarks || !record.resumeData) {
    throw new Error('Please complete all required fields, including your resume.');
  }
  return true;
}

function showStatus(message, type = 'success') {
  statusBox.className = 'status-box ' + type;
  statusBox.textContent = message;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function handleResumeSelection(file) {
  if (!file) return;
  uploadedResume = {
    dataUrl: await readFileAsDataURL(file),
    name: file.name,
    mimeType: file.type || 'application/octet-stream'
  };
  resumeName.textContent = file.name;
  resumePreview.style.display = 'flex';
}

resumeUploadBox.addEventListener('click', () => resumeInput.click());
resumeInput.addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) await handleResumeSelection(file);
});

['dragenter', 'dragover'].forEach(type => {
  resumeUploadBox.addEventListener(type, (event) => {
    event.preventDefault();
    resumeUploadBox.style.borderColor = '#ed655c';
  });
});

['dragleave', 'drop'].forEach(type => {
  resumeUploadBox.addEventListener(type, (event) => {
    event.preventDefault();
    resumeUploadBox.style.borderColor = 'rgba(244, 240, 232, 0.14)';
  });
});

resumeUploadBox.addEventListener('drop', async (event) => {
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) await handleResumeSelection(file);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.dataset.originalLabel = submitButton.textContent;
    submitButton.textContent = 'Submitting...';
  }

  let payloadId = '';

  try {
    const payload = getFormRecord();
    validateForm(payload);
    payloadId = `applicant-${Date.now()}`;
    window.HR_PORTAL_SYNC?.beginOptimisticUpdate?.('applicant-form', payloadId, payload, 'Submitting application...');

    await window.HR_PORTAL_SHEETS.request(getSheet2Url(), {
      method: 'POST',
      body: JSON.stringify({ action: 'save-applicant', record: payload })
    });

    window.HR_PORTAL_SYNC?.resolveOptimisticUpdate?.('applicant-form', 'Application submitted successfully.');
    showStatus('Application submitted successfully.', 'success');
    form.reset();
    uploadedResume = null;
    resumePreview.style.display = 'none';
    resumeName.textContent = '';
    applicantOptionsLoaded = false;
    await loadApplicantOptions();
    await renderApplicants();
  } catch (error) {
    window.HR_PORTAL_SYNC?.rejectOptimisticUpdate?.('applicant-form', error.message || 'Something went wrong while submitting your application.');
    showStatus(error.message || 'Something went wrong while submitting your application.', 'error');
  } finally {
    isSubmitting = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.textContent = submitButton.dataset.originalLabel || 'Submit Application';
      delete submitButton.dataset.originalLabel;
    }
  }
});

function getCurrentJobs() {
  try {
    const saved = localStorage.getItem(JOB_STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(defaultJobs));
      return [];
    }

    const parsed = JSON.parse(saved);
    const normalized = Array.isArray(parsed) ? parsed.filter((job) => job && typeof job === 'object') : [];
    const hasLegacyJobs = normalized.some((job) => legacyJobTitles.has(job.title));

    if (hasLegacyJobs) {
      localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify([]));
      return [];
    }

    return normalized;
  } catch (error) {
    return [];
  }
}

async function populateCurrentJobs() {
  if (!currentJobsList) return;

  const selectedJob = new URLSearchParams(window.location.search).get('job');
  let jobs = [];
  try {
    const result = await window.HR_PORTAL_SHEETS.request(`${getSheet1Url()}?action=job-list`);
    jobs = Array.isArray(result.records) ? result.records : [];
  } catch (error) {
    jobs = getCurrentJobs();
  }
  if (!jobs.length) {
    currentJobsList.innerHTML = `
      <li>
        <div class="job-list-btn" style="pointer-events: none; opacity: 0.72;">
          <span class="job-list-top">
            <strong>No active openings</strong>
            <span class="job-list-badge">Wait</span>
          </span>
          <span class="job-list-meta">HR has not posted any open positions yet.</span>
        </div>
      </li>
    `;
    return;
  }

  currentJobsList.innerHTML = jobs.map(job => `
    <li>
      <button type="button" class="job-list-btn ${selectedJob === job.title ? 'is-selected' : ''}" data-position="${job.title}">
        <span class="job-list-top">
          <strong>${job.title}</strong>
          <span class="job-list-badge">Open</span>
        </span>
        <span class="job-list-meta">${job.location || 'Silang Plant'} · ${job.type || 'Full-time'}</span>
      </button>
    </li>
  `).join('');

  currentJobsList.querySelectorAll('.job-list-btn').forEach(button => {
    button.addEventListener('click', () => {
      const positionInput = document.getElementById('positionApplied');
      if (positionInput) positionInput.value = button.dataset.position;
      currentJobsList.querySelectorAll('.job-list-btn').forEach(item => item.classList.toggle('is-selected', item === button));
    });
  });
}

async function renderApplicants() {
  if (!applicantList) return;

  try {
    const result = await window.HR_PORTAL_SHEETS.request(`${getSheet2Url()}?action=applicant-list`);
    const records = Array.isArray(result.records) ? result.records : [];

    if (!records.length) {
      applicantList.innerHTML = '<li><span class="empty-line">No applicants yet.</span></li>';
      return;
    }

    applicantList.innerHTML = records.slice(0, 6).map(record => `
      <li>
        <strong>${record.fullName || 'Applicant'}</strong>
        <span>${record.positionApplied || 'Role pending'} · <span class="badge">${record.status || 'New'}</span></span>
      </li>
    `).join('');
  } catch (error) {
    applicantList.innerHTML = '<li><span class="empty-line">Unable to load applicants.</span></li>';
  }
}

function prefillSelectedJob() {
  const selectedJob = new URLSearchParams(window.location.search).get('job');
  const positionInput = document.getElementById('positionApplied');
  if (!selectedJob || !positionInput) return;

  positionInput.value = decodeURIComponent(selectedJob);
}

async function loadApplicantOptions() {
  if (applicantOptionsLoaded) return;
  if (applicantOptionsRequest) return applicantOptionsRequest;
  applicantOptionsRequest = (async () => {
    try {
      const result = await window.HR_PORTAL_SHEETS.request(`${getSheet2Url()}?action=applicant-options`);
      if (departmentSelect) {
        const departments = Array.isArray(window.STARKSON_DEPARTMENTS) ? window.STARKSON_DEPARTMENTS : [];
        const selectedValue = departmentSelect.value;
        departmentSelect.innerHTML = '<option value="">Select department</option>';
        departments.forEach(department => {
          const option = document.createElement('option');
          option.value = department;
          option.textContent = department;
          departmentSelect.appendChild(option);
        });
        if (departments.includes(selectedValue)) departmentSelect.value = selectedValue;
        departmentSelect.disabled = false;
      }
      applicantOptionsLoaded = true;
    } catch (error) {
      console.warn('Unable to load applicant options:', error);
    } finally {
      applicantOptionsRequest = null;
    }
  })();
  return applicantOptionsRequest;
}

if (departmentSelect) {
  const departments = Array.isArray(window.STARKSON_DEPARTMENTS) ? window.STARKSON_DEPARTMENTS : [];
  departmentSelect.innerHTML = '<option value="">Select department</option>';
  departments.forEach(department => {
    const option = document.createElement('option');
    option.value = department;
    option.textContent = department;
    departmentSelect.appendChild(option);
  });
}

(async function init() {
  if (form) {
    await populateCurrentJobs();
    prefillSelectedJob();
    try {
      await loadApplicantOptions();
    } catch (error) {
      showStatus(error.message || 'Unable to load current MRF and position-level options.', 'error');
    }
    await renderApplicants();
  }
})();
