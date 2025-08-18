-- Tabla para configuraciones del panel de administración
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para historial de conversaciones del chatbot
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  session_id VARCHAR(255),
  message TEXT NOT NULL,
  response TEXT,
  message_type VARCHAR(20) CHECK (message_type IN ('user', 'assistant')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para usuarios del sistema (cuando la autenticación está activada)
CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rut VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuraciones por defecto
INSERT INTO admin_settings (setting_key, setting_value) VALUES
  ('logo_url', '/logo-armada-chile.png'),
  ('welcome_title', 'Asesor de Compras Públicas'),
  ('welcome_subtitle', 'Armada de Chile'),
  ('chatbot_avatar', '/placeholder-lwm7t.png'),
  ('chatbot_greeting', '¡Hola! Soy tu asesor especializado en compras públicas para la Armada de Chile. ¿En qué puedo ayudarte hoy?'),
  ('flowise_api_url', ''),
  ('flowise_api_key', ''),
  ('auth_enabled', 'false'),
  ('user_password', 'armada2024')
ON CONFLICT (setting_key) DO NOTHING;

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session_id ON chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_at ON chat_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_app_users_rut ON app_users(rut);
