/**
 * Centered auth shell shared by /login and /signup. Just a maximal-width
 * column — real shell (sidebar + player) lands in Slice 4.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}