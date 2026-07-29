import Image from "next/image";

export default function MobileTopBar() {
  return (
    <div
      className="md:hidden fixed top-0 left-0 right-0 z-20"
      style={{
        background: "#0A1172",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="h-11 flex items-center justify-center">
        <Image src="/tally-wordmark-white.png" alt="TallyCrew" width={70} height={24} priority />
      </div>
    </div>
  );
}
