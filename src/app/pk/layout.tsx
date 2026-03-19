import Header from '@/src/components/Header';

export default function PkPublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col selection:bg-[#ff0000] selection:text-white">
      <Header />
      {children}
    </div>
  );
}
