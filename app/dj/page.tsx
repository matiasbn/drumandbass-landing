import { ButtonLink } from "@/components/ButtonLink";
import data from "./data.json";

type ButtonData = {
  title: string;
};

export default function DjButtonsPage() {
  const buttons = data as ButtonData[];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 font-[family-name:var(--font-geist-sans)]">
      <h1 className="mb-8 text-center text-3xl font-bold">DJ</h1>
      <div className="flex w-full max-w-xs flex-col gap-4">
        {buttons.map((button) => (
          // Nota: Los botones apuntan a "#" como placeholder. Puedes cambiar el href según necesites.
          <ButtonLink key={button.title} href="#">
            {button.title}
          </ButtonLink>
        ))}
      </div>
    </main>
  );
}
