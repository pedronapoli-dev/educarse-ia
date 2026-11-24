import { supabase } from './supabase'

export const isPlanOwnedByUser = async (userId: string, planId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('plans')
    .select('id')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data !== null
}
