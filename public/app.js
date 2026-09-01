const loginView = document.getElementById('loginView');
const signupView = document.getElementById('signupView');
const appView = document.getElementById('appView');
const dashboardView = document.getElementById('dashboardView');
const patientsView = document.getElementById('patientsView');
const continuityView = document.getElementById('continuityView');
const programmeView = document.getElementById('programmeView');
const roleDashboardView = document.getElementById('roleDashboardView');
const auditView = document.getElementById('auditView');
const navButtons = document.querySelectorAll('.nav-btn');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');
const currentUser = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');
const operationSmileBrand = document.getElementById('operationSmileBrand');
const searchInput = document.getElementById('searchInput');
const patientTableBody = document.getElementById('patientTableBody');
const resultCount = document.getElementById('resultCount');
const patientForm = document.getElementById('patientForm');
const continuityTableBody = document.getElementById('continuityTableBody');
const campaignPanel = document.getElementById('campaignPanel');
const campaignSummaryPanel = document.getElementById('campaignSummaryPanel');
const auditTableBody = document.getElementById('auditTableBody');
const dashboardCards = document.getElementById('dashboardCards');
const executiveAlerts = document.getElementById('executiveAlerts');
const aiInsightsList = document.getElementById('aiInsightsList');
const welcomeLabel = document.getElementById('welcomeLabel');
const savePatientBtn = document.getElementById('savePatientBtn');
const importInput = document.getElementById('importInput');
const exportBtn = document.getElementById('exportBtn');
const downloadReportBtn = document.getElementById('downloadReportBtn');
const createAccountBtn = document.getElementById('createAccountBtn');
const backToLoginBtn = document.getElementById('backToLoginBtn');
const signupForm = document.getElementById('signupForm');
const roleNavBtn = document.getElementById('roleNavBtn');
const auditNavBtn = document.getElementById('auditNavBtn');
const regionDetailsPanel = document.getElementById('regionDetailsPanel');
const roleDashboardContent = document.getElementById('roleDashboardContent');
const roleDashboardTitle = document.getElementById('roleDashboardTitle');
const patientTabButtons = document.querySelectorAll('.patient-tab-btn');
const patientTabContents = document.querySelectorAll('.patient-tab-content');
const assistantFab = document.getElementById('assistantFab');
const assistantPanel = document.getElementById('assistantPanel');
const assistantCloseBtn = document.getElementById('assistantCloseBtn');
const chatbotMessages = document.getElementById('chatbotMessages');
const chatbotInput = document.getElementById('chatbotInput');
const chatbotSendBtn = document.getElementById('chatbotSendBtn');

const fields = [
  'id', 'patient_id', 'patient_uid', 'first_name', 'last_name', 'full_name', 'gender',
  'date_of_birth', 'region', 'phone', 'country_of_birth', 'age_yr_mth', 'weight_kg',
  'allergies', 'cleared_for_surgery', 'procedure', 'surgery_status', 'follow_up_status',
  'follow_up_date', 'recommended_surgery_1', 'surgery_outcome'
];

let selectedPatientId = null;
let activeUser = null;
let activeView = 'dashboard';
let activePatientTab = 'profile';

function normalizeUserRole(role) {
  if (!role) return role;
  if (role === 'administrator') return 'admin';
  if (role === 'campaign-manager') return 'campaign_manager';
  if (role === 'countryManager') return 'country_manager';
  if (role === 'country-manager') return 'country_manager';
  if (role === 'nonSurgicalStaff') return 'non_surgical_staff';
  if (role === 'non-surgical-staff') return 'non_surgical_staff';
  if (role === 'clinicalCoordinator') return 'clinical_coordinator';
  if (role === 'clinical-coordinator') return 'clinical_coordinator';
  return role;
}

function getRoleLabel(role) {
  const labels = {
    admin: 'Admin',
    clinician: 'Clinician',
    campaign_manager: 'Campaign Manager',
    country_manager: 'Country Manager',
    non_surgical_staff: 'Non-surgical Staff',
    clinical_coordinator: 'Clinical Coordinator'
  };
  return labels[role] || 'User';
}

function showView(viewName) {
  activeView = viewName;
  const viewMap = {
    dashboard: dashboardView,
    patients: patientsView,
    continuity: continuityView,
    programme: programmeView,
    'role-dashboard': roleDashboardView,
    audit: auditView,
  };

  Object.entries(viewMap).forEach(([name, view]) => {
    if (!view) return;
    view.classList.toggle('hidden', name !== viewName);
  });

  navButtons.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle('active', isActive);
  });

  if (viewName === 'patients') {
    loadPatients(searchInput.value.trim());
  } else if (viewName === 'programme') {
    loadProgrammeRegion('mtwara');
  } else if (viewName === 'role-dashboard') {
    loadRoleDashboard();
  }
}

function setLoginState(authenticated, user = null) {
  activeUser = user ? { ...user, role: normalizeUserRole(user.role) } : null;
  const displayName = activeUser && (activeUser.displayName || activeUser.username)
    ? activeUser.displayName || activeUser.username
    : 'User';

  if (authenticated) {
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    currentUser.textContent = `Welcome ${displayName}`;
    if (welcomeLabel) welcomeLabel.textContent = `Welcome ${displayName}`;
    logoutBtn.classList.remove('hidden');
    if (operationSmileBrand) operationSmileBrand.classList.remove('hidden');

    const canEdit = activeUser && ['admin', 'clinician'].includes(activeUser.role);
    savePatientBtn.disabled = !canEdit;
    savePatientBtn.title = canEdit ? 'Save patient changes' : 'Read-only access';
    fields.forEach((field) => {
      const el = document.getElementById(field);
      if (el) el.disabled = !canEdit && field !== 'id';
    });

    const isAdmin = activeUser && activeUser.role === 'admin';
    if (auditNavBtn) {
      auditNavBtn.classList.toggle('hidden', !isAdmin);
    }

    if (roleNavBtn) {
      if (isAdmin) {
        roleNavBtn.classList.add('hidden');
      } else if (activeUser) {
        roleNavBtn.classList.remove('hidden');
        roleNavBtn.textContent = `${getRoleLabel(activeUser.role)} Dashboard`;
      }
    }

    showView('dashboard');
  } else {
    loginView.classList.remove('hidden');
    appView.classList.add('hidden');
    currentUser.textContent = 'Not signed in';
    if (welcomeLabel) welcomeLabel.textContent = 'Welcome';
    logoutBtn.classList.add('hidden');
    if (operationSmileBrand) operationSmileBrand.classList.add('hidden');
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function renderDashboard(data = {}) {
  window.__dashboardData = data;
  const summary = data.summary || {};
  const totals = [
    ['Patients registered', data.total || 0, 'All active records'],
    ['Eligible', summary.eligible || 0, 'Ready for review'],
    ['Follow-up due', summary.followUpDue || 0, 'Needs attention'],
    ['Continuity alerts', summary.continuityAlerts || 0, 'Likely matches']
  ];

  const maxRegionValue = Math.max(...((data.regions || []).map((region) => Number(region.value) || 0)), 1);
  const maxStatusValue = Math.max(...((data.statuses || []).map((status) => Number(status.value) || 0)), 1);

  dashboardCards.innerHTML = totals.map(([label, value, note]) => `
    <div class="kpi">
      <small>${label}</small>
      <strong>${value}</strong>
      <span>${note}</span>
    </div>
  `).join('');

  const alertItems = [
    { label: 'Continuity monitoring', value: `${summary.continuityAlerts || 0} likely matches`, tone: 'high' },
    { label: 'Regional focus', value: `${(data.regions || [])[0]?.label || 'N/A'} leads demand`, tone: 'medium' },
    { label: 'Operational actions', value: `${summary.followUpDue || 0} patients need follow-up review`, tone: 'low' }
  ];

  if (executiveAlerts) {
    executiveAlerts.innerHTML = alertItems.map((item) => `
      <div class="alert-chip ${item.tone}">
        <span>${item.label}</span>
        <strong>${item.value}</strong>
      </div>
    `).join('');
  }

  const regionHtml = (data.regions || []).slice(0, 6).map((region) => {
    const width = Math.max((Number(region.value) / maxRegionValue) * 100, 8);
    return `
      <div class="trend-row">
        <span>${region.label}</span>
        <div class="bar-track"><em style="width: ${width}%"></em></div>
        <strong>${region.value}</strong>
      </div>
    `;
  }).join('');

  const statusHtml = (data.statuses || []).slice(0, 6).map((status) => {
    const width = Math.max((Number(status.value) / maxStatusValue) * 100, 8);
    return `
      <div class="trend-row">
        <span>${status.label}</span>
        <div class="bar-track"><em style="width: ${width}%"></em></div>
        <strong>${status.value}</strong>
      </div>
    `;
  }).join('');

  const campaignsHtml = (data.campaigns || []).slice(0, 4).map((campaign) => `
    <div class="campaign-card">
      <div class="campaign-topline">
        <span>${campaign.name}</span>
        <strong>${campaign.patients}</strong>
      </div>
      <small>${campaign.status}</small>
    </div>
  `).join('');

  const summaryHtml = `
    <div class="mini-grid">
      <div class="mini-box">
        <h4>Regional demand</h4>
        ${regionHtml || '<p>No region data yet.</p>'}
      </div>
      <div class="mini-box">
        <h4>Care pathway status</h4>
        ${statusHtml || '<p>No status data yet.</p>'}
      </div>
      <div class="mini-box camp-box">
        <h4>Campaign snapshots</h4>
        ${campaignsHtml || '<p>No campaign data yet.</p>'}
      </div>
    </div>
  `;

  if (campaignPanel) campaignPanel.innerHTML = summaryHtml;
  if (campaignSummaryPanel) campaignSummaryPanel.innerHTML = summaryHtml;

  const insights = (data.aiInsights && data.aiInsights.length > 0) ? data.aiInsights : [
    { title: 'Patient continuity', detail: `${data.total || 0} patients are currently registered in the continuity network.` },
    { title: 'Operational review', detail: 'Regional teams should prioritize patient screening and follow-up review.' },
    { title: 'Clinical readiness', detail: 'Eligible pathways and deferred patients should be tracked weekly by campaign lead.' }
  ];

  aiInsightsList.innerHTML = insights.map((insight) => `
    <li class="insight-item ${insight.severity || 'medium'}">
      <strong>${insight.title}</strong>
      <span>${insight.detail}</span>
    </li>
  `).join('');
}

function renderPatients(rows) {
  patientTableBody.innerHTML = '';
  resultCount.textContent = `${rows.length} result${rows.length === 1 ? '' : 's'}`;

  rows.forEach((patient) => {
    const row = document.createElement('tr');
    row.addEventListener('click', () => selectPatient(patient));
    row.innerHTML = `
      <td>${patient.patient_id || patient.id}</td>
      <td>${patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim()}</td>
      <td>${patient.region || '-'}</td>
      <td>${patient.phone || '-'}</td>
      <td><span class="status-badge">${patient.displayStatus || patient.surgery_status || patient.follow_up_status || 'Pending'}</span></td>
    `;
    patientTableBody.appendChild(row);
  });
}

function fillPatientForm(patient) {
  selectedPatientId = patient.id;
  fields.forEach((field) => {
    const el = document.getElementById(field);
    if (!el) return;

    const value = patient[field] ?? '';
    if (field === 'date_of_birth' || field === 'follow_up_date') {
      el.value = value ? new Date(value).toISOString().slice(0, 10) : '';
    } else {
      el.value = value ?? '';
    }

    const canEdit = activeUser && ['admin', 'clinician'].includes(activeUser.role);
    if (!canEdit && field !== 'id') {
      el.disabled = true;
    } else {
      el.disabled = false;
    }
  });

  const fullName = patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Patient';
  const profileName = document.getElementById('profile_name');
  if (profileName) profileName.value = fullName;

  const profileDob = document.getElementById('profile_date_of_birth');
  if (profileDob) profileDob.value = patient.date_of_birth ? new Date(patient.date_of_birth).toISOString().slice(0, 10) : '';

  const profileGender = document.getElementById('profile_gender');
  if (profileGender) profileGender.value = patient.gender || '';

  const profileRegion = document.getElementById('profile_region');
  if (profileRegion) profileRegion.value = patient.region || '';

  const profilePhone = document.getElementById('profile_phone');
  if (profilePhone) profilePhone.value = patient.phone || '';

  const profileCountry = document.getElementById('profile_country_of_birth');
  if (profileCountry) profileCountry.value = patient.country_of_birth || '';

  const profileAge = document.getElementById('profile_age');
  if (profileAge) profileAge.value = patient.age_yr_mth || '';

  const profileWeight = document.getElementById('profile_weight');
  if (profileWeight) profileWeight.value = patient.weight_kg || '';

  const profileAllergies = document.getElementById('profile_allergies');
  if (profileAllergies) profileAllergies.value = patient.allergies || 'No known allergies recorded';

  const screeningCondition = document.getElementById('screening_condition');
  if (screeningCondition) screeningCondition.value = patient.recommended_surgery_1 || patient.procedure || 'Not recorded';

  const assessmentDate = document.getElementById('assessment_date');
  if (assessmentDate) assessmentDate.value = patient.follow_up_date ? new Date(patient.follow_up_date).toISOString().slice(0, 10) : '';

  const previousSurgeries = document.getElementById('previous_surgeries');
  if (previousSurgeries) previousSurgeries.value = patient.surgery_status || 'No previous surgery details recorded';

  const currentMedications = document.getElementById('current_medications');
  if (currentMedications) currentMedications.value = patient.medications || 'No medication list recorded';

  const screeningOutcome = document.getElementById('screening_outcome');
  if (screeningOutcome) screeningOutcome.value = patient.cleared_for_surgery || patient.surgery_status || 'Screening result pending';

  const clinicalSummary = document.getElementById('clinical_summary');
  if (clinicalSummary) clinicalSummary.value = patient.surgery_outcome || `Patient ${fullName} is being managed for ${patient.recommended_surgery_1 || 'cleft-related care'} in ${patient.region || 'the current programme region'}.`;

  const surgeryDate = document.getElementById('surgery_date');
  if (surgeryDate) surgeryDate.value = patient.follow_up_date ? new Date(patient.follow_up_date).toISOString().slice(0, 10) : '';

  const surgeryProcedure = document.getElementById('surgery_procedure');
  if (surgeryProcedure) surgeryProcedure.value = patient.procedure || patient.recommended_surgery_1 || 'Procedure not assigned';

  const surgeryTeam = document.getElementById('surgery_team');
  if (surgeryTeam) surgeryTeam.value = patient.region ? `${patient.region} surgical team` : 'Regional surgical team';

  const surgeonName = document.getElementById('surgeon_name');
  if (surgeonName) surgeonName.value = patient.surgeon_name || 'Not assigned';

  const anaesthetistName = document.getElementById('anaesthetist_name');
  if (anaesthetistName) anaesthetistName.value = patient.anaesthetist_name || 'Not assigned';

  const surgeryOutcome = document.getElementById('surgery_outcome_detail');
  if (surgeryOutcome) surgeryOutcome.value = patient.surgery_outcome || 'Outcome pending';

  const dischargeStatus = document.getElementById('discharge_status');
  if (dischargeStatus) dischargeStatus.value = patient.follow_up_status || 'Pending discharge review';

  const complicationsNotes = document.getElementById('complications_notes');
  if (complicationsNotes) complicationsNotes.value = patient.surgery_outcome || 'No complications documented';

  const preOpChecklist = document.getElementById('pre_op_checklist');
  if (preOpChecklist) preOpChecklist.value = 'Patient consent verified; pre-op review completed; blood work reviewed; anaesthesia clearance checked; nursing checklist signed.';

  const postOpFollowUp = document.getElementById('post_op_follow_up');
  if (postOpFollowUp) postOpFollowUp.value = 'Post-op review scheduled; wound care instructions provided; feeding guidance reviewed; follow-up visit booked.';
}

function openPatientTab(tabName) {
  activePatientTab = tabName;
  patientTabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle('active', isActive);
  });

  patientTabContents.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.tab !== tabName);
  });
}

function loadProgrammeRegion(region) {
  const normalizedRegion = (region || 'mtwara').toLowerCase();
  const dashboardData = window.__dashboardData || {};
  const regionBreakdown = dashboardData.regionBreakdown || {};
  const regionKey = Object.keys(regionBreakdown).find((key) => key.toLowerCase() === normalizedRegion);
  const selectedData = regionBreakdown[regionKey] || {
    registered: 0,
    screened: 0,
    eligible: 0,
    operated: 0,
    deferred: 0,
    followUpDue: 0
  };

  const labelMap = {
    mtwara: 'Mtwara',
    iringa: 'Iringa'
  };

  const location = labelMap[normalizedRegion] || (regionKey || 'Region');
  const summaryText = `${location} is currently represented in the live patient dataset with ${selectedData.registered || 0} registered records and ${selectedData.followUpDue || 0} follow-up items requiring review.`;

  if (!regionDetailsPanel) return;

  regionDetailsPanel.innerHTML = `
    <div class="region-summary-card">
      <h3>${location} Programme Summary</h3>
      <p>${summaryText}</p>
      <div class="region-metrics-grid">
        <div><span>Registered</span><strong>${selectedData.registered || 0}</strong></div>
        <div><span>Screened</span><strong>${selectedData.screened || 0}</strong></div>
        <div><span>Eligible</span><strong>${selectedData.eligible || 0}</strong></div>
        <div><span>Operated</span><strong>${selectedData.operated || 0}</strong></div>
        <div><span>Deferred</span><strong>${selectedData.deferred || 0}</strong></div>
        <div><span>Follow-up due</span><strong>${selectedData.followUpDue || 0}</strong></div>
      </div>
    </div>
  `;
}

const ROLE_NOTES_KEY = 'os_tz_role_notes';

function getRoleNotes() {
  try {
    const raw = localStorage.getItem(ROLE_NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveRoleNotes(notes) {
  localStorage.setItem(ROLE_NOTES_KEY, JSON.stringify(notes));
}

function submitRoleNote(event) {
  event.preventDefault();
  if (!activeUser) return;

  const form = event.currentTarget;
  const patient = form.querySelector('[name="patientName"]').value.trim();
  const region = form.querySelector('[name="programmeRegion"]').value;
  const category = form.querySelector('[name="noteCategory"]').value;
  const content = form.querySelector('[name="noteContent"]').value.trim();

  if (!patient || !region || !category || !content) {
    alert('Please complete patient name, region, note type, and details before saving.');
    return;
  }

  const notes = getRoleNotes();
  notes.unshift({
    id: Date.now(),
    patient,
    region,
    category,
    content,
    author: activeUser.displayName || activeUser.username,
    authorRole: getRoleLabel(activeUser.role),
    authorUsername: activeUser.username,
    createdAt: new Date().toISOString(),
  });
  saveRoleNotes(notes);
  form.reset();
  loadRoleDashboard();
}

function renderRoleReviewList(notes, currentUserRole) {
  if (!notes || notes.length === 0) {
    return '<div class="role-empty-state">No notes awaiting review.</div>';
  }

  return notes.map((note) => `
    <article class="role-note-item">
      <div class="role-note-meta">
        <strong>${note.patient}</strong>
        <span>${note.region}</span>
      </div>
      <div class="role-note-meta secondary">
        <span>${note.author}</span>
        <span>${note.authorRole}</span>
        <span>${note.category}</span>
      </div>
      <p>${note.content}</p>
      <small>${new Date(note.createdAt).toLocaleString()}</small>
    </article>
  `).join('');
}

function loadRoleDashboard() {
  if (!roleDashboardContent || !activeUser) return;
  const role = activeUser.role || 'clinician';
  const allNotes = getRoleNotes();
  const myNotes = allNotes.filter((note) => note.authorUsername === activeUser.username);
  const reviewers = ['country_manager', 'clinical_coordinator'];

  const roleCards = {
    admin: [
      ['System overview', 'Platform-wide continuity, audit access, and operational oversight'],
      ['National monitoring', 'Track patient movement across all regions and campaign activity'],
      ['Governance', 'Review audit logs, compliance status, and quality assurance actions']
    ],
    clinician: [
      ['Active caseload', 'Review patient readiness, surgical follow-up, and continuity gaps'],
      ['Clinical notes', 'Document screening outcomes and care pathways for each patient'],
      ['Follow-up', 'Prioritize deferred and follow-up patients in the active region']
    ],
    country_manager: [
      ['Regional coverage', 'Monitor Mtwara and Iringa patient flow and campaign readiness'],
      ['Programme planning', 'Assess patient demand and resource allocation by region'],
      ['Strategic reporting', 'Review service coverage, continuity rates, and operational risk']
    ],
    non_surgical_staff: [
      ['Logistics support', 'Track patient movement, travel, and documentation readiness'],
      ['Registration support', 'Ensure patient records are complete and timely'],
      ['Care coordination', 'Support follow-up scheduling and patient communication']
    ],
    clinical_coordinator: [
      ['Care coordination', 'Align screening, surgery scheduling, and follow-up tasks'],
      ['Team review', 'Coordinate surgical teams, theatre readiness, and patient status'],
      ['Continuity support', 'Maintain continuity across region transitions and campaign handovers']
    ],
    campaign_manager: [
      ['Campaign activity', 'Assess patient intake and surgical flow across campaign windows'],
      ['Clinical operations', 'Track eligibility, deferred patients, and campaign logistics'],
      ['Regional team review', 'Coordinate field staff and follow-up planning']
    ]
  };

  if (roleDashboardTitle) {
    roleDashboardTitle.textContent = `${getRoleLabel(role)} Dashboard`;
  }

  const cards = (roleCards[role] || roleCards.clinician).map(([title, text]) => `
    <div class="role-summary-card">
      <h3>${title}</h3>
      <p>${text}</p>
    </div>
  `).join('');

  const noteForm = `
    <form id="roleNoteForm" class="role-note-form">
      <div class="role-form-grid">
        <label>
          <span>Patient name</span>
          <input type="text" name="patientName" placeholder="Enter patient name" required />
        </label>
        <label>
          <span>Programme region</span>
          <select name="programmeRegion" required>
            <option value="">Select region</option>
            <option value="Mtwara">Mtwara</option>
            <option value="Iringa">Iringa</option>
          </select>
        </label>
        <label>
          <span>Note category</span>
          <select name="noteCategory" required>
            <option value="">Select note type</option>
            <option value="Clinical note">Clinical note</option>
            <option value="Screening outcome">Screening outcome</option>
            <option value="Surgery outcome">Surgery outcome</option>
            <option value="Complication">Complication</option>
            <option value="Follow-up action">Follow-up action</option>
          </select>
        </label>
      </div>
      <label class="full-width">
        <span>Details</span>
        <textarea name="noteContent" rows="5" placeholder="Document clinical observations, complications, surgery details, or follow-up actions..." required></textarea>
      </label>
      <div class="role-form-footer">
        <button type="submit" class="primary-btn">Save note</button>
      </div>
    </form>
  `;

  const reviewSection = reviewers.includes(role)
    ? `
      <div class="role-panel-block">
        <h3>Review queue</h3>
        <div class="role-note-list">
          ${renderRoleReviewList(allNotes.filter((note) => note.authorUsername !== activeUser.username), role)}
        </div>
      </div>
    `
    : `
      <div class="role-panel-block">
        <h3>My submitted notes</h3>
        <div class="role-note-list">
          ${renderRoleReviewList(myNotes, role)}
        </div>
      </div>
    `;

  roleDashboardContent.innerHTML = `
    <div class="role-dashboard-grid">
      ${cards}
    </div>
    <div class="role-panel-block">
      <h3>Clinical documentation</h3>
      ${noteForm}
    </div>
    ${reviewSection}
  `;

  const roleNoteForm = document.getElementById('roleNoteForm');
  if (roleNoteForm) {
    roleNoteForm.addEventListener('submit', submitRoleNote);
  }
}

function toggleAssistant(forceOpen = null) {
  if (!assistantPanel || !assistantFab) return;
  const shouldOpen = forceOpen === null ? assistantPanel.classList.contains('hidden') : forceOpen;
  assistantPanel.classList.toggle('hidden', !shouldOpen);
  if (shouldOpen) {
    chatbotInput?.focus();
  }
}

function appendChatbotMessage(sender, text) {
  if (!chatbotMessages) return;
  const message = document.createElement('div');
  message.className = `chat-message ${sender}`;
  message.textContent = text;
  chatbotMessages.appendChild(message);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function getCleftAssistantReply(message) {
  const text = (message || '').toLowerCase();

  if (text.includes('what is') || text.includes('define') || text.includes('cleft lip')) {
    return 'Cleft lip and cleft palate are congenital birth differences where the upper lip and/or roof of the mouth do not fully join during early fetal development. They are not caused by anything a parent did or did not do during pregnancy.';
  }

  if (text.includes('cause') || text.includes('reason')) {
    return 'The causes are usually multifactorial, involving genetics and environmental factors such as maternal nutrition, smoking, alcohol exposure, certain medications, or other risk factors during early pregnancy.';
  }

  if (text.includes('sign') || text.includes('symptom')) {
    return 'Common signs include an opening in the upper lip, a gap in the roof of the mouth, difficulty feeding, nasal air leakage, repeated ear infections, and speech difficulties.';
  }

  if (text.includes('surgery') || text.includes('treatment')) {
    return 'Treatment is usually multidisciplinary and may include surgery for the lip and palate, speech therapy, orthodontic care, feeding support, ENT review, and psychosocial support. Timing depends on the child’s age and overall health.';
  }

  if (text.includes('feeding') || text.includes('nutrition')) {
    return 'Feeding support is important. Special bottles, squeezable feeders, and positioning techniques can help babies feed safely and gain weight while avoiding aspiration.';
  }

  if (text.includes('speech') || text.includes('language')) {
    return 'Many children need speech therapy because cleft palate can affect resonance, articulation, and intelligibility. Early therapy and regular reassessment improve outcomes.';
  }

  if (text.includes('care') || text.includes('after surgery')) {
    return 'After surgery, patients require wound care instructions, pain management, feeding guidance, follow-up visits, and monitoring for complications such as infection, bleeding, or speech delays.';
  }

  if (text.includes('team') || text.includes('who treats')) {
    return 'A cleft care team often includes a surgeon, pediatrician, speech therapist, orthodontist, ENT specialist, feeding specialist, and psychologist or social worker.';
  }

  return 'Cleft lip and palate are treatable conditions with early identification, multidisciplinary care, and regular follow-up. Common topics include diagnosis, feeding support, surgery planning, speech therapy, and psychosocial support. Ask about surgery, feeding, speech, or causes for more detail.';
}

function normalizeContinuityStatus(value, fallback, stage = 'before') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'yes' || normalized === 'y') {
    return stage === 'before' ? 'screened' : 'surgery performed';
  }
  if (/(screened|eligible|awaiting|pending|deferred|follow-up|not eligible|review)/i.test(normalized)) return 'screened';
  if (/(surgery|operation|operated|performed|completed|post-op|discharge|done)/i.test(normalized)) return 'surgery performed';
  return stage === 'before' ? 'screened' : 'surgery performed';
}

function renderContinuity(rows) {
  if (!rows || rows.length === 0) {
    continuityTableBody.innerHTML = '<tr><td colspan="4">No continuity matches found.</td></tr>';
    return;
  }

  continuityTableBody.innerHTML = rows.map((match) => {
    const patientName = match.patientA.full_name || match.patientB.full_name || 'Patient';
    const statusBefore = normalizeContinuityStatus(match.statusBefore || match.patientA.surgery_status || match.patientA.follow_up_status || match.patientA.cleared_for_surgery, 'screened', 'before');
    const statusAfter = normalizeContinuityStatus(match.statusAfter || match.patientB.surgery_status || match.patientB.follow_up_status || match.patientB.cleared_for_surgery, 'surgery performed', 'after');

    return `
      <tr>
        <td>${patientName}</td>
        <td><span class="status-badge">${statusBefore}</span></td>
        <td><span class="status-badge strong-badge">${statusAfter}</span></td>
        <td><span class="status-badge strong-badge">${match.score}</span></td>
      </tr>
    `;
  }).join('');
}

function renderAudit(rows) {
  if (!rows || rows.length === 0) {
    auditTableBody.innerHTML = '<tr><td colspan="4">No audit entries available.</td></tr>';
    return;
  }

  auditTableBody.innerHTML = rows.map((row) => {
    const details = JSON.parse(row.details || '{}');
    const detailText = typeof details === 'object' ? JSON.stringify(details) : String(details);
    return `
      <tr>
        <td>${row.actor || '-'}</td>
        <td>${row.action || '-'}</td>
        <td>${detailText}</td>
        <td>${new Date(row.created_at).toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}

async function loadPatients(query = '') {
  try {
    const patients = await fetchJson(`/api/patients?q=${encodeURIComponent(query)}`);
    renderPatients(patients);
    if (activeView === 'patients' && patients.length > 0) {
      fillPatientForm(patients[0]);
    }
  } catch (error) {
    console.error(error);
  }
}

async function loadDashboard() {
  try {
    const dashboard = await fetchJson('/api/dashboard');
    renderDashboard(dashboard);
  } catch (error) {
    console.error(error);
  }

  try {
    const continuity = await fetchJson('/api/continuity');
    renderContinuity(continuity);
  } catch (error) {
    console.error(error);
  }

  if (activeUser && ['admin', 'clinician'].includes(activeUser.role)) {
    try {
      const audit = await fetchJson('/api/audit');
      renderAudit(audit);
    } catch (error) {
      console.error(error);
    }
  } else {
    auditTableBody.innerHTML = '<tr><td colspan="4">Audit trail requires clinician or admin access.</td></tr>';
  }
}

function selectPatient(patient) {
  fillPatientForm(patient);
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

patientTabButtons.forEach((button) => {
  button.addEventListener('click', () => openPatientTab(button.dataset.tab));
});

document.querySelectorAll('.region-btn').forEach((button) => {
  button.addEventListener('click', () => {
    loadProgrammeRegion(button.dataset.region);
    document.querySelectorAll('.region-btn').forEach((item) => item.classList.toggle('active', item === button));
  });
});

if (assistantFab) {
  assistantFab.addEventListener('click', () => toggleAssistant());
}

if (assistantCloseBtn) {
  assistantCloseBtn.addEventListener('click', () => toggleAssistant(false));
}

if (chatbotSendBtn && chatbotInput) {
  chatbotSendBtn.addEventListener('click', () => {
    const text = chatbotInput.value.trim();
    if (!text) return;
    appendChatbotMessage('user', text);
    chatbotInput.value = '';
    appendChatbotMessage('bot', getCleftAssistantReply(text));
  });

  chatbotInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      chatbotSendBtn.click();
    }
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await fetchJson('/api/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setLoginState(true, result.user);
    loginError.classList.add('hidden');
    await loadDashboard();
    await loadPatients();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.classList.remove('hidden');
  }
});

if (createAccountBtn) {
  createAccountBtn.addEventListener('click', () => {
    loginView.classList.add('hidden');
    signupView.classList.remove('hidden');
  });
}

if (backToLoginBtn) {
  backToLoginBtn.addEventListener('click', () => {
    signupView.classList.add('hidden');
    loginView.classList.remove('hidden');
    signupError.classList.add('hidden');
    signupForm.reset();
  });
}

if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fullName = signupForm.querySelector('[name="fullName"]').value.trim();
    const email = signupForm.querySelector('[name="email"]').value.trim();
    const username = signupForm.querySelector('[name="username"]').value.trim();
    const password = signupForm.querySelector('[name="password"]').value;
    const confirmPassword = signupForm.querySelector('[name="confirmPassword"]').value;
    const role = signupForm.querySelector('[name="role"]').value;

    if (!fullName || !email || !username || !password || !confirmPassword || !role) {
      signupError.textContent = 'All fields are required.';
      signupError.classList.remove('hidden');
      return;
    }

    if (password !== confirmPassword) {
      signupError.textContent = 'Passwords do not match.';
      signupError.classList.remove('hidden');
      return;
    }

    if (password.length < 8) {
      signupError.textContent = 'Password must be at least 8 characters.';
      signupError.classList.remove('hidden');
      return;
    }

    try {
      const result = await fetchJson('/api/signup', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, username, password, role }),
      });
      alert('Account created successfully! You can now log in.');
      signupView.classList.add('hidden');
      loginView.classList.remove('hidden');
      signupForm.reset();
      signupError.classList.add('hidden');
      loginForm.querySelector('[name="username"]').value = username;
      loginForm.querySelector('[name="password"]').value = '';
    } catch (error) {
      signupError.textContent = error.message;
      signupError.classList.remove('hidden');
    }
  });
}

logoutBtn.addEventListener('click', async () => {
  try {
    await fetchJson('/api/logout', { method: 'POST' });
    setLoginState(false);
    patientTableBody.innerHTML = '';
    continuityTableBody.innerHTML = '';
    auditTableBody.innerHTML = '';
    dashboardCards.innerHTML = '';
  } catch (error) {
    console.error(error);
  }
});

searchInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter') {
    await loadPatients(searchInput.value.trim());
  }
});

document.getElementById('searchBtn').addEventListener('click', async () => {
  await loadPatients(searchInput.value.trim());
});

document.getElementById('resetBtn').addEventListener('click', () => {
  searchInput.value = '';
  loadPatients();
});

exportBtn.addEventListener('click', () => {
  if (!activeUser) return;
  window.location.href = '/api/patients/export';
});

downloadReportBtn.addEventListener('click', () => {
  if (!activeUser) return;
  window.print();
});

importInput.addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const text = await file.text();
  try {
    const result = await fetchJson('/api/patients/import', {
      method: 'POST',
      body: JSON.stringify(text),
    });
    alert(`${result.imported} patient records imported.`);
    await loadDashboard();
    await loadPatients(searchInput.value.trim());
  } catch (error) {
    alert(error.message);
  } finally {
    importInput.value = '';
  }
});

patientForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedPatientId) return;
  if (!activeUser || !['admin', 'clinician'].includes(activeUser.role)) {
    alert('Only admin and clinician roles can edit patient details.');
    return;
  }

  const payload = {};
  fields.forEach((field) => {
    if (field === 'id') return;
    const el = document.getElementById(field);
    payload[field] = el ? el.value : '';
  });

  try {
    await fetchJson(`/api/patients/${selectedPatientId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await loadDashboard();
    await loadPatients(searchInput.value.trim());
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
});

async function boot() {
  openPatientTab('profile');
  loadProgrammeRegion('mtwara');
  if (chatbotMessages) {
    appendChatbotMessage('bot', 'I can explain cleft lip and palate, feeding, screening, surgery, and follow-up support.');
  }

  try {
    const session = await fetchJson('/api/session');
    if (session.authenticated) {
      setLoginState(true, session.user);
      await loadDashboard();
      await loadPatients();
    } else {
      setLoginState(false);
    }
  } catch (error) {
    setLoginState(false);
  }
}

boot();
