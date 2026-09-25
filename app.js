/**
 * FOUND@ANS — Secondary School Lost & Found Web Portal
 * UI rendering, navigation, and form workflows for the browser-only demo.
 * Data, persistence, image processing, search, and UI effects live in separate scripts.
 */

import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "./firebase-auth.js";
import {
  fetchItems,
  fetchStats,
  createItem,
  fetchLostReports,
  createLostReport,
  updateLostReportStatus,
  createHandover,
  deleteItem
} from "./api.js";

// Seed data and persistence are separated into small classic scripts so index.html
// remains usable when opened directly from disk.
const { GENERIC_FALLBACK_IMG } = window.FOUND_ANS_DATA;
const state = window.FOUND_ANS_STATE;

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getItemImageData(item) {
  return item.image?.data || item.image?.url || item.imageUrl || GENERIC_FALLBACK_IMG;
}

function createEmbeddedImage(dataUrl) {
  const [header, encoded] = dataUrl.split(",", 2);
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return {
    kind: "embedded",
    data: dataUrl,
    contentType: header.match(/^data:([^;]+)/)?.[1] || "image/webp",
    byteLength: Math.floor(encoded.length * 3 / 4) - padding
  };
}

// --- DOM ELEMENTS & CONTROLLERS ---
const views = {
  viewLogin: document.getElementById("viewLogin"),
  viewItems: document.getElementById("viewItems"),
  viewInstructions: document.getElementById("viewInstructions"),
  viewLostReports: document.getElementById("viewLostReports"),
  viewAuthorityProtocol: document.getElementById("viewAuthorityProtocol"),
  viewDigestPreview: document.getElementById("viewDigestPreview")
};

const navTabs = document.getElementById("navTabs");
const navRightSection = document.getElementById("navRightSection");
const itemsGrid = document.getElementById("itemsGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const btnClearSearch = document.getElementById("btnClearSearch");
const btnSearchTrigger = document.getElementById("btnSearchTrigger");
const toggleHighValue = document.getElementById("toggleHighValue");
const categorySelect = document.getElementById("categorySelect");
const authorityStatusWrap = document.getElementById("authorityStatusWrap");
const authorityStatusSelect = document.getElementById("authorityStatusSelect");
const authorityActionsHeader = document.getElementById("authorityActionsHeader");
const sortSelect = document.getElementById("sortSelect");
const btnEmptyReset = document.getElementById("btnEmptyReset");

// Modals
const addItemModal = document.getElementById("addItemModal");
const btnOpenAddModal = document.getElementById("btnOpenAddModal");
const btnCloseAddModal = document.getElementById("btnCloseAddModal");
const btnCancelAdd = document.getElementById("btnCancelAdd");
const addItemForm = document.getElementById("addItemForm");

const claimModal = document.getElementById("claimModal");
const btnCancelClaim = document.getElementById("btnCancelClaim");
const claimForm = document.getElementById("claimForm");

const detailModal = document.getElementById("detailModal");
const btnCloseDetailModal = document.getElementById("btnCloseDetailModal");
const detailItemTitle = document.getElementById("detailItemTitle");
const detailItemRefCode = document.getElementById("detailItemRefCode");
const detailItemBody = document.getElementById("detailItemBody");

const reportLostModal = document.getElementById("reportLostModal");
const btnStudentReportLost = document.getElementById("btnStudentReportLost");
const btnCloseReportLostModal = document.getElementById("btnCloseReportLostModal");
const btnCancelReportLost = document.getElementById("btnCancelReportLost");

const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmModalCancel = document.getElementById("confirmModalCancel");
const confirmModalConfirm = document.getElementById("confirmModalConfirm");

function showCustomConfirm({ title = "Are you sure?", message = "This action cannot be undone.", confirmText = "Confirm", isDanger = true } = {}) {
  return new Promise((resolve) => {
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmModalConfirm.textContent = confirmText;
    confirmModalConfirm.className = isDanger ? "btn btn-danger" : "btn btn-purple";

    const cleanup = () => {
      confirmModal.classList.remove("active");
      confirmModalCancel.removeEventListener("click", onCancel);
      confirmModalConfirm.removeEventListener("click", onConfirm);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    confirmModalCancel.addEventListener("click", onCancel);
    confirmModalConfirm.addEventListener("click", onConfirm);
    confirmModal.classList.add("active");
  });
}
const reportLostForm = document.getElementById("reportLostForm");

// Photo Dropzone
const photoDropzone = document.getElementById("photoDropzone");
const itemPhotoFile = document.getElementById("itemPhotoFile");
const dropzonePrompt = document.getElementById("dropzonePrompt");
const dropzonePreview = document.getElementById("dropzonePreview");
const previewImg = document.getElementById("previewImg");
const btnClearPhoto = document.getElementById("btnClearPhoto");
const photoDataUrl = document.getElementById("photoDataUrl");

// --- NAVIGATION & ROUTING ---
function updateNavIndicator() {
  const indicator = document.getElementById("navIndicator");
  const activeLink = navTabs.querySelector(".nav-link.active");
  if (!indicator || !activeLink) {
    if (indicator) indicator.style.opacity = "0";
    return;
  }

  const tabRect = navTabs.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();
  const left = linkRect.left - tabRect.left;
  const width = linkRect.width;

  indicator.style.width = `${width}px`;
  indicator.style.transform = `translateX(${left}px)`;
  indicator.style.opacity = "1";
}

function navigateTo(viewId) {
  Object.values(views).forEach(v => {
    if (v) v.classList.remove("active");
  });

  const targetView = views[viewId];
  if (targetView) {
    targetView.classList.add("active");
    state.currentView = viewId;
  }

  // Update tab highlights
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.view === viewId);
  });

  updateNavIndicator();

  if (viewId === "viewLostReports") {
    renderLostReports();
  } else if (viewId === "viewDigestPreview") {
    renderDigestEmail();
  }
}

function renderNav() {
  navTabs.innerHTML = "";
  navRightSection.innerHTML = "";
  
  if (!state.currentUser) {
    return;
  }

  const role = state.currentUser.role;

  // Tabs for FOUND@ANS
  const links = [
    { id: "viewItems", label: "Browse items" }
  ];

  if (role === "STUDENT") {
    links.push({ id: "viewInstructions", label: "How it works" });
  } else if (role === "AUTHORITY") {
    links.push({ id: "viewLostReports", label: "Lost reports" });
  }

  links.forEach(l => {
    const btn = document.createElement("button");
    btn.className = `nav-link ${state.currentView === l.id ? 'active' : ''}`;
    btn.dataset.view = l.id;
    const wopMarker = " ( WOP )";
    if (l.label.endsWith(wopMarker)) {
      btn.append(document.createTextNode(l.label.slice(0, -wopMarker.length)));
      const marker = document.createElement("span");
      marker.className = "nav-status-marker";
      marker.textContent = "( WOP )";
      btn.append(marker);
    } else {
      btn.textContent = l.label;
    }
    btn.addEventListener("click", () => navigateTo(l.id));
    navTabs.appendChild(btn);
  });

  const indicator = document.createElement("span");
  indicator.className = "nav-indicator";
  indicator.id = "navIndicator";
  navTabs.appendChild(indicator);

  // Position indicator smoothly on next paint
  requestAnimationFrame(() => updateNavIndicator());

  // Action Button on top right
  if (role === "AUTHORITY") {
    const reportBtn = document.createElement("button");
    reportBtn.className = "btn btn-purple nav-action-btn";
    reportBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Log found item`;
    reportBtn.addEventListener("click", openAddModal);
    navRightSection.appendChild(reportBtn);
  } else if (role === "STUDENT") {
    const studentReportBtn = document.createElement("button");
    studentReportBtn.className = "btn btn-purple nav-action-btn";
    studentReportBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Report lost item`;
    studentReportBtn.addEventListener("click", () => {
      document.getElementById("reportLostDate").value = new Date().toISOString().split("T")[0];
      const emailField = document.getElementById("reportLostStudentEmail");
      const nameField = document.getElementById("reportLostStudentName");
      if (emailField) emailField.value = state.currentUser?.email || "";
      if (nameField && !nameField.value) nameField.value = state.currentUser?.name || "";
      reportLostModal.classList.add("active");
    });
    navRightSection.appendChild(studentReportBtn);
  }

  // User Profile Chip
  const roleText = role === "AUTHORITY" ? "Authority" : "Student";
  const userChip = document.createElement("div");
  userChip.className = "user-badge";
  userChip.innerHTML = `
    <div class="user-avatar-mini">${state.currentUser.name.charAt(0).toUpperCase()}</div>
    <div style="display:flex; flex-direction:column; line-height:1.1;">
      <span class="user-name-txt">${state.currentUser.name}</span>
      <span class="user-role-label">${roleText}</span>
    </div>
  `;
  navRightSection.appendChild(userChip);

  // Sign out button
  const signOutBtn = document.createElement("button");
  signOutBtn.className = "btn-signout-mini";
  signOutBtn.title = "Sign out";
  signOutBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i>`;
  signOutBtn.addEventListener("click", handleSignOut);
  navRightSection.appendChild(signOutBtn);
}

// --- FIREBASE AUTHENTICATION ---
async function getAuthenticatedUser(firebaseUser) {
  const tokenResult = await firebaseUser.getIdTokenResult(true);
  const email = firebaseUser.email?.trim().toLowerCase() || "";
  const emailName = email.split("@")[0] || "Account";
  const displayName = firebaseUser.displayName
    || emailName.charAt(0).toUpperCase() + emailName.slice(1);

  // UI role hints come from signed Firebase custom claims.
  // The server must still enforce the role for every protected read/write.
  const role = tokenResult.claims.authority === true || tokenResult.claims.role === "AUTHORITY"
    ? "AUTHORITY"
    : "STUDENT";

  return {
    uid: firebaseUser.uid,
    email,
    name: displayName,
    role
  };
}

function renderSkeletonGrid(count = 6) {
  if (!itemsGrid) return;
  emptyState.style.display = "none";
  itemsGrid.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-box skeleton-media"></div>
      <div class="skeleton-content">
        <div class="skeleton-box skeleton-badge"></div>
        <div class="skeleton-box skeleton-title"></div>
        <div class="skeleton-box skeleton-line"></div>
        <div class="skeleton-box skeleton-line" style="width: 50%;"></div>
        <div class="skeleton-box skeleton-btn"></div>
      </div>
    </div>
  `).join("");
}

let isLoadingServerData = false;

async function loadServerData() {
  if (window.location.protocol === "file:" || isLoadingServerData) return;
  isLoadingServerData = true;
  // If there are no items currently displayed, show skeleton placeholder
  if (state.items.length === 0) {
    renderSkeletonGrid(3);
  }
  try {
    const isAuthority = state.currentUser?.role === "AUTHORITY";
    const statusParam = isAuthority ? (state.authorityStatusFilter || "ACTIVE") : "ACTIVE";
    const items = await fetchItems(statusParam);
    if (Array.isArray(items)) {
      state.setItems(items);
      renderItemsList();
    }
  } catch (err) {
    console.warn("Could not sync items from Firestore:", err.message);
    renderItemsList();
  } finally {
    isLoadingServerData = false;
  }

  if (state.currentUser?.role === "AUTHORITY") {
    try {
      const reports = await fetchLostReports();
      if (Array.isArray(reports)) {
        state.setLostReports(reports);
        renderLostReports();
      }
    } catch (err) {
      console.warn("Could not sync lost reports from Firestore:", err.message);
    }
  }
}

async function showAuthenticatedView(user) {
  state.setCurrentUser(user);
  renderNav();

  if (user.role === "AUTHORITY") {
    if (authorityActionsHeader) authorityActionsHeader.style.display = "block";
    authorityStatusWrap.style.display = "inline-block";
    if (btnStudentReportLost) btnStudentReportLost.style.display = "none";
  } else {
    if (authorityActionsHeader) authorityActionsHeader.style.display = "none";
    authorityStatusWrap.style.display = "none";
    if (btnStudentReportLost) btnStudentReportLost.style.display = "inline-flex";
  }

  navigateTo("viewItems");
  await loadServerData();
}

async function handleLogin(email, password, mode = "signin") {
  if (mode === "signup") {
    await createUserWithEmailAndPassword(auth, email, password);
  } else {
    await signInWithEmailAndPassword(auth, email, password);
  }
  // onAuthStateChanged will handle showAuthenticatedView cleanly without double-firing
}

async function handleSignOut() {
  await signOut(auth);
  state.setCurrentUser(null);
  renderNav();
  navigateTo("viewLogin");
}

// --- AUTHORITY LOST-ITEM REPORT INBOX ---
function renderLostReports() {
  const list = document.getElementById("lostReportsList");
  const empty = document.getElementById("lostReportsEmpty");
  const count = document.getElementById("lostReportsCount");
  if (!list || !empty || !count) return;

  const reports = state.lostReports || [];
  const openCount = reports.filter(report => report.status === "OPEN").length;
  count.textContent = `${openCount} open`;
  list.innerHTML = "";
  empty.hidden = reports.length > 0;

  reports.forEach(report => {
    const card = document.createElement("article");
    card.className = `lost-report-card ${report.status === "OPEN" ? "is-open" : "is-reviewed"}`;

    const header = document.createElement("div");
    header.className = "lost-report-card-header";
    const title = document.createElement("h2");
    title.textContent = report.title;
    const status = document.createElement("span");
    status.className = `report-status ${report.status === "OPEN" ? "open" : "reviewed"}`;
    status.textContent = report.status === "OPEN" ? "Needs review" : "Reviewed";
    header.append(title, status);

    const details = document.createElement("dl");
    details.className = "report-detail-grid";
    [
      ["Reported by", `${report.studentName} · ${report.studentEmail}`],
      ["Category", report.category.replaceAll("_", " ")],
      ["Date lost", report.dateLost],
      ["Last seen", report.lastSeen],
      ["Private ownership clue", report.secretDetail || "No clue provided"]
    ].forEach(([label, value]) => {
      const group = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      group.append(term, description);
      details.appendChild(group);
    });

    const actions = document.createElement("div");
    actions.className = "report-actions";
    const searchButton = document.createElement("button");
    searchButton.type = "button";
    searchButton.className = "btn btn-secondary report-search-button";
    searchButton.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Check catalog';
    searchButton.addEventListener("click", () => {
      state.activeCategory = "ALL";
      categoryPills.querySelectorAll(".cat-pill").forEach(pill => pill.classList.toggle("active", pill.dataset.cat === "ALL"));
      searchInput.value = report.title;
      state.activeSearchQuery = report.title;
      btnClearSearch.style.display = "block";
      navigateTo("viewItems");
    });
    actions.appendChild(searchButton);

    if (report.status === "OPEN") {
      const reviewButton = document.createElement("button");
      reviewButton.type = "button";
      reviewButton.className = "btn btn-purple";
      reviewButton.innerHTML = '<i class="fa-solid fa-check"></i> Mark reviewed';
      reviewButton.addEventListener("click", async () => {
        try {
          if (window.location.protocol !== "file:") {
            await updateLostReportStatus(report.id, "REVIEWED");
          }
          state.updateLostReport(report.id, "REVIEWED");
          renderLostReports();
        } catch (err) {
          showToast("Error", err.message || "Failed to update report", "warning");
        }
      });
      actions.appendChild(reviewButton);
    }

    card.append(header, details, actions);
    list.appendChild(card);
  });
}

// --- RENDER ITEMS LIST ---
function renderItemsList() {
  let filtered = [...state.items];
  const role = state.currentUser ? state.currentUser.role : "STUDENT";

  // 1. Status Filter
  if (role === "STUDENT") {
    filtered = filtered.filter(item => item.status === "ACTIVE");
  } else {
    if (state.authorityStatusFilter !== "ALL") {
      filtered = filtered.filter(item => item.status === state.authorityStatusFilter);
    }
  }

  // 2. Category Filter
  if (state.activeCategory !== "ALL") {
    filtered = filtered.filter(item => item.category === state.activeCategory);
  }

  // 3. High-Value Toggle
  if (state.filterHighValueOnly) {
    filtered = filtered.filter(item => item.isHighValue);
  }

  // 4. AI Keyword Matcher
  if (state.activeSearchQuery.trim() !== "") {
    filtered = performAiSearch(filtered, state.activeSearchQuery);
  }

  // 5. Sorting
  if (state.sortBy === "NEWEST") {
    filtered.sort((a, b) => new Date(b.foundDate || 0) - new Date(a.foundDate || 0));
  } else if (state.sortBy === "DEADLINE") {
    filtered.sort((a, b) => new Date(a.claimDeadline || '2099-01-01') - new Date(b.claimDeadline || '2099-01-01'));
  } else if (state.sortBy === "TITLE") {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  itemsGrid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.style.display = "block";
    itemsGrid.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  itemsGrid.style.display = "grid";

  // Staggered cascade entrance animation
  filtered.forEach((item, index) => {
    const card = createItemCard(item, role);
    card.style.animationDelay = `${index * 55}ms`;
    itemsGrid.appendChild(card);
  });
}

function createItemCard(item, role) {
  const card = document.createElement("div");
  card.className = "item-card-minimal";

  const isClaimed = item.status === "CLAIMED";

  // Deadline calculation
  const deadlineDate = new Date(item.claimDeadline);
  const today = new Date();
  const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
  const isUrgent = diffDays <= 5 && diffDays >= 0;

  const categoryName = item.category ? item.category.replace('_', ' ').toLowerCase() : 'item';
  const formattedCategory = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);

  card.innerHTML = `
    <div class="card-media">
      <img src="${getItemImageData(item)}" alt="${escapeHtml(item.title)}" loading="lazy" />
      <span class="category-tag-minimal">${escapeHtml(formattedCategory)}</span>
      ${item.isHighValue ? `<span class="high-value-dot" title="High-Value Item"><i class="fa-solid fa-star"></i></span>` : ''}
      ${isClaimed ? `
        <div class="claimed-mask">
          <i class="fa-solid fa-circle-check"></i>
          <span>RETURNED</span>
        </div>
      ` : ''}
    </div>
    
    <div class="card-content">
      <div class="card-header-row">
        <h3 class="card-item-title">${escapeHtml(item.title)}</h3>
        <span class="card-item-code">${escapeHtml(item.itemCode)}</span>
      </div>

      <div class="card-meta-line">
        <span>${escapeHtml(item.foundLocation)}</span>
        <span class="meta-dot">&middot;</span>
        <span>${escapeHtml(item.foundDate)}</span>
        ${isUrgent && !isClaimed ? `
          <span class="meta-dot">&middot;</span>
          <span class="urgent-text">${diffDays > 0 ? `${diffDays}d left` : 'Expired'}</span>
        ` : ''}
      </div>

      ${role === "AUTHORITY" && !isClaimed ? `
        <div class="card-quick-actions" onclick="event.stopPropagation()">
          <button class="btn-handover-inline btn-claim-action" data-id="${item.id}" title="Hand over to student">
            <i class="fa-solid fa-handshake"></i> Handover
          </button>
        </div>
      ` : ''}
    </div>
  `;

  // Bind actions
  const mediaContainer = card.querySelector(".card-media");
  const imgEl = card.querySelector(".card-media img");

  function handleImageError() {
    if (imgEl.src !== GENERIC_FALLBACK_IMG) {
      imgEl.src = GENERIC_FALLBACK_IMG;
    } else {
      mediaContainer.classList.remove("is-loading");
      imgEl.classList.add("is-loaded");
    }
  }

  if (imgEl) {
    mediaContainer.classList.add("is-loading");
    if (imgEl.complete && imgEl.naturalWidth > 0) {
      mediaContainer.classList.remove("is-loading");
      imgEl.classList.add("is-loaded");
    } else {
      imgEl.addEventListener("load", () => {
        mediaContainer.classList.remove("is-loading");
        imgEl.classList.add("is-loaded");
      });
      imgEl.addEventListener("error", handleImageError);
    }
  }

  // Entire card is clickable to view details
  card.addEventListener("click", () => openDetailModal(item, role));

  const claimBtn = card.querySelector(".btn-claim-action");
  if (claimBtn) {
    claimBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openClaimModal(item);
    });
  }

  return card;
}

// --- ITEM DETAIL LIGHTBOX ---
function openDetailModal(item, role) {
  detailItemTitle.textContent = item.title;
  detailItemRefCode.textContent = item.itemCode;

  // Compute remaining days
  const deadlineDate = new Date(item.claimDeadline);
  const today = new Date();
  const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
  const isUrgent = diffDays <= 5 && diffDays >= 0;

  detailItemBody.innerHTML = `
    <div class="clean-detail-wrap">
      <div class="clean-detail-grid">
        <!-- Media -->
        <div class="clean-img-box">
          <img src="${getItemImageData(item)}" alt="${escapeHtml(item.title)}" onerror="this.src='${GENERIC_FALLBACK_IMG}'" />
        </div>

        <!-- Details -->
        <div class="clean-content-stack">
          <!-- Description -->
          <p class="clean-desc-text">${escapeHtml(item.publicDescription)}</p>

          <!-- Structured Info List (No pills) -->
          <div class="clean-info-list">
            <div class="clean-info-row">
              <span class="clean-info-icon" aria-hidden="true"><i class="fa-regular fa-calendar"></i></span>
              <span class="clean-info-label">Found:</span>
              <span class="clean-info-val">${escapeHtml(item.foundDate)} &mdash; ${escapeHtml(item.foundLocation)}</span>
            </div>

            <div class="clean-info-row">
              <span class="clean-info-icon" aria-hidden="true"><i class="fa-regular fa-clock"></i></span>
              <span class="clean-info-label">Deadline:</span>
              <span class="clean-info-val ${isUrgent ? 'text-coral' : ''}">
                ${escapeHtml(item.claimDeadline)} <span class="clean-info-sub">(${diffDays > 0 ? `${diffDays} days remaining` : 'Expired'})</span>
              </span>
            </div>

            <div class="clean-info-row">
              <span class="clean-info-icon" aria-hidden="true"><i class="fa-solid fa-tag"></i></span>
              <span class="clean-info-label">Category:</span>
              <span class="clean-info-val">${escapeHtml(item.category.replace('_', ' '))} ${item.isHighValue ? '&bull; High-Value' : ''}</span>
            </div>

            <div class="clean-info-row">
              <span class="clean-info-icon" aria-hidden="true"><i class="fa-regular fa-id-card"></i></span>
              <span class="clean-info-label">Owner name:</span>
              <span class="clean-info-val ${item.ownerName ? 'clean-name-highlight' : ''}">
                ${escapeHtml(item.ownerName || "None")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Authority Secret Notes or Student Guide -->
      ${role === "AUTHORITY" ? `
        <div class="clean-vault-block">
          <div class="clean-vault-title">Hidden Notes</div>
          <p class="clean-vault-body">${escapeHtml(item.privateNotes || 'No verification notes recorded.')}</p>
        </div>
      ` : ''}

      <!-- Bottom Actions -->
      <div class="clean-actions-row">
        ${role === "AUTHORITY" ? `
          <button class="btn btn-danger btn-delete-item" data-id="${item.id}" data-title="${encodeURIComponent(item.title)}">
            <i class="fa-solid fa-trash-can"></i> Delete Item
          </button>
        ` : ''}
        <button class="btn btn-secondary" onclick="document.getElementById('detailModal').classList.remove('active')">Close</button>
      </div>
    </div>
  `;

  if (role === "AUTHORITY") {
    const deleteBtn = detailModal.querySelector(".btn-delete-item");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        const itemTitle = decodeURIComponent(deleteBtn.dataset.title || "this item");
        const confirmed = await showCustomConfirm({
          title: "Delete this item?",
          message: `Are you sure you want to permanently delete "${itemTitle}"? This cannot be undone.`,
          confirmText: "Delete",
          isDanger: true
        });
        if (!confirmed) return;

        deleteBtn.disabled = true;
        deleteBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Deleting...`;

        try {
          const useBackend = window.location.protocol !== "file:" && state.currentUser?.role === "AUTHORITY";
          if (useBackend) {
            await deleteItem(item.id);
          }
          state.deleteItem(item.id);
          detailModal.classList.remove("active");
          showToast(`Item Deleted`, `Removed "${item.title}" from catalog.`, "info");
          renderItemsList();
        } catch (error) {
          console.error("Could not delete item:", error);
          showToast("Delete Failed", error.message || "Failed to delete item.", "warning");
          deleteBtn.disabled = false;
          deleteBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Item`;
        }
      });
    }
  }

  detailModal.classList.add("active");
}

// --- CLAIM HANDOVER MODAL ---
function openClaimModal(item) {
  document.getElementById("claimItemId").value = item.id;
  document.getElementById("claimStudentName").value = item.ownerName || "";
  document.getElementById("claimStudentId").value = "";
  document.getElementById("claimNotes").value = "";

  document.getElementById("claimItemSummary").innerHTML = `
    <div class="claim-item-summary">
      <img class="claim-item-summary-image" src="${getItemImageData(item)}" alt="${item.title}" />
      <div class="claim-item-summary-copy">
        <div class="claim-item-summary-title">${item.title}</div>
        <div class="claim-item-summary-ref">Ref: ${item.itemCode}</div>
      </div>
    </div>
  `;

  claimModal.classList.add("active");
}

function openAddModal() {
  const today = new Date().toISOString().split("T")[0];
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 45); // 45 days retention policy
  document.getElementById("itemFoundDate").value = today;
  document.getElementById("itemClaimDeadline").value = deadline.toISOString().split("T")[0];

  addItemModal.classList.add("active");
}

// --- MONDAY EMAIL DIGEST MOCKUP ---
function renderDigestEmail() {
  const container = document.getElementById("digestEmailBody");
  const activeItems = state.items.filter(i => i.status === "ACTIVE");
  const highValueItems = activeItems.filter(i => i.isHighValue);
  const recentItems = activeItems.slice(0, 4);

  container.innerHTML = `
    <div style="max-width: 580px; margin: 0 auto; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #2B0C30;">
      <div style="background: #54195D; color: white; padding: 2rem 1.5rem; border-radius: 12px 12px 0 0; text-align: center;">
        <h2 style="font-family: 'Fraunces', serif; margin: 0; font-size: 1.6rem; letter-spacing: -0.02em;">FOUND@ANS</h2>
        <p style="margin: 6px 0 0 0; font-size: 0.85rem; opacity: 0.9;">Monday Intake Digest &bull; Secondary Reception Desk (Building A)</p>
      </div>

      <div style="border: 1px solid #EFE6F0; border-top: none; padding: 1.75rem; border-radius: 0 0 12px 12px; background: white;">
        <p style="font-size: 0.92rem; line-height: 1.6; color: #4A3A4C;">
          Dear Secondary Students and Staff,<br><br>
          Here is this week's bulletin of lost property held at the <strong>Secondary Reception Desk</strong>. 
          If any of these belongings belong to you, please bring your Student ID to reception between 07:30 - 16:30 to collect them.
        </p>

        <!-- HIGH VALUE SECTION -->
        <div style="font-size: 0.95rem; font-weight: 800; color: #54195D; border-bottom: 2px solid #EFE6F0; padding-bottom: 0.5rem; margin-top: 1.5rem; margin-bottom: 0.85rem;">
          ⭐ High-Value Items (Action Required)
        </div>
        ${highValueItems.length > 0 ? highValueItems.map(item => `
          <div style="display: flex; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid #FAF5FA; align-items: center;">
            <img src="${getItemImageData(item)}" style="width: 58px; height: 58px; border-radius: 8px; object-fit: cover;" />
            <div>
              <div style="font-weight: 700; font-size: 0.9rem; color: #2B0C30;">${item.title}</div>
              <div style="font-size: 0.78rem; color: #826E85;">
                Found: ${item.foundDate} at ${item.foundLocation} &bull; 
                <span style="color: #FF708F; font-weight: 700;">Deadline: ${item.claimDeadline}</span>
              </div>
              ${item.ownerName ? '<div style="font-size: 0.75rem; color: #54195D; font-weight: 700;">Name label: present</div>' : ''}
            </div>
          </div>
        `).join('') : '<p style="font-size: 0.85rem; color: #826E85;">No high-value items waiting.</p>'}

        <!-- RECENT ITEMS SECTION -->
        <div style="font-size: 0.95rem; font-weight: 800; color: #54195D; border-bottom: 2px solid #EFE6F0; padding-bottom: 0.5rem; margin-top: 1.5rem; margin-bottom: 0.85rem;">
          📦 Recently Logged This Past Week
        </div>
        ${recentItems.map(item => `
          <div style="display: flex; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid #FAF5FA; align-items: center;">
            <img src="${getItemImageData(item)}" style="width: 58px; height: 58px; border-radius: 8px; object-fit: cover;" />
            <div>
              <div style="font-weight: 700; font-size: 0.9rem; color: #2B0C30;">${item.title}</div>
              <div style="font-size: 0.78rem; color: #826E85;">
                ${item.foundLocation} &bull; ${item.foundDate}
              </div>
            </div>
          </div>
        `).join('')}

        <div style="margin-top: 2rem; text-align: center;">
          <a href="#" style="background: #54195D; color: white; padding: 0.75rem 1.75rem; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 0.9rem; display: inline-block;">
            Open FOUND@ANS Portal
          </a>
        </div>
      </div>
    </div>
  `;
}

// --- EVENT HANDLERS ---
function initEventHandlers() {
  // Brand home link
  document.getElementById("brandHomeBtn").addEventListener("click", () => {
    if (state.currentUser) navigateTo("viewItems");
  });

  // Firebase Auth Form
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");
  const loginSubmitButton = document.getElementById("loginSubmitButton");
  const loginSubmitText = document.getElementById("loginSubmitText");
  const authModeToggle = document.getElementById("authModeToggle");
  const loginCardBadge = document.getElementById("loginCardBadge");
  const loginCardTitle = document.getElementById("loginCardTitle");
  const loginCardSubtitle = document.getElementById("loginCardSubtitle");
  let authMode = "signin";

  const setAuthMode = (mode) => {
    authMode = mode;
    const isSignUp = mode === "signup";
    
    // Primary Button Text
    loginSubmitText.textContent = isSignUp ? "Create Student / Staff Account" : "Sign In";
    
    // Toggle Link Text
    authModeToggle.innerHTML = isSignUp
      ? `Already registered? <strong style="text-decoration: underline;">Sign in instead</strong>`
      : `Don't have an account? <strong style="text-decoration: underline;">Create one here</strong>`;
    
    // Card Headings & Context Text
    if (loginCardBadge) {
      loginCardBadge.innerHTML = isSignUp 
        ? `<i class="fa-solid fa-user-plus"></i> New Account Registration` 
        : `<i class="fa-solid fa-envelope"></i> School Account Login`;
    }
    if (loginCardTitle) {
      loginCardTitle.textContent = isSignUp ? "Create Your School Portal Account" : "Sign in with School Email";
    }
    if (loginCardSubtitle) {
      loginCardSubtitle.textContent = isSignUp
        ? "Register with your school email address to claim items and report lost belongings."
        : "Sign in securely with your school account. Access is controlled by your account role.";
    }

    loginPassword.autocomplete = isSignUp ? "new-password" : "current-password";
    loginError.hidden = true;
  };

  authModeToggle.addEventListener("click", () => {
    setAuthMode(authMode === "signin" ? "signup" : "signin");
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    loginSubmitButton.disabled = true;

    try {
      await handleLogin(loginEmail.value.trim(), loginPassword.value, authMode);
      loginForm.reset();
    } catch (error) {
      console.error("Firebase authentication failed:", error);
      const message = {
        "auth/invalid-credential": "The email or password is incorrect.",
        "auth/email-already-in-use": "An account already exists for this email.",
        "auth/invalid-email": "Enter a valid school email address.",
        "auth/weak-password": "Use a password with at least 6 characters."
      }[error.code] || "We could not sign you in. Check your details and try again.";
      loginError.textContent = message;
      loginError.hidden = false;
    } finally {
      loginSubmitButton.disabled = false;
    }
  });

  // Search input debounced
  let searchTimer = null;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    btnClearSearch.style.display = e.target.value ? "block" : "none";
    searchTimer = setTimeout(() => {
      state.activeSearchQuery = e.target.value;
      renderItemsList();
    }, 200);
  });

  if (btnSearchTrigger) {
    btnSearchTrigger.addEventListener("click", () => {
      state.activeSearchQuery = searchInput.value;
      renderItemsList();
    });
  }

  btnClearSearch.addEventListener("click", () => {
    searchInput.value = "";
    state.activeSearchQuery = "";
    btnClearSearch.style.display = "none";
    renderItemsList();
  });

  // Category select dropdown
  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      state.activeCategory = e.target.value;
      renderItemsList();
    });
  }

  // High-value filter toggle
  toggleHighValue.addEventListener("change", (e) => {
    state.filterHighValueOnly = e.target.checked;
    renderItemsList();
  });

  // Authority status dropdown
  authorityStatusSelect.addEventListener("change", async (e) => {
    state.authorityStatusFilter = e.target.value;
    await loadServerData();
    renderItemsList();
  });

  // Sort dropdown
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      renderItemsList();
    });
  }

  // Reset Filters from Empty State
  if (btnEmptyReset) {
    btnEmptyReset.addEventListener("click", () => {
      searchInput.value = "";
      state.activeSearchQuery = "";
      btnClearSearch.style.display = "none";
      state.activeCategory = "ALL";
      categoryPills.querySelectorAll(".cat-pill").forEach(p => {
        p.classList.toggle("active", p.dataset.cat === "ALL");
      });
      toggleHighValue.checked = false;
      state.filterHighValueOnly = false;
      if (sortSelect) {
        sortSelect.value = "NEWEST";
        state.sortBy = "NEWEST";
      }
      if (authorityStatusSelect) {
        authorityStatusSelect.value = "ACTIVE";
        state.authorityStatusFilter = "ACTIVE";
      }
      renderItemsList();
    });
  }

  // Keyboard accessibility: Escape to close modals
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      [addItemModal, claimModal, detailModal, reportLostModal, confirmModal].forEach(modal => {
        if (modal && modal.classList.contains("active")) {
          modal.classList.remove("active");
        }
      });
    }
  });

  // Click on gray backdrop/overlay to close modal
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      // If clicking directly on the overlay backdrop (not the modal dialog inside it)
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });
  if (btnOpenAddModal) {
    btnOpenAddModal.addEventListener("click", openAddModal);
  }
  btnCloseAddModal.addEventListener("click", () => addItemModal.classList.remove("active"));
  btnCancelAdd.addEventListener("click", () => addItemModal.classList.remove("active"));

  btnCancelClaim.addEventListener("click", () => claimModal.classList.remove("active"));

  btnCloseDetailModal.addEventListener("click", () => detailModal.classList.remove("active"));

  // Student Report Lost Modal
  if (btnStudentReportLost) {
    btnStudentReportLost.addEventListener("click", () => {
      document.getElementById("reportLostDate").value = new Date().toISOString().split("T")[0];
      const emailField = document.getElementById("reportLostStudentEmail");
      const nameField = document.getElementById("reportLostStudentName");
      if (emailField) emailField.value = state.currentUser?.email || "";
      if (nameField && !nameField.value) nameField.value = state.currentUser?.name || "";
      reportLostModal.classList.add("active");
    });
  }
  if (btnCloseReportLostModal) {
    btnCloseReportLostModal.addEventListener("click", () => reportLostModal.classList.remove("active"));
  }
  if (btnCancelReportLost) {
    btnCancelReportLost.addEventListener("click", () => reportLostModal.classList.remove("active"));
  }
  if (reportLostForm) {
    reportLostForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("reportLostTitle").value;
      const category = document.getElementById("reportLostCategory").value;
      const date = document.getElementById("reportLostDate").value;
      const location = document.getElementById("reportLostLocation").value;
      const secret = document.getElementById("reportLostSecretDetail").value.trim();
      const studentName = document.getElementById("reportLostStudentName")?.value.trim() || state.currentUser?.name || "Student";
      const studentEmail = state.currentUser?.email || "";
      const report = {
        id: `lost-${Date.now()}`,
        title: title.trim(),
        category,
        dateLost: date,
        lastSeen: location.trim(),
        secretDetail: secret,
        studentName,
        studentEmail,
        status: "OPEN",
        createdAt: new Date().toISOString()
      };

      try {
        if (window.location.protocol !== "file:") {
          await createLostReport(report);
        }
        state.addLostReport(report);
      } catch (error) {
        console.error("Could not save lost-item report:", error);
        showToast("Report not saved", error.message || "Server error. Try again.", "warning");
        return;
      }
      showToast("Lost-item report saved", "Reception staff can review it in the Lost reports tab.", "success");
      reportLostModal.classList.remove("active");
      reportLostForm.reset();

      // Trigger automatic keyword search to check if it's already in custody
      searchInput.value = title.split(" ")[0];
      state.activeSearchQuery = searchInput.value;
      btnClearSearch.style.display = "block";
      renderItemsList();
    });
  }

  // Photo Dropzone interactions. Resizing and re-encoding keeps local storage usable.
  let photoProcessing = Promise.resolve("");
  let photoVersion = 0;
  let activeCameraStream = null;

  const itemCameraFile = document.getElementById("itemCameraFile");
  const btnTriggerCamera = document.getElementById("btnTriggerCamera");
  const btnTriggerUpload = document.getElementById("btnTriggerUpload");
  const cameraViewfinder = document.getElementById("cameraViewfinder");
  const cameraVideo = document.getElementById("cameraVideo");
  const cameraCanvas = document.getElementById("cameraCanvas");
  const btnSnapPhoto = document.getElementById("btnSnapPhoto");
  const btnCancelCamera = document.getElementById("btnCancelCamera");
  const dropzoneStatusText = document.getElementById("dropzoneStatusText");

  function stopCameraStream() {
    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach(track => track.stop());
      activeCameraStream = null;
    }
    if (cameraVideo) cameraVideo.srcObject = null;
    if (cameraViewfinder) cameraViewfinder.style.display = "none";
  }

  async function openLiveCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback for mobile / browsers without getUserMedia support
      if (itemCameraFile) itemCameraFile.click();
      return;
    }

    try {
      dropzonePrompt.style.display = "none";
      cameraViewfinder.style.display = "flex";
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
      activeCameraStream = stream;
      cameraVideo.srcObject = stream;
      await cameraVideo.play();
    } catch (err) {
      console.warn("Could not start live camera preview, falling back to file input:", err);
      stopCameraStream();
      dropzonePrompt.style.display = "flex";
      if (itemCameraFile) {
        itemCameraFile.click();
      } else {
        showToast("Camera Access Denied", "Check your browser camera permissions or upload an image file.", "warning");
      }
    }
  }

  function processSelectedFile(file) {
    if (!file) return;
    const version = ++photoVersion;
    photoDataUrl.value = "";
    dropzonePrompt.style.display = "flex";
    if (dropzoneStatusText) dropzoneStatusText.textContent = "Preparing photo…";
    photoProcessing = window.prepareItemPhoto(file).then(dataUrl => {
      if (version !== photoVersion) return "";
      photoDataUrl.value = dataUrl;
      previewImg.src = dataUrl;
      dropzonePrompt.style.display = "none";
      dropzonePreview.style.display = "block";
      return dataUrl;
    }).catch(error => {
      if (version === photoVersion) {
        itemPhotoFile.value = "";
        if (itemCameraFile) itemCameraFile.value = "";
        showToast("Photo not added", error.message, "warning");
        if (dropzoneStatusText) dropzoneStatusText.textContent = "Upload item photo or snap with camera";
      }
      return "";
    });
  }

  itemPhotoFile.addEventListener("change", (e) => {
    processSelectedFile(e.target.files[0]);
  });

  if (itemCameraFile) {
    itemCameraFile.addEventListener("change", (e) => {
      processSelectedFile(e.target.files[0]);
    });
  }

  if (btnTriggerCamera) {
    btnTriggerCamera.addEventListener("click", (e) => {
      e.stopPropagation();
      openLiveCamera();
    });
  }

  if (btnSnapPhoto) {
    btnSnapPhoto.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) return;

      cameraCanvas.width = cameraVideo.videoWidth;
      cameraCanvas.height = cameraVideo.videoHeight;
      const ctx = cameraCanvas.getContext("2d");
      ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

      cameraCanvas.toBlob((blob) => {
        stopCameraStream();
        if (blob) {
          const capturedFile = new File([blob], `item-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
          processSelectedFile(capturedFile);
        }
      }, "image/jpeg", 0.92);
    });
  }

  if (btnCancelCamera) {
    btnCancelCamera.addEventListener("click", (e) => {
      e.stopPropagation();
      stopCameraStream();
      dropzonePrompt.style.display = "flex";
    });
  }

  if (btnTriggerUpload) {
    btnTriggerUpload.addEventListener("click", (e) => {
      e.stopPropagation();
      stopCameraStream();
      itemPhotoFile.click();
    });
  }

  photoDropzone.addEventListener("click", (e) => {
    if (e.target.closest("button") || e.target.closest("#cameraViewfinder")) return;
    itemPhotoFile.click();
  });

  btnClearPhoto.addEventListener("click", (e) => {
    e.stopPropagation();
    stopCameraStream();
    photoVersion++;
    photoProcessing = Promise.resolve("");
    itemPhotoFile.value = "";
    if (itemCameraFile) itemCameraFile.value = "";
    photoDataUrl.value = "";
    previewImg.src = "";
    if (dropzoneStatusText) dropzoneStatusText.textContent = "Upload item photo or snap with camera";
    dropzonePrompt.style.display = "flex";
    dropzonePreview.style.display = "none";
  });

  // Stop camera stream if modal is closed
  [btnCloseAddModal, btnCancelAdd].forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => stopCameraStream());
    }
  });

  // Add Item Submit
  addItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitButton = addItemForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const imageUrl = await photoProcessing;
      if (!imageUrl) {
        showToast("Photo required", "Add a clear photo before registering this item.", "warning");
        itemPhotoFile.click();
        return;
      }

      const title = document.getElementById("itemTitle").value.trim();
      const category = document.getElementById("itemCategory").value;
      const foundDate = document.getElementById("itemFoundDate").value;
      const claimDeadline = document.getElementById("itemClaimDeadline").value;
      const foundLocation = document.getElementById("itemLocation").value.trim();
      const ownerName = document.getElementById("itemOwnerWritten").value.trim() || null;
      const publicDescription = document.getElementById("itemPublicDesc").value.trim();
      const privateNotes = document.getElementById("itemPrivateNotes").value.trim();
      const isHighValue = document.getElementById("itemIsHighValue").checked;
      const year = new Date().getFullYear();
      const highestCode = state.items.reduce((highest, item) => {
        const match = item.itemCode?.match(new RegExp(`^LF-${year}-(\\d+)$`));
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);
      const itemCode = `LF-${year}-${String(highestCode + 1).padStart(3, "0")}`;

      const newItem = {
        id: `item-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
        itemCode,
        title,
        category,
        foundDate,
        claimDeadline,
        foundLocation,
        ownerName,
        publicDescription,
        privateNotes,
        isHighValue,
        status: "ACTIVE",
        image: createEmbeddedImage(imageUrl),
        registeredBy: state.currentUser ? state.currentUser.name : "Reception",
        createdAt: new Date().toISOString()
      };

      const useBackend = window.location.protocol !== "file:" && state.currentUser?.role === "AUTHORITY";
      const savedItem = useBackend ? await createItem(newItem) : newItem;
      state.addItem(savedItem);
      addItemModal.classList.remove("active");
      addItemForm.reset();
      btnClearPhoto.click();
      renderItemsList();
      showToast("Item Registered in Custody", `Assigned code: ${savedItem.itemCode}`, "success");
    } catch (error) {
      console.error("Could not register found item:", error);
      showToast("Item not saved", error.message || "Could not save the item. Try again.", "warning");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  // Claim Form Submit
  claimForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const itemId = document.getElementById("claimItemId").value;
    const studentName = document.getElementById("claimStudentName").value;
    const studentId = document.getElementById("claimStudentId").value;
    const verificationMethod = document.getElementById("claimMethod").value;
    const verificationNotes = document.getElementById("claimNotes").value;

    let success = false;
    try {
      if (window.location.protocol !== "file:") {
        await createHandover({
          itemId,
          studentName,
          studentId,
          verificationMethod,
          verificationNotes
        });
      }
      success = state.claimItem(itemId, {
        studentName,
        studentId,
        verificationMethod,
        verificationNotes
      });
    } catch (error) {
      console.error("Could not save item handover:", error);
      showToast("Handover not saved", "Browser storage may be full. Clear space and try again.", "warning");
      return;
    }

    if (success) {
      claimModal.classList.remove("active");
      renderItemsList();
      showToast("Handover Verified & Completed", `Item released to ${studentName} (${studentId})`, "success");
    }
  });

  // Simulate Broadcast Button
  document.getElementById("btnSimulateSend").addEventListener("click", () => {
    showToast("Weekly Digest Broadcast Sent", "Email dispatched to secondary-all@amnuaysilpa.ac.th", "coral");
  });
}

// --- BOOTSTRAP ---
async function init() {
  initEventHandlers();
  initHeroParallax();

  // Load live statistics from backend if running on web
  if (window.location.protocol !== "file:") {
    try {
      const stats = await fetchStats();
      if (stats) {
        const reunitedEl = document.getElementById("statCountReunited");
        const waitingEl = document.getElementById("statCountWaiting");
        const avgTimeEl = document.getElementById("statAvgReturnTime");

        if (reunitedEl && typeof stats.reunited === "number") {
          reunitedEl.dataset.target = stats.reunited;
        }
        if (waitingEl && typeof stats.waiting === "number") {
          waitingEl.dataset.target = stats.waiting;
        }
        if (avgTimeEl) {
          avgTimeEl.textContent = stats.avgReturnTime || "0 days";
        }
      }
    } catch (e) {
      console.warn("Could not load dynamic stats:", e);
    }
  }

  triggerStatsCounters();

  // Quick suggestion chips binding
  document.querySelectorAll(".chip-suggest").forEach(chip => {
    chip.addEventListener("click", () => {
      const q = chip.dataset.query;
      searchInput.value = q;
      state.activeSearchQuery = q;
      btnClearSearch.style.display = "block";
      renderItemsList();
      showToast("Filtered by keyword", `Showing results for "${q}"`, "coral");
    });
  });

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        showAuthenticatedView(await getAuthenticatedUser(firebaseUser));
      } catch (error) {
        console.error("Could not restore Firebase session:", error);
        state.setCurrentUser(null);
        renderNav();
        navigateTo("viewLogin");
      }
    } else {
      state.setCurrentUser(null);
      renderNav();
      navigateTo("viewLogin");
    }
  });
}

window.addEventListener("resize", () => {
  updateNavIndicator();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

