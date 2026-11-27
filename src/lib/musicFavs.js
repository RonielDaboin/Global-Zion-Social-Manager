// Música de Instagram favorita (tabla `ig_audio_favorites`, compartida en el espacio y protegida por RLS).
import { supabase } from './supabase.js'

const TABLE = 'ig_audio_favorites'
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data }
// El enlace para escuchar caduca y no se guarda: se pide de nuevo al reproducir
const clean = ({ id, title, artist, duration, cover, kind }) => ({ id, title, artist, duration, cover: cover || null, kind: kind || 'music' })

/** Las más nuevas primero. */
export const fetchFavorites = async () => check(await supabase.from(TABLE).select('track').order('created_at', { ascending: false })).map((r) => r.track)
export const addFavorite = async (track) => check(await supabase.from(TABLE).upsert({ audio_id: track.id, track: clean(track) }, { onConflict: 'user_id,audio_id', ignoreDuplicates: true }))
export const removeFavorite = async (id) => check(await supabase.from(TABLE).delete().eq('audio_id', id))
/** Las carátulas de Instagram caducan: cuando se renueva una, se guarda. */
export const updateFavorite = async (track) => check(await supabase.from(TABLE).update({ track: clean(track) }).eq('audio_id', track.id))
