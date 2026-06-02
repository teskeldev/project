export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fff5f5] px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
