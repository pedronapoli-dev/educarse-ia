// Supabase Auth (GoTrue) retorna mensagens de erro em inglês. Traduzimos as
// mais comuns para manter a experiência em pt-BR mesmo nos estados de erro
// (Nielsen #2 — correspondência sistema↔mundo, #9 — recuperação de erros).
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Email ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar — verifique sua caixa de entrada.',
  'User already registered': 'Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha.',
  'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
  'New password should be different from the old password': 'A nova senha precisa ser diferente da senha atual.',
  'Unable to validate email address: invalid format': 'Digite um e-mail válido.',
  'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'Email link is invalid or has expired': 'Este link expirou ou já foi usado. Solicite um novo.',
}

// "For security purposes, you can only request this after 23 seconds." —
// mensagem de rate limit com número dinâmico, tratada por prefixo.
const AUTH_ERROR_PREFIXES: Array<[string, string]> = [
  ['For security purposes', 'Por segurança, aguarde um momento antes de tentar novamente.'],
]

export const translateAuthError = (message: string): string => {
  const mapped = AUTH_ERROR_MESSAGES[message]
  if (mapped) return mapped

  const byPrefix = AUTH_ERROR_PREFIXES.find(([prefix]) => message.startsWith(prefix))
  if (byPrefix) return byPrefix[1]

  return 'Não foi possível concluir a operação. Tente novamente em alguns instantes.'
}
