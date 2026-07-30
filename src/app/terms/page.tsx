import { TERMS_VERSION } from "@/lib/legalVersions";

export const metadata = {
  title: "Terms of Service — TallyCrew",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: {TERMS_VERSION}</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-700">
          <p>
            These terms govern your use of TallyCrew (the &quot;Service&quot;), a timesheet,
            scheduling, and crew management app. By creating an account or using the Service, you
            agree to these terms.
          </p>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">The Service</h2>
            <p>
              TallyCrew lets Companies schedule jobs and manage crews, and lets Workers record and
              submit hours worked. TallyCrew is a record-keeping and scheduling tool only — it does
              not calculate payroll, taxes, or wage law compliance, and it is the Company&apos;s
              responsibility to review submitted hours and job records for accuracy before relying
              on them for payroll, invoicing, or any other purpose.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">AI-assisted and voice-created entries</h2>
            <p>
              Jobs created using the Voice button or Siri Shortcut are parsed by an AI service and
              saved as <span className="font-medium text-gray-800">unverified drafts</span>. These
              drafts may contain mistakes (misheard names, times, or dates) and must be reviewed and
              verified by an admin before being treated as accurate. TallyCrew is not responsible for
              acting on a draft that was never reviewed.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Your account</h2>
            <p>
              You&apos;re responsible for keeping your login credentials secure and for the accuracy
              of the information you submit — including hours worked and job details. Admins are
              responsible for the accuracy of company configuration (log types, worker records,
              wages, and schedules) within their Company.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Acceptable use</h2>
            <p>
              You agree not to use the Service to submit false timesheet or job data, to access data
              belonging to another Company, or to interfere with the normal operation of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Disclaimer of warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available,&quot; without
              warranties of any kind, express or implied. We do not guarantee that the Service will
              be uninterrupted, error-free, or that any data (including AI-parsed entries) will be
              accurate.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, TallyCrew and its operator are not liable for
              any indirect, incidental, or consequential damages arising from your use of the
              Service — including but not limited to payroll errors, wage disputes, missed jobs, or
              data loss. This includes damages resulting from unverified AI-generated entries that
              were relied on without review. Our total liability for any claim relating to the
              Service is limited to the amount, if any, you paid us in the twelve months before the
              claim arose.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Termination</h2>
            <p>
              We may suspend or terminate access to the Service at any time, for any reason,
              including violation of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Changes to these terms</h2>
            <p>We may update these terms from time to time. Changes will be posted on this page with an updated date.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Contact us</h2>
            <p>
              Questions about these terms can be sent to{" "}
              <a href="mailto:austinsalt99@gmail.com" className="text-navy-600 underline">austinsalt99@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
