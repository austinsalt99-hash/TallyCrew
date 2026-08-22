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
            agree to these terms and to our{" "}
            <a href="/privacy" className="text-navy-600 underline">Privacy Policy</a>, which is
            incorporated into these terms by reference.
          </p>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Eligibility</h2>
            <p>
              You must be at least 18 years old, or the age of legal majority in your jurisdiction,
              and able to form a binding contract, to create an account or use the Service.
            </p>
          </section>

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
            <h2 className="text-base font-semibold text-gray-900 mb-2">Subscription &amp; billing</h2>
            <p>
              Company accounts are billed on a monthly or annual subscription, processed by Stripe.
              New accounts may include a free trial period; unless you cancel before the trial ends,
              the subscription begins and you will be charged. Subscriptions{" "}
              <span className="font-medium text-gray-800">automatically renew</span> at the end of
              each billing period until cancelled. You can cancel at any time from the billing page —
              cancelling stops future renewals but does not refund the current billing period, and
              you keep access through the end of the period you&apos;ve already paid for. If a
              payment fails, we may suspend access to the Service until payment is resolved. All
              fees are exclusive of applicable taxes unless stated otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Data ownership</h2>
            <p>
              As between you and TallyCrew, your Company retains ownership of the timesheet, job,
              and scheduling data it submits to the Service (&quot;Company Data&quot;). You grant us
              a license to host, process, and display Company Data solely to provide and support the
              Service. TallyCrew and its licensors retain all rights to the Service itself, including
              its software, design, and trademarks.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Indemnification</h2>
            <p>
              You agree to indemnify and hold TallyCrew and its operator harmless from any claims,
              losses, or liabilities — including reasonable legal fees — arising from your
              Company&apos;s use of the Service, your Company Data, or your violation of these
              terms, including any claim that hours, wages, or job records maintained in the Service
              did not comply with applicable employment or wage-and-hour law. Compliance with those
              laws is your Company&apos;s responsibility, not ours.
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
            <h2 className="text-base font-semibold text-gray-900 mb-2">Governing law &amp; disputes</h2>
            <p>
              These terms are governed by the laws of the Province of British Columbia and the
              federal laws of Canada applicable therein, without regard to conflict-of-laws
              principles. You agree that any dispute arising from these terms or the Service will be
              subject to the exclusive jurisdiction of the courts located in British Columbia,
              Canada.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">General</h2>
            <p>
              These terms, together with the Privacy Policy, are the entire agreement between you
              and TallyCrew regarding the Service and supersede any prior agreements. If any
              provision is found unenforceable, the rest remain in full effect. Our failure to
              enforce a provision is not a waiver of it. You may not assign your account or these
              terms without our consent; we may assign them in connection with a merger, sale, or
              transfer of the business.
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
