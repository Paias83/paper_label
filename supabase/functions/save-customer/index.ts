// Edge Function: save-customer
// Cadastro manual de cliente pelo admin (vendas por telefone/presencial).
// Sem `id`: cria a conta de verdade (auth.users + profiles) com o e-mail já
// confirmado e sem senha — nenhum e-mail é enviado. O perfil fica com
// registration_completed = false, então quando o cliente entrar no site o
// /entrar manda o link de "continuar cadastro" e ele cria a senha e aceita
// os termos. Com `id`: atualiza nome, CPF, telefone e endereço (o e-mail não
// muda por aqui). Só admin pode chamar — admin não tem UPDATE em profiles
// pela RLS, por isso a escrita passa pela service role.
//
// Deploy: supabase functions deploy save-customer

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type IncomingAddress = {
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { id, name, email, cpf, phone, address } = (await req.json()) as {
      id?: string | null
      name: string
      email?: string | null
      cpf: string | null
      phone: string | null
      address: IncomingAddress | null
    }

    const cleanName = name?.trim()
    const cleanEmail = email?.trim().toLowerCase() ?? ''
    if (!cleanName) {
      return jsonResponse({ error: 'Informe o nome do cliente.' }, 400)
    }
    if (!id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return jsonResponse({ error: 'Informe um e-mail válido.' }, 400)
    }

    // Só admin — checa o papel de quem chamou usando o próprio token.
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (!user) {
      return jsonResponse({ error: 'É preciso estar logado.' }, 401)
    }
    const { data: callerProfile } = await authClient.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') {
      return jsonResponse({ error: 'Só administradores podem cadastrar clientes.' }, 403)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const profileData = {
      name: cleanName,
      cpf: cpf ? cpf.replace(/\D/g, '') : null,
      phone: phone ? phone.replace(/\D/g, '') : null,
      addresses: address ? [address] : [],
    }

    // profiles_cpf_unique: checa antes, para dar uma mensagem clara (e, no
    // cadastro novo, não criar a conta para depois falhar no perfil).
    if (profileData.cpf) {
      let cpfQuery = admin.from('profiles').select('name, email').eq('cpf', profileData.cpf)
      if (id) cpfQuery = cpfQuery.neq('id', id)
      const { data: sameCpf } = await cpfQuery.limit(1).maybeSingle()
      if (sameCpf) {
        const owner = sameCpf.name || sameCpf.email || 'outro cliente'
        return jsonResponse({ error: `Este CPF já está no cadastro de ${owner}.` }, 409)
      }
    }

    if (id) {
      const { error } = await admin.from('profiles').update(profileData).eq('id', id).eq('role', 'cliente')
      if (error) throw error
      return jsonResponse({ id })
    }

    // email_status() é a mesma checagem que o /entrar usa (lê auth.users).
    const { data: status } = await admin.rpc('email_status', { p_email: cleanEmail })
    if (status?.[0]?.exists_account) {
      return jsonResponse({ error: 'Já existe uma conta com este e-mail. Busque o cliente na lista.' }, 409)
    }

    // email_confirm: true = conta já confirmada, sem e-mail de confirmação.
    // O trigger handle_new_user() cria a linha em profiles.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
      user_metadata: { name: cleanName },
    })
    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message ?? 'Não foi possível criar a conta.' }, 400)
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ ...profileData, created_by_admin: true, registration_completed: false })
      .eq('id', created.user.id)
    if (profileError) {
      // Desfaz a conta para não sobrar cadastro pela metade (o perfil sai em cascata).
      await admin.auth.admin.deleteUser(created.user.id)
      throw profileError
    }

    return jsonResponse({ id: created.user.id })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
