/**
 * Notification & Dispatcher Utility
 * Handles dispatching notifications to technicians on duty assignment
 * and notifying managers on duty acceptance or rejection.
 */

const sendDutyAssignmentNotification = async (payload) => {
  try {
    const duty = payload?.duty || payload || {};
    const staff = payload?.staff || duty.staff || {};
    const staffEmail = staff?.email || "technician@cableops.com";
    const staffName = staff?.name || "Technician";
    const dutyTitle = duty?.dutyTitle || "Field Work Order";
    const zoneName = duty?.zoneName || (typeof duty?.zone === "object" ? duty?.zone?.name : "") || "Cable Network Zone";
    const nodeNumber = duty?.nodeNumber ? ` [Node: ${duty.nodeNumber}]` : "";
    const dateFormatted = duty?.dutyDate
      ? new Date(duty.dutyDate).toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "Upcoming";
    const formatTime12 = (t) => {
      if (!t) return "TBD";
      const s = String(t).trim();
      if (/am|pm/i.test(s)) return s;
      const parts = s.split(":");
      if (parts.length < 2) return s;
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m)) return s;
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      return `${h < 10 ? "0" + h : h}:${m < 10 ? "0" + m : m} ${ampm}`;
    };

    const timeFormatted = `${formatTime12(duty?.startTime)} - ${formatTime12(duty?.endTime)}`;
    const location = duty?.location || duty?.siteLocation?.address || "Assigned Field Site";

    console.log("=================================================");
    console.log(` [NOTIFICATION DISPATCHED] Field Duty Assignment`);
    console.log(`To: ${staffName} <${staffEmail}>`);
    console.log(`Subject: ⚡ ACTION REQUIRED: New Field Duty - ${dutyTitle} (${zoneName})`);
    console.log(`Body:`);
    console.log(`Hi ${staffName},`);
    console.log(`You have been assigned to: "${dutyTitle}" under ${duty?.department || "Field Operations"}.${nodeNumber}`);
    console.log(`Zone: ${zoneName}`);
    console.log(`Date & Time: ${dateFormatted} (${timeFormatted})`);
    console.log(`Location: ${location}`);
    console.log(`Please log in to your staff portal to ACCEPT or DECLINE this field duty.`);
    console.log("=================================================");

    return { success: true };
  } catch (err) {
    console.error("Failed to dispatch duty assignment notification:", err);
    return { success: false, error: err.message };
  }
};

const sendDutyResponseNotificationToManager = async (payload, statusParam) => {
  try {
    const duty = payload?.duty || payload || {};
    const staff = payload?.staff || duty.staff || {};
    const staffName = staff?.name || "Technician";
    const dutyTitle = duty?.dutyTitle || "Field Duty";
    const zoneName = duty?.zoneName || "Field Zone";
    const status = statusParam || payload?.status || duty?.status || "UPDATED";
    const reason = payload?.reason || duty?.rejectionReason;

    console.log("=================================================");
    console.log(` [MANAGER NOTIFICATION] Field Duty ${status}`);
    console.log(`Zone: ${zoneName} | Work Order: ${dutyTitle}`);
    console.log(`Technician: ${staffName}`);
    console.log(`Response: ${status}`);
    if (reason) {
      console.log(`Rejection Reason Notes: "${reason}"`);
      console.log(`Action: Manager reassignment required!`);
    }
    console.log("=================================================");

    return { success: true };
  } catch (err) {
    console.error("Failed to notify manager:", err);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendDutyAssignmentNotification,
  sendDutyResponseNotificationToManager,
};
