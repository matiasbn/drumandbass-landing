import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos de Servicio',
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto p-6 lg:p-12">
        <h1 className="text-4xl font-black uppercase mb-8">Términos de Servicio</h1>
        <p className="mono text-sm text-black/60 mb-8">Última actualización: 4 de marzo de 2026</p>

        <div className="space-y-6 mono text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold uppercase mb-2">1. Aceptación de los términos</h2>
            <p>
              Al acceder y utilizar Drum and Bass Chile (&quot;el sitio&quot;), aceptas estar sujeto a
              estos Términos de Servicio. Si no estás de acuerdo con alguna parte de estos términos,
              no debes utilizar el sitio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">2. Descripción del servicio</h2>
            <p>
              Drum and Bass Chile es una plataforma comunitaria que conecta a artistas, productores,
              organizaciones y fanáticos de la escena Drum and Bass en Chile. El sitio incluye un
              directorio de artistas, información sobre eventos y un club virtual.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">3. Cuentas de usuario</h2>
            <p>
              Para acceder a ciertas funcionalidades como el Club Virtual, puedes crear una cuenta
              utilizando proveedores de autenticación de terceros (como Google). Eres responsable de
              mantener la seguridad de tu cuenta y de todas las actividades que ocurran bajo ella.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">4. Conducta del usuario</h2>
            <p>Al utilizar el sitio, te comprometes a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>No publicar contenido ofensivo, difamatorio o ilegal.</li>
              <li>No intentar acceder de manera no autorizada a otras cuentas o sistemas.</li>
              <li>No utilizar el servicio para spam o actividades comerciales no autorizadas.</li>
              <li>Respetar a los demás miembros de la comunidad.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">5. Propiedad intelectual</h2>
            <p>
              El contenido del sitio, incluyendo textos, gráficos, logos y software, es propiedad de
              Drum and Bass Chile o sus respectivos propietarios y está protegido por las leyes de
              propiedad intelectual.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">6. Limitación de responsabilidad</h2>
            <p>
              El sitio se proporciona &quot;tal cual&quot; sin garantías de ningún tipo. Drum and
              Bass Chile no será responsable por daños directos, indirectos, incidentales o
              consecuentes derivados del uso del sitio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">7. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios
              entrarán en vigor inmediatamente después de su publicación en el sitio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">8. Contacto</h2>
            <p>
              Si tienes preguntas sobre estos términos, puedes contactarnos a través de nuestras
              redes sociales.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
