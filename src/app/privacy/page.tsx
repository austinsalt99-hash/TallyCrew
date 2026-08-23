import { PRIVACY_VERSION } from "@/lib/legalVersions";

export const metadata = {
  title: "Privacy Policy — TallyCrew",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: {PRIVACY_VERSION}</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-700">
          <p>
            TallyCrew (&quot;we&quot;, &quot;us&quot;) provides a timesheet, scheduling, and crew
            management app for businesses (&quot;Companies&quot;) and their employees
            (&quot;Workers&quot;). This policy explains what information we collect through the
            app and website, how it&apos;s used, and who it&apos;s shared with.
          </p>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Information we collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><span className="font-medium text-gray-800">Account information:</span> name, email address, role (admin or worker), and the Company you&apos;re associated with.</li>
              <li><span className="font-medium text-gray-800">Timesheet entries:</span> hours worked, job/client details, descriptions, billing rates, and any custom fields your Company has configured, submitted by Workers each day.</li>
              <li><span className="font-medium text-gray-800">Scheduling data:</span> jobs, meetings, tasks, and calendar entries created by admins, including who they&apos;re assigned to.</li>
              <li><span className="font-medium text-gray-800">Voice input:</span> if you use the Voice or Siri Shortcut feature to create a job, the spoken text is sent to an AI service (Anthropic) to be parsed into a structured job entry. It is processed to generate that entry and is not otherwise stored or used by us.</li>
              <li><span className="font-medium text-gray-800">Photos:</span> admins can optionally upload a company banner or invoice logo image, and Workers can optionally attach job-site photos to a billable entry, from their camera or photo library.</li>
              <li><span className="font-medium text-gray-800">Location:</span> the app may request location access to support job scheduling features. Location is not collected unless you grant this permission.</li>
              <li><span className="font-medium text-gray-800">Push notification tokens:</span> used to deliver reminders and announcements to your device.</li>
              <li><span className="font-medium text-gray-800">Billing information:</span> if your Company subscribes to a paid plan, our payment processor (Stripe) collects the billing email and payment details needed to process the subscription. TallyCrew does not receive or store your full card number.</li>
              <li><span className="font-medium text-gray-800">Technical data:</span> we log IP addresses for security and rate-limiting purposes, and use essential cookies/session tokens to keep you signed in. We do not use advertising or analytics-tracking cookies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">How we use this information</h2>
            <p>
              We use the information above solely to operate the app: recording and displaying
              timesheets, scheduling jobs, sending the notifications and email summaries your
              Company has configured, and letting admins manage their crew. Every Company&apos;s
              data is kept separate — Workers and admins can only see data belonging to their own
              Company.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Who we share it with</h2>
            <p>We don&apos;t sell your information. We share data only with the service providers that help us run the app:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Supabase — hosts our database and handles account authentication.</li>
              <li>Resend — sends transactional emails (e.g. timesheet submission notifications).</li>
              <li>Anthropic — processes voice input when you use the Voice/Siri feature to create a job.</li>
              <li>OneSignal — delivers push notifications.</li>
              <li>Stripe — processes subscription payments for Company admins; handles and stores payment card details on our behalf.</li>
            </ul>
            <p className="mt-2">
              These providers may store and process data on servers located outside your country,
              including in the United States. By using the Service, you consent to this transfer.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Data retention</h2>
            <p>
              We retain your information for as long as your account or your Company&apos;s account
              is active. You can request deletion of your data by contacting us below.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Your rights</h2>
            <p>
              You can ask us to access, correct, export, or delete the personal information we hold
              about you by contacting us below. We&apos;ll respond within a reasonable time, though
              some information (like consent and billing records) may need to be retained where
              required by law. If you&apos;re a Worker, your Company&apos;s admin may also be able to
              access or correct your account information directly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Children&apos;s privacy</h2>
            <p>TallyCrew is a workforce management tool and is not directed at, or intended for use by, children.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Changes to this policy</h2>
            <p>We may update this policy from time to time. Changes will be posted on this page with an updated date.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Contact us</h2>
            <p>
              Questions about this policy, or requests to access or delete your data, can be sent to{" "}
              <a href="mailto:austinsalt99@gmail.com" className="text-navy-600 underline">austinsalt99@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
