import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <p className="text-8xl font-black text-primary leading-none">404</p>
      <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
      <p className="text-muted-foreground max-w-sm">
        A rota que você tentou acessar não existe ou foi movida.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
