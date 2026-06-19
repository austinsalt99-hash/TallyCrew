import TimesheetForm from "@/components/TimesheetForm";

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900">CEW Daily Hours</h1>
        <p className="text-gray-500 mt-1 text-sm">Fill out as you go. Submit at end of day.</p>
      </div>
      <TimesheetForm />
    </main>
  );
}
