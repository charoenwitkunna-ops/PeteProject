(() => {
// In-memory application state. Data is loaded and synced through the backend API.
const INITIAL_ITEMS = [];

class AppState {
  constructor() {
    this.currentUser = null;
    this.items = [...INITIAL_ITEMS];
    this.claims = [];
    this.lostReports = [];
    this.activeCategory = "ALL";
    this.activeSearchQuery = "";
    this.filterHighValueOnly = false;
    this.sortBy = "NEWEST";
    this.authorityStatusFilter = "ACTIVE";
    this.currentView = "viewLogin";
  }

  setItems(items) {
    this.items = Array.isArray(items) ? items : [];
  }

  setLostReports(reports) {
    this.lostReports = Array.isArray(reports) ? reports : [];
  }

  setClaims(claims) {
    this.claims = Array.isArray(claims) ? claims : [];
  }

  addLostReport(report) {
    this.lostReports.unshift(report);
    return true;
  }

  updateLostReport(reportId, status) {
    const report = this.lostReports.find(entry => entry.id === reportId);
    if (!report) return false;
    report.status = status;
    report.updatedAt = new Date().toISOString();
    return true;
  }

  setCurrentUser(user) {
    this.currentUser = user;
  }

  addItem(itemData) {
    this.items.unshift(itemData);
    return true;
  }

  claimItem(itemId, claimDetails) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return false;

    item.status = "CLAIMED";
    item.claimedAt = new Date().toISOString();
    item.claimedBy = claimDetails.studentName;
    item.claimedStudentId = claimDetails.studentId;
    item.verificationMethod = claimDetails.verificationMethod;
    item.verificationNotes = claimDetails.verificationNotes;
    item.releasedBy = this.currentUser ? this.currentUser.name : "Kru Jane";

    const claim = {
      id: "claim-" + Date.now(),
      itemId: item.id,
      itemCode: item.itemCode,
      ...claimDetails,
      claimedAt: item.claimedAt,
      releasedBy: item.releasedBy
    };
    this.claims.unshift(claim);
    return true;
  }
}

window.FOUND_ANS_STATE = new AppState();
})();
