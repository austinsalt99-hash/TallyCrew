import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-white border-b border-gray-100 px-6 py-6 flex flex-col items-center gap-1">
            <Image src="/tally-wordmark.png" alt="TallyCrew" width={200} height={52} priority />
          </div>

          <div className="p-6 text-center">
            <p className="text-6xl font-bold text-gray-200 mb-2">404</p>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">Page not found</h1>
            <p className="text-gray-500 text-sm mb-6">
              The page you&apos;re looking for doesn&apos;t exist or may have moved.
            </p>

            <Link
              href="/"
              className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              Go back home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
