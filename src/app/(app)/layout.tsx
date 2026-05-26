export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex gap-4 border-b p-3 text-sm">
        <a href="/board" className="underline">Board</a>
        <a href="/compose" className="underline">Compose</a>
        <a href="/performance" className="underline">Performance</a>
        <a href="/profiles" className="underline">Profiles</a>
      </nav>
      {children}
    </div>
  );
}
