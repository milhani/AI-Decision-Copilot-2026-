/** Демо-режим: локальные ответы без LLM. Выключите, когда задан DEEPSEEK_API_KEY в server/.env */
export function useMockAi(): boolean {
  const flag = import.meta.env.VITE_USE_MOCK_AI
  if (flag === 'false' || flag === '0') return false
  return true
}
