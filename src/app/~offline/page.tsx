export default function OfflineFallbackPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
      <h1 className="text-xl font-bold text-gray-800">You&rsquo;re offline</h1>
      <p className="text-gray-500 text-sm max-w-xs">
        This page hasn&rsquo;t loaded before, so it isn&rsquo;t available offline yet. Reconnect and try again.
      </p>
    </div>
  );
}
