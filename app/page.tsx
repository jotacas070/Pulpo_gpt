"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Send, Settings, Anchor, Shield, FileText, Users, AlertCircle } from "lucide-react"
import { getAdminSettings, updateAdminSetting, saveChatMessage, validateUserByRut } from "@/lib/supabase/actions"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

interface AppSettings {
  welcomeText: string
  chatbotGreeting: string
  logoUrl: string
  avatarUrl: string
  requireAuth: boolean
  userPassword: string
  flowiseApiUrl: string
  flowiseApiKey: string
}

export default function AsessorComprasPublicas() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminCredentials, setAdminCredentials] = useState({ username: "", password: "" })
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [showAuthScreen, setShowAuthScreen] = useState(false)
  const [userCredentials, setUserCredentials] = useState({ rut: "", password: "" })
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(true) // Start as true since auth is optional
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [currentUser, setCurrentUser] = useState<{ rut?: string } | null>(null)

  const [settings, setSettings] = useState<AppSettings>({
    welcomeText: "Bienvenido al Sistema de Asesoría en Compras Públicas de la Armada de Chile",
    chatbotGreeting: "¡Hola! Soy tu asistente especializado en compras públicas. ¿En qué puedo ayudarte hoy?",
    logoUrl: "/logo-armada-chile.png",
    avatarUrl: "/placeholder-lwm7t.png",
    requireAuth: false,
    userPassword: "",
    flowiseApiUrl: "",
    flowiseApiKey: "",
  })

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const supabaseSettings = await getAdminSettings()

        if (Object.keys(supabaseSettings).length > 0) {
          setSettings((prev) => ({
            ...prev,
            welcomeText: supabaseSettings.welcome_title || prev.welcomeText,
            chatbotGreeting: supabaseSettings.chatbot_greeting || prev.chatbotGreeting,
            logoUrl: supabaseSettings.logo_url || prev.logoUrl,
            avatarUrl: supabaseSettings.chatbot_avatar || prev.avatarUrl,
            requireAuth: supabaseSettings.auth_enabled === "true",
            userPassword: supabaseSettings.user_password || prev.userPassword,
            flowiseApiUrl: supabaseSettings.flowise_api_url || prev.flowiseApiUrl,
            flowiseApiKey: supabaseSettings.flowise_api_key || prev.flowiseApiKey,
          }))

          // Check if auth is required
          if (supabaseSettings.auth_enabled === "true") {
            setIsUserAuthenticated(false)
            setShowAuthScreen(true)
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error)
      }
    }

    loadSettings()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Initialize with greeting message
    if (messages.length === 0) {
      setMessages([
        {
          id: "1",
          content: settings.chatbotGreeting,
          isUser: false,
          timestamp: new Date(),
        },
      ])
    }
  }, [settings.chatbotGreeting])

  const callFlowiseAPI = async (message: string): Promise<string> => {
    try {
      if (!settings.flowiseApiUrl) {
        throw new Error("URL de API de Flowise no configurada")
      }

      const response = await fetch(settings.flowiseApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.flowiseApiKey && { Authorization: `Bearer ${settings.flowiseApiKey}` }),
        },
        body: JSON.stringify({
          question: message,
          history: messages
            .slice(-10) // Only send last 10 messages for context
            .map((msg) => ({
              role: msg.isUser ? "user" : "assistant",
              content: msg.content,
            })),
        }),
      })

      if (!response.ok) {
        throw new Error(`Error de API: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Handle different possible response formats from Flowise
      if (typeof data === "string") {
        return data
      } else if (data.text) {
        return data.text
      } else if (data.answer) {
        return data.answer
      } else if (data.response) {
        return data.response
      } else {
        return "Lo siento, recibí una respuesta inesperada del sistema. Por favor, intenta nuevamente."
      }
    } catch (error) {
      console.error("Error calling Flowise API:", error)
      throw error
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const messageToSend = inputValue
    setInputValue("")
    setIsLoading(true)

    try {
      const botResponseContent = await callFlowiseAPI(messageToSend)

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: botResponseContent,
        isUser: false,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, botResponse])

      try {
        await saveChatMessage(sessionId, messageToSend, botResponseContent, currentUser?.rut)
      } catch (error) {
        console.error("Error saving chat message:", error)
      }
    } catch (error) {
      console.error("Error sending message:", error)

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: settings.flowiseApiUrl
          ? "Lo siento, hay un problema temporal con el sistema. Por favor, intenta nuevamente en unos momentos."
          : "El sistema no está configurado correctamente. Por favor, contacta al administrador.",
        isUser: false,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdminLogin = () => {
    if (adminCredentials.username === "admin_abas" && adminCredentials.password === "pulpopedia") {
      setIsAdminAuthenticated(true)
      setShowAdminPanel(true)
      setAdminCredentials({ username: "", password: "" })
    } else {
      alert("Credenciales de administrador incorrectas")
    }
  }

  const handleUserLogin = async () => {
    try {
      const result = await validateUserByRut(userCredentials.rut, userCredentials.password)

      if (result.success) {
        setCurrentUser({ rut: userCredentials.rut })
        setIsUserAuthenticated(true)
        setShowAuthScreen(false)
        setUserCredentials({ rut: "", password: "" })
      } else {
        alert(result.error || "Credenciales incorrectas")
      }
    } catch (error) {
      console.error("Error during login:", error)
      alert("Error al validar credenciales")
    }
  }

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))

    // Save to Supabase
    try {
      const settingsMap: Record<string, string> = {
        welcomeText: "welcome_title",
        chatbotGreeting: "chatbot_greeting",
        logoUrl: "logo_url",
        avatarUrl: "chatbot_avatar",
        requireAuth: "auth_enabled",
        userPassword: "user_password",
        flowiseApiUrl: "flowise_api_url",
        flowiseApiKey: "flowise_api_key",
      }

      for (const [key, value] of Object.entries(newSettings)) {
        if (settingsMap[key]) {
          const dbValue = key === "requireAuth" ? (value ? "true" : "false") : String(value)
          await updateAdminSetting(settingsMap[key], dbValue)
        }
      }
    } catch (error) {
      console.error("Error saving settings:", error)
    }

    if (newSettings.requireAuth !== undefined) {
      setIsUserAuthenticated(!newSettings.requireAuth)
      setShowAuthScreen(newSettings.requireAuth)
    }
  }

  // Auth screen for users
  if (settings.requireAuth && !isUserAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-6">
            <img
              src={settings.logoUrl || "/placeholder.svg"}
              alt="Logo Armada de Chile"
              className="h-12 sm:h-16 mx-auto mb-4"
            />
            <CardTitle className="text-primary text-lg sm:text-xl">Acceso al Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">RUT (sin puntos ni guión)</label>
              <Input
                type="text"
                value={userCredentials.rut}
                onChange={(e) => setUserCredentials((prev) => ({ ...prev, rut: e.target.value }))}
                placeholder="12345678-9"
                className="h-12 text-base"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Contraseña</label>
              <Input
                type="password"
                value={userCredentials.password}
                onChange={(e) => setUserCredentials((prev) => ({ ...prev, password: e.target.value }))}
                className="h-12 text-base"
              />
            </div>
            <Button onClick={handleUserLogin} className="w-full h-12 text-base font-medium">
              Ingresar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <img
                src={settings.logoUrl || "/placeholder.svg"}
                alt="Logo Armada de Chile"
                className="h-8 sm:h-10 md:h-12 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-lg md:text-xl font-bold truncate">Asesor de Compras Públicas</h1>
                <p className="text-xs sm:text-sm opacity-90 truncate">Armada de Chile</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 flex-shrink-0">
              <Badge variant="secondary" className="hidden lg:flex text-xs">
                <Shield className="w-3 h-3 mr-1" />
                Sistema Oficial
              </Badge>
              {settings.flowiseApiUrl ? (
                <Badge variant="secondary" className="hidden sm:flex bg-green-100 text-green-800 text-xs">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  <span className="hidden md:inline">API Conectada</span>
                  <span className="md:hidden">API</span>
                </Badge>
              ) : (
                <Badge variant="destructive" className="hidden sm:flex text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  <span className="hidden md:inline">API No Configurada</span>
                  <span className="md:hidden">Sin API</span>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdminPanel(true)}
                className="text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0 sm:h-9 sm:w-9"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Welcome Section */}
      <section className="bg-muted py-6 sm:py-8">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground mb-4 sm:mb-6 leading-tight">
            {settings.welcomeText}
          </h2>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 mt-4 sm:mt-6">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">Licitaciones</span>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">Proveedores</span>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Anchor className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">Normativas</span>
            </div>
          </div>
        </div>
      </section>

      {/* Chat Interface */}
      <main className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                <AvatarImage src={settings.avatarUrl || "/placeholder.svg"} />
                <AvatarFallback>AC</AvatarFallback>
              </Avatar>
              <span className="truncate">Asistente de Compras Públicas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Messages */}
            <div className="h-64 sm:h-80 md:h-96 overflow-y-auto mb-4 space-y-3 sm:space-y-4 p-3 sm:p-4 bg-muted/30 rounded-lg">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] sm:max-w-xs md:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-lg ${
                      message.isUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground border"
                    }`}
                  >
                    <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1 sm:mt-2">{message.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card text-card-foreground border px-3 sm:px-4 py-2 sm:py-3 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex space-x-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Escribe tu consulta sobre compras públicas..."
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                className="flex-1 h-10 sm:h-12 text-sm sm:text-base"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
                className="h-10 sm:h-12 px-3 sm:px-4"
                size="sm"
              >
                <Send className="w-4 h-4" />
                <span className="sr-only">Enviar mensaje</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0 pb-4">
              <CardTitle className="text-lg sm:text-xl">Panel de Administración</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {!isAdminAuthenticated ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Usuario</label>
                    <Input
                      value={adminCredentials.username}
                      onChange={(e) => setAdminCredentials((prev) => ({ ...prev, username: e.target.value }))}
                      className="h-10 sm:h-12"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Contraseña</label>
                    <Input
                      type="password"
                      value={adminCredentials.password}
                      onChange={(e) => setAdminCredentials((prev) => ({ ...prev, password: e.target.value }))}
                      className="h-10 sm:h-12"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-2">
                    <Button onClick={handleAdminLogin} className="flex-1 h-10 sm:h-12">
                      Ingresar
                    </Button>
                    <Button variant="outline" onClick={() => setShowAdminPanel(false)} className="flex-1 h-10 sm:h-12">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  <div className="space-y-4 p-3 sm:p-4 border rounded-lg">
                    <h3 className="font-semibold text-base sm:text-lg">Configuración de API Flowise</h3>
                    <div>
                      <label className="text-sm font-medium block mb-2">URL de API Flowise</label>
                      <Input
                        value={settings.flowiseApiUrl}
                        onChange={(e) => updateSettings({ flowiseApiUrl: e.target.value })}
                        placeholder="https://tu-app.railway.app/api/v1/prediction/tu-chatflow-id"
                        className="h-10 sm:h-12 text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        URL completa de tu API de Flowise desplegada en Railway
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-2">API Key (Opcional)</label>
                      <Input
                        type="password"
                        value={settings.flowiseApiKey}
                        onChange={(e) => updateSettings({ flowiseApiKey: e.target.value })}
                        placeholder="Tu API Key de Flowise (si está configurada)"
                        className="h-10 sm:h-12"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">Texto de Bienvenida</label>
                    <Input
                      value={settings.welcomeText}
                      onChange={(e) => updateSettings({ welcomeText: e.target.value })}
                      className="h-10 sm:h-12"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Saludo del Chatbot</label>
                    <Input
                      value={settings.chatbotGreeting}
                      onChange={(e) => updateSettings({ chatbotGreeting: e.target.value })}
                      className="h-10 sm:h-12"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">URL del Logo</label>
                    <Input
                      value={settings.logoUrl}
                      onChange={(e) => updateSettings({ logoUrl: e.target.value })}
                      className="h-10 sm:h-12"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">URL del Avatar</label>
                    <Input
                      value={settings.avatarUrl}
                      onChange={(e) => updateSettings({ avatarUrl: e.target.value })}
                      className="h-10 sm:h-12"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={settings.requireAuth}
                        onChange={(e) => updateSettings({ requireAuth: e.target.checked })}
                        className="rounded w-4 h-4"
                      />
                      <label className="text-sm font-medium">Requerir autenticación de usuarios</label>
                    </div>
                    {settings.requireAuth && (
                      <div>
                        <label className="text-sm font-medium block mb-2">Contraseña para usuarios</label>
                        <Input
                          type="password"
                          value={settings.userPassword}
                          onChange={(e) => updateSettings({ userPassword: e.target.value })}
                          placeholder="Contraseña que conocerán los usuarios"
                          className="h-10 sm:h-12"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-4">
                    <Button
                      onClick={() => {
                        setShowAdminPanel(false)
                        setIsAdminAuthenticated(false)
                      }}
                      className="flex-1 h-10 sm:h-12"
                    >
                      Guardar y Cerrar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAdminPanel(false)
                        setIsAdminAuthenticated(false)
                      }}
                      className="flex-1 h-10 sm:h-12"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
