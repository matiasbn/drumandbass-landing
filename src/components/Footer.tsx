// Se calcula una sola vez cuando el módulo se carga en el servidor (en tiempo de compilación).
// Esto asegura que la fecha solo se actualice con cada nuevo despliegue.
const lastUpdatedDate = new Date().toLocaleDateString("es-CL", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function Footer() {
  return (
    <footer className="w-full max-w-xs mt-16 text-center">
      <div className="w-full border-t border-gray-300 dark:border-gray-700 mb-4"></div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Un proyecto de{" "}
        <a
          href="https://www.laoficina.cl"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          La Oficina
        </a>
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Última actualización: {lastUpdatedDate}
      </p>
    </footer>
  );
}
