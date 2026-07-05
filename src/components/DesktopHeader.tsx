import Image from "next/image";

export default function DesktopHeader({ name }: { name?: string }) {
  return (
    <header className="hidden md:flex bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm items-center justify-between px-6 py-3">
      <Image src="/tally-wordmark.png" alt="TallyCrew" width={160} height={38} priority />
      {name && <span className="text-sm text-gray-500 font-medium">{name}</span>}
    </header>
  );
}
