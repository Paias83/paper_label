import { supabase } from './supabase'

// Anexos dos orçamentos (bucket privado "quote-attachments"). Cada arquivo fica
// na pasta do CLIENTE do orçamento (`<user_id>/<arquivo>`): as regras do Storage
// deixam o cliente ver só a própria pasta e o admin ver tudo
// (supabase/fix-quote-attachments-private.sql). As mensagens guardam o caminho,
// e as telas pedem um link temporário na hora de exibir (AttachmentImage).

const BUCKET = 'quote-attachments'
const SIGNED_URL_SECONDS = 60 * 60

// Envia o arquivo para a pasta do cliente e devolve o caminho a ser salvo na mensagem.
export async function uploadQuoteAttachment(file: File, customerId: string): Promise<string> {
  const safeName = file.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-')
  const path = `${customerId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error
  return path
}

// Mensagens antigas guardavam o link público completo; extrai o caminho dele.
export function toAttachmentPath(value: string) {
  const marker = `/${BUCKET}/`
  if (!value.startsWith('http')) return value
  const idx = value.indexOf(marker)
  return idx === -1 ? value : decodeURIComponent(value.slice(idx + marker.length).split('?')[0])
}

// Link público — só funciona enquanto o bucket for público (transição para o
// bucket privado). Depois da migração, serve apenas de última tentativa.
export function getAttachmentPublicUrl(value: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(toAttachmentPath(value)).data.publicUrl
}

const cache = new Map<string, { url: string; expiresAt: number }>()

// Link temporário (1h) para exibir o anexo — só funciona para quem tem permissão.
export async function getAttachmentUrl(value: string): Promise<string | null> {
  const path = toAttachmentPath(value)
  const cached = cache.get(path)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error || !data?.signedUrl) return null
  cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000 })
  return data.signedUrl
}
