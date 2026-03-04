import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto p-6 lg:p-12">
        <h1 className="text-4xl font-black uppercase mb-8">Política de Privacidad</h1>
        <p className="mono text-sm text-black/60 mb-8">Última actualización: 4 de marzo de 2026</p>

        <div className="space-y-6 mono text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold uppercase mb-2">1. Información que recopilamos</h2>
            <p>Cuando utilizas Drum and Bass Chile, podemos recopilar la siguiente información:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Información de cuenta:</strong> nombre, dirección de correo electrónico y
                nombre de usuario cuando te registras a través de proveedores como Google.
              </li>
              <li>
                <strong>Información de perfil:</strong> datos que proporcionas voluntariamente como
                tu nombre de usuario en el club virtual.
              </li>
              <li>
                <strong>Datos de uso:</strong> información sobre cómo interactúas con el sitio,
                recopilada a través de Google Analytics.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">2. Cómo usamos tu información</h2>
            <p>Utilizamos la información recopilada para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Proporcionar y mantener nuestro servicio.</li>
              <li>Identificarte como usuario dentro del club virtual.</li>
              <li>Mejorar la experiencia del usuario.</li>
              <li>Comunicarnos contigo sobre el servicio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">3. Servicios de terceros</h2>
            <p>Utilizamos los siguientes servicios de terceros:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Google Authentication:</strong> para el inicio de sesión. Al usar Google para
                iniciar sesión, se aplica la{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold"
                >
                  Política de Privacidad de Google
                </a>
                .
              </li>
              <li>
                <strong>Supabase:</strong> para el almacenamiento de datos y autenticación.
              </li>
              <li>
                <strong>Google Analytics:</strong> para análisis de uso del sitio.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">4. Almacenamiento de datos</h2>
            <p>
              Tus datos se almacenan de forma segura en servidores proporcionados por Supabase. No
              vendemos ni compartimos tu información personal con terceros con fines comerciales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">5. Cookies</h2>
            <p>
              Utilizamos cookies esenciales para el funcionamiento del sitio, incluyendo cookies de
              sesión para la autenticación. Google Analytics puede utilizar cookies adicionales para
              el análisis de uso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">6. Tus derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Acceder a los datos personales que tenemos sobre ti.</li>
              <li>Solicitar la corrección de datos inexactos.</li>
              <li>Solicitar la eliminación de tu cuenta y datos asociados.</li>
              <li>Retirar tu consentimiento en cualquier momento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">7. Seguridad</h2>
            <p>
              Implementamos medidas de seguridad razonables para proteger tu información personal.
              Sin embargo, ningún método de transmisión por Internet es 100% seguro.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">8. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política de privacidad periódicamente. Te notificaremos de
              cualquier cambio publicando la nueva política en esta página.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-2">9. Contacto</h2>
            <p>
              Si tienes preguntas sobre esta política de privacidad, puedes contactarnos a través de
              nuestras redes sociales.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
