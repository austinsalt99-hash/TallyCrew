export const metadata = {
  title: "Support — TallyCrew",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Support</h1>
        <p className="text-sm text-gray-400 mb-8">We&apos;re happy to help.</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-700">
          <p>
            For help using TallyCrew, questions about your account or subscription, or to report
            a bug, email us at{" "}
            <a href="mailto:austinsalt99@gmail.com" className="text-navy-600 underline">
              austinsalt99@gmail.com
            </a>{" "}
            and we&apos;ll get back to you as soon as we can.
          </p>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Common questions</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <span className="font-medium text-gray-800">Forgot your password?</span> Use the
                &quot;Forgot password&quot; link on the login screen to reset it.
              </li>
              <li>
                <span className="font-medium text-gray-800">Billing or subscription questions?</span>{" "}
                Company admins can manage billing from the Billing tab in the admin dashboard, or
                by emailing us directly.
              </li>
              <li>
                <span className="font-medium text-gray-800">Something not working?</span> Email us
                a description of what happened and we&apos;ll investigate.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">More information</h2>
            <p>
              See our{" "}
              <a href="/privacy" className="text-navy-600 underline">Privacy Policy</a> and{" "}
              <a href="/terms" className="text-navy-600 underline">Terms of Service</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
