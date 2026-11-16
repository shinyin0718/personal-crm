export default function OAuthLayout({ children }: LayoutProps<"/oauth">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <p className="mb-6 text-center text-2xl font-bold tracking-tight text-teal-800">People</p>
      {children}
    </main>
  );
}
