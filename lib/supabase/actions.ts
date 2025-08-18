"use server"

import { createClient } from "./server"
import { revalidatePath } from "next/cache"

// Función para obtener configuraciones del admin
export async function getAdminSettings() {
  const supabase = createClient()

  const { data, error } = await supabase.from("admin_settings").select("setting_key, setting_value")

  if (error) {
    console.error("Error fetching admin settings:", error)
    return {}
  }

  // Convertir array a objeto para fácil acceso
  const settings: Record<string, string> = {}
  data?.forEach((setting) => {
    settings[setting.setting_key] = setting.setting_value
  })

  return settings
}

// Función para actualizar configuraciones del admin
export async function updateAdminSetting(key: string, value: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from("admin_settings")
    .upsert(
      { setting_key: key, setting_value: value, updated_at: new Date().toISOString() },
      { onConflict: "setting_key" },
    )

  if (error) {
    console.error("Error updating admin setting:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/")
  return { success: true }
}

// Función para guardar conversación del chat
export async function saveChatMessage(sessionId: string, message: string, response: string, userId?: string) {
  const supabase = createClient()

  // Guardar mensaje del usuario
  await supabase.from("chat_conversations").insert({
    user_id: userId || null,
    session_id: sessionId,
    message: message,
    message_type: "user",
  })

  // Guardar respuesta del asistente
  await supabase.from("chat_conversations").insert({
    user_id: userId || null,
    session_id: sessionId,
    message: response,
    message_type: "assistant",
  })
}

// Función para obtener historial de conversaciones
export async function getChatHistory(sessionId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("chat_conversations")
    .select("message, message_type, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching chat history:", error)
    return []
  }

  return data || []
}

// Función para validar usuario por RUT
export async function validateUserByRut(rut: string, password: string) {
  const supabase = createClient()

  // Obtener la contraseña configurada por el admin
  const { data: settings } = await supabase
    .from("admin_settings")
    .select("setting_value")
    .eq("setting_key", "user_password")
    .single()

  const configuredPassword = settings?.setting_value || "armada2024"

  if (password !== configuredPassword) {
    return { success: false, error: "Contraseña incorrecta" }
  }

  // Verificar si el usuario existe o crearlo
  const { data: existingUser } = await supabase.from("app_users").select("*").eq("rut", rut).single()

  if (!existingUser) {
    // Crear nuevo usuario
    const { error } = await supabase.from("app_users").insert({ rut: rut })

    if (error) {
      return { success: false, error: "Error al crear usuario" }
    }
  }

  return { success: true, user: { rut } }
}
