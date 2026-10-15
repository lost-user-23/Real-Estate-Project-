const config = require('../config');
const mailer = require('./mailer.service');

// Minimal internal notification: reference and loan type only, no applicant
// details. Silent no-op unless LOAN_ENQUIRY_NOTIFY_EMAIL is set. A mail
// failure never affects the saved enquiry or the response.
function notifyNewLoanEnquiry(enquiry) {
  const to = config.loanEnquiryNotifyEmail;
  if (!to) return;
  const text = `A new ${enquiry.loanType} loan callback request was received. Reference: ${String(enquiry._id)}. Review it in the admin panel under Loan enquiries.`;
  Promise.resolve()
    .then(() => mailer.deliver({ to, subject: 'New loan enquiry', text, html: `<p>${text}</p>` }))
    .catch(() => {
      console.error('[loan-enquiry] notification email failed');
    });
}

module.exports = { notifyNewLoanEnquiry };
