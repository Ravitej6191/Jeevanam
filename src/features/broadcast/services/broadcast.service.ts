import { supabase } from '@/lib/supabase'
import { pushSupabaseNotification } from '@/features/notifications/services/notifications.service'

/** Records a sent broadcast in the history and the notification feed. */
export async function logBroadcast(input: {
  message: string
  imageUrl: string | null
  audience: string
  recipientCount: number
  deliveredCount: number
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: buildingRow, error: buildingError } = await supabase
    .from('building')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (buildingError) throw buildingError

  const { error: insertError } = await supabase.from('broadcasts').insert({
    building_id: buildingRow.id,
    message: input.message,
    image_url: input.imageUrl,
    audience: input.audience,
    recipient_count: input.recipientCount,
    delivered_count: input.deliveredCount,
  })
  if (insertError) throw insertError

  await pushSupabaseNotification(
    buildingRow.id,
    'broadcast',
    'Broadcast sent',
    `SMS sent to ${input.deliveredCount}/${input.recipientCount} tenant${input.recipientCount === 1 ? '' : 's'} (${input.audience}).`,
  )
}
