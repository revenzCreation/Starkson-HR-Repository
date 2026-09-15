function getSheet2Url() {
  const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet2;
  if (!apiUrl) throw new Error('The applicant connection is not configured.');
  return apiUrl;
}

const form = document.getElementById('applicantForm');
const statusBox = document.getElementById('statusBox');
const applicantList = document.getElementById('applicantList');
const resumeUploadBox = document.getElementById('resumeUploadBox');
const resumeInput = document.getElementById('resumeInput');
const resumePreview = document.getElementById('resumePreview');
const resumeName = document.getElementById('resumeName');

let uploadedResume = null;

function getFormRecord() {
  return {
    id: 'APP-' + Date.now(),
    fullName: document.getElementById('fullName').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    positionApplied: document.getElementById('positionApplied').value.trim(),
    department: document.getElementById('department').value.trim(),
    source: document.getElementById('source').value,
    availabilityDate: document.getElementById('availabilityDate').value,
    status: document.getElementById('status').value || 'New',
    remarks: document.getElementById('remarks').value.trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    resumeData: uploadedResume ? uploadedResume.dataUrl : '',
    resumeFileName: uploadedResume ? uploadedResume.name : '',
    resumeMimeType: uploadedResume ? uploadedResume.mimeType : '',
    resumeLink: ''
  };
}

function validateForm(record) {
  if (!record.fullName || !record.email || !record.phone || !record.positionApplied || !record.department || !record.source) {
    throw new Error('Please complete all required fields.');
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

  try {
    const payload = getFormRecord();
    validateForm(payload);

    await window.HR_PORTAL_SHEETS.request(getSheet2Url(), {
      method: 'POST',
      body: JSON.stringify({ action: 'save-applicant', record: payload })
    });

    showStatus('Application submitted successfully.', 'success');
    form.reset();
    uploadedResume = null;
    resumePreview.style.display = 'none';
    resumeName.textContent = '';
    await renderApplicants();
  } catch (error) {
    showStatus(error.message || 'Something went wrong while submitting your application.', 'error');
  }
});

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

(async function init() {
  if (form) {
    await renderApplicants();
  }
})();
