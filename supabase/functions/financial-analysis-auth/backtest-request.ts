export function validateBacktestRequest(prompt:string):string|null {
  // Only the implemented fixed baseline is accepted. Never substitute it for custom rules.
  const unsupported=/RSI|KD|唐奇安|Donchian|背離|突破|ATR|200\s*MA|手續費|交易稅|成本|止損|停損|再平衡/i
  if(unsupported.test(prompt))return '目前回測僅支援固定 20MA／60MA 均線基準（近 5 年、未含交易成本）。你要求的策略、濾網或成本條件尚未實作，因此不產生替代績效。請使用固定基準，或等待指定策略完成。'
  if(/策略|均線|MA/i.test(prompt)&&!/(20\s*(?:MA)?\s*[/／、,]\s*60|20.*60.*均線|20MA.*60MA)/i.test(prompt))return '無法確認要求的策略是目前支援的 20MA／60MA 固定基準，請明確選擇支援策略。'
  return null
}
