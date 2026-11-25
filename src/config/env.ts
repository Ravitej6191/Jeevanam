const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined

export const env = {
  supabaseUrl: supabaseUrl ?? '',
  supabaseAnonKey: supabaseAnonKey ?? '',
  whatsappServerUrl: (import.meta.env.VITE_WHATSAPP_SERVER_URL as string | undefined) ?? 'http://localhost:4000',
  whatsappServerToken: import.meta.env.VITE_WHATSAPP_SERVER_TOKEN as string | undefined,
}
