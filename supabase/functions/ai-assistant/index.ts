import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are an SMM analytics copilot. Rules:
1) Only reference metrics and posts provided in context JSON.
2) If data is missing, say so and ask to import CSV.
3) Propose testable hypotheses, not final decisions.
4) Never output a full monthly content strategy.
5) End every analysis with section: 'На чём основан вывод' with specific posts and numbers.
6) Add confidence: низкая/средняя/высокая.
Respond in Russian.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY не настроен' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { mode, scenario, messages, context, coachStep } = body

    let userContent = ''

    if (mode === 'analyst') {
      const scenarioPrompts: Record<string, string> = {
        er_drop:
          'Объясни возможные причины падения ER за выбранный период. Предложи 3–5 проверяемых гипотез.',
        anomalies:
          'Найди аномалии в метриках и предложи 3–5 проверяемых гипотез с причинами.',
        top_posts:
          'Какие посты сработали лучше всего? Предложи 3–5 гипотез, почему они выиграли.',
      }
      userContent = `${scenarioPrompts[scenario] ?? scenarioPrompts.er_drop}\n\nКонтекст:\n${JSON.stringify(context, null, 2)}`
    } else {
      userContent = `Режим коуча, шаг ${coachStep ?? 1}. История диалога и контекст:\n${JSON.stringify({ messages, context }, null, 2)}`
    }

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(messages ?? []),
      { role: 'user', content: userContent },
    ]

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        temperature: 0.4,
      }),
    })

    const completion = await openaiRes.json()
    const content = completion.choices?.[0]?.message?.content ?? 'Не удалось получить ответ.'

    const confidenceMatch = content.match(/уверенност[ьи]?:\s*(низкая|средняя|высокая)/i)
    const confidence = confidenceMatch?.[1]?.toLowerCase() as 'низкая' | 'средняя' | 'высокая' | undefined

    return new Response(
      JSON.stringify({ content, confidence: confidence ?? 'средняя' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
