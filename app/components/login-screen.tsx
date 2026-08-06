type LoginScreenProps = {
  error: string | null;
};

/** Shown when there's no valid session — the only way into the app now that data lives in D1. */
export function LoginScreen({ error }: LoginScreenProps) {
  return (
    <main className="app login-screen">
      <div className="login-card">
        <span className="brand-mark" aria-hidden="true">+</span>
        <h1>family<span>care</span></h1>
        <p>Entre para acessar os dados de saúde da sua família, sincronizados com segurança.</p>
        {error && (
          <p className="field-error" role="alert">{error}</p>
        )}
        <a className="submit-button" href="/api/auth/login">
          Entrar com Google
        </a>
      </div>
    </main>
  );
}
