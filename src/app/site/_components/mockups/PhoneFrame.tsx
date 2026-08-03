export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[280px] rounded-[2.5rem] bg-gray-900 p-2.5 shadow-2xl">
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-900 rounded-full z-10" />
      <div className="relative rounded-[2rem] overflow-hidden bg-gray-100 aspect-[9/19.5]">
        {children}
      </div>
    </div>
  );
}
