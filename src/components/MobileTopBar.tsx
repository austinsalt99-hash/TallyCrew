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
        <span className="text-white font-bold text-base tracking-widest uppercase">TallyCrew</span>
      </div>
    </div>
  );
}
